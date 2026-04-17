import express from 'express';
import http from 'http';
import https from 'https';
import { URL } from 'url';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 8080;

function proxyRequest(targetUrlStr, res, originalFilename) {
  const targetUrl = new URL(targetUrlStr);
  const client = targetUrl.protocol === 'https:' ? https : http;

  client.get(targetUrl, (upstreamRes) => {
    // Handle redirects
    if ([301, 302, 303, 307, 308].includes(upstreamRes.statusCode || 0) && upstreamRes.headers.location) {
      const redirectUrl = new URL(upstreamRes.headers.location, targetUrlStr).toString();
      console.log(`Following redirect to: ${redirectUrl}`);
      return proxyRequest(redirectUrl, res, originalFilename);
    }

    if (upstreamRes.statusCode !== 200) {
      res.statusCode = upstreamRes.statusCode || 500;
      return res.end(`Upstream error: ${upstreamRes.statusCode}`);
    }

    const contentType = upstreamRes.headers['content-type'] || '';
    
    // If the server returns an M3U8 playlist instead of a video, handle HLS!
    if (contentType.includes('mpegurl') || targetUrlStr.includes('.m3u8')) {
      console.log('Detected HLS playlist instead of direct video file. Switching to HLS Downloader mode...');
      let data = '';
      upstreamRes.on('data', chunk => data += chunk);
      upstreamRes.on('end', () => {
        // We already read the playlist, let's process it directly to avoid fetching it again
        const lines = data.split('\n');
        const segments = lines.filter(l => l.trim() && !l.startsWith('#')).map(l => new URL(l.trim(), targetUrlStr).toString());
        
        if (segments.length === 0) {
          return res.end();
        }

        console.log(`Downloading HLS stream: ${segments.length} segments found.`);

        let finalFilename = originalFilename;
        if (!finalFilename.endsWith('.mp4')) {
          finalFilename = finalFilename.replace(/\.[^/.]+$/, "") + ".mp4";
        }
        
        const safeName = finalFilename.replace(/[^\w\s.-]/gi, '');
        res.setHeader('Content-Type', 'video/mp2t');
        res.setHeader('Content-Disposition', `attachment; filename="${safeName || 'download.mp4'}"; filename*=UTF-8''${encodeURIComponent(finalFilename)}`);

        const downloadSegments = async () => {
          for (let i = 0; i < segments.length; i++) {
            await new Promise((resolve) => {
              const segUrlStr = segments[i];
              const segUrl = new URL(segUrlStr);
              const segClient = segUrl.protocol === 'https:' ? https : http;
              
              const fetchSegment = (urlObj, retries = 3) => {
                segClient.get(urlObj, (segRes) => {
                  if ([301, 302, 303, 307, 308].includes(segRes.statusCode || 0) && segRes.headers.location) {
                    return fetchSegment(new URL(segRes.headers.location, urlObj.toString()), retries);
                  }
                  if (segRes.statusCode !== 200) {
                    if (retries > 0) return fetchSegment(urlObj, retries - 1);
                    return resolve();
                  }
                  
                  segRes.pipe(res, { end: false });
                  segRes.on('end', resolve);
                  segRes.on('error', () => resolve());
                }).on('error', () => {
                  if (retries > 0) return fetchSegment(urlObj, retries - 1);
                  resolve();
                });
              };
              fetchSegment(segUrl);
            });
          }
          res.end();
        };
        downloadSegments();
      });
      return;
    }

    // Otherwise, normal static file download
    res.setHeader('Content-Type', contentType || 'application/octet-stream');
    if (upstreamRes.headers['content-length']) {
      res.setHeader('Content-Length', upstreamRes.headers['content-length']);
    }
    const safeName = originalFilename.replace(/[^\w\s.-]/gi, '');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName || 'download.mkv'}"; filename*=UTF-8''${encodeURIComponent(originalFilename)}`);

    upstreamRes.pipe(res);

    upstreamRes.on('error', (err) => {
      console.error('Upstream stream error:', err);
      res.end();
    });

  }).on('error', (err) => {
    console.error('Request error:', err);
    res.statusCode = 500;
    res.end('Internal Server Error');
  });
}

// API Routes
app.get('/api/config', (req, res) => {
  res.json({
    url: process.env.XTREAM_URL || null,
    username: process.env.XTREAM_USERNAME || null,
    password: process.env.XTREAM_PASSWORD || null,
    password: process.env.XTREAM_PASSWORD || null,
    hasServerDownload: settings.locations && settings.locations.length > 0
  });
});

app.use('/api/proxy', (req, res) => {
  try {
    const urlObj = new URL(req.url || '', `http://${req.headers.host}`);
    const targetUrlStr = urlObj.searchParams.get('url');
    
    if (!targetUrlStr) {
      return res.status(400).send('Missing target url');
    }

    const targetUrl = new URL(targetUrlStr);
    const client = targetUrl.protocol === 'https:' ? https : http;

    client.get(targetUrl, (upstreamRes) => {
      res.status(upstreamRes.statusCode || 200);
      Object.entries(upstreamRes.headers).forEach(([key, value]) => {
        if (value && !['transfer-encoding'].includes(key.toLowerCase())) {
          res.setHeader(key, value);
        }
      });
      // Force CORS headers on the proxy response
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      
      upstreamRes.pipe(res);
    }).on('error', (err) => {
      console.error('API Proxy Error:', err);
      res.status(500).send('API Proxy Error');
    });
  } catch (e) {
    console.error(e);
    res.status(500).send('Internal Server Error');
  }
});

// Config and State Management
const CONFIG_DIR = process.env.CONFIG_DIR || '/config';
let actualConfigDir = CONFIG_DIR;
try {
  if (!fs.existsSync(actualConfigDir)) {
    fs.mkdirSync(actualConfigDir, { recursive: true });
  }
} catch (e) {
  actualConfigDir = path.join(__dirname, 'config');
  if (!fs.existsSync(actualConfigDir)) {
    fs.mkdirSync(actualConfigDir, { recursive: true });
  }
}
const getSettingsFile = () => path.join(actualConfigDir, 'settings.json');
const getQueueFile = () => path.join(actualConfigDir, 'queue.json');

let settings = { locations: [] };
let downloadQueue = [];
let currentDownloadReq = null; // Store the current HTTP request to allow cancellation
let currentDownloadingId = null; // Track which item is downloading

try {
  if (fs.existsSync(getSettingsFile())) settings = JSON.parse(fs.readFileSync(getSettingsFile(), 'utf-8'));
  if (fs.existsSync(getQueueFile())) downloadQueue = JSON.parse(fs.readFileSync(getQueueFile(), 'utf-8'));
  
  // Reset any "downloading" states to "queued" on startup
  downloadQueue.forEach(item => {
    if (item.status === 'downloading') item.status = 'queued';
  });
} catch (e) {
  console.error("Failed to load config files", e);
}

const saveSettings = () => fs.writeFileSync(getSettingsFile(), JSON.stringify(settings, null, 2));
const saveQueue = () => fs.writeFileSync(getQueueFile(), JSON.stringify(downloadQueue, null, 2));

// Background Queue Processor
const processQueue = () => {
  if (currentDownloadReq !== null) return; // Already downloading
  const nextItem = downloadQueue.find(item => item.status === 'queued');
  if (!nextItem) return;

  // Track current downloading item ID for pause support
  currentDownloadingId = nextItem.id;

  currentDownloadReq = "starting"; // Lock
  nextItem.status = 'downloading';
  nextItem.progress = 0;
  saveQueue();

  if (!fs.existsSync(nextItem.location)) {
    try {
      fs.mkdirSync(nextItem.location, { recursive: true });
    } catch(e) {
      console.error(`Failed to create dir ${nextItem.location}:`, e);
      nextItem.status = 'failed';
      nextItem.error = 'Failed to create directory';
      currentDownloadReq = null;
      saveQueue();
      processQueue();
      return;
    }
  }

  const filePath = path.join(nextItem.location, nextItem.filename);
  
  let redirectCount = 0;

  const startDownload = (urlToFetch) => {
    if (redirectCount > 5) {
      nextItem.status = 'failed';
      nextItem.error = 'Too many redirects';
      currentDownloadReq = null;
      saveQueue();
      processQueue();
      return;
    }

    const targetUrl = new URL(urlToFetch);
    const client = targetUrl.protocol === 'https:' ? https : http;

    currentDownloadReq = client.get(targetUrl, (res) => {
      // Handle redirects
      if ([301, 302, 303, 307, 308].includes(res.statusCode || 0) && res.headers.location) {
          redirectCount++;
          const redirectUrl = new URL(res.headers.location, targetUrl).toString();
          startDownload(redirectUrl);
          return;
      }

      if (res.statusCode !== 200) {
        nextItem.status = 'failed';
        nextItem.error = `HTTP ${res.statusCode}`;
        currentDownloadReq = null;
        saveQueue();
        processQueue();
        return;
      }

      const contentType = res.headers['content-type'] || '';
      const isHLS = contentType.includes('mpegurl') || contentType.includes('m3u') || urlToFetch.includes('.m3u8');

      if (isHLS) {
        // HLS stream — read playlist, then download segments
        console.log(`[Queue] HLS playlist detected for "${nextItem.filename}"`);
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', async () => {
          const lines = data.split('\n');
          const segments = lines.filter(l => l.trim() && !l.startsWith('#')).map(l => new URL(l.trim(), urlToFetch).toString());

          if (segments.length === 0) {
            nextItem.status = 'failed';
            nextItem.error = 'HLS playlist is empty';
            currentDownloadReq = null;
            saveQueue();
            processQueue();
            return;
          }

          console.log(`[Queue] Downloading ${segments.length} HLS segments for "${nextItem.filename}"`);
          
          // Fix extension to .mp4 for HLS streams
          const hlsFilePath = filePath.replace(/\.[^/.]+$/, '') + '.mp4';
          if (nextItem.filename.match(/\.[^/.]+$/)) {
            nextItem.filename = nextItem.filename.replace(/\.[^/.]+$/, '.mp4');
          }

          const fileStream = fs.createWriteStream(hlsFilePath);
          let completedSegments = 0;

          const downloadHLSSegment = (segUrl) => {
            return new Promise((resolve) => {
              const segTarget = new URL(segUrl);
              const segClient = segTarget.protocol === 'https:' ? https : http;

              const fetchSeg = (urlObj, retries = 3) => {
                segClient.get(urlObj, (segRes) => {
                  if ([301, 302, 303, 307, 308].includes(segRes.statusCode || 0) && segRes.headers.location) {
                    return fetchSeg(new URL(segRes.headers.location, urlObj.toString()), retries);
                  }
                  if (segRes.statusCode !== 200) {
                    if (retries > 0) return fetchSeg(urlObj, retries - 1);
                    return resolve();
                  }
                  segRes.pipe(fileStream, { end: false });
                  segRes.on('end', () => {
                    completedSegments++;
                    nextItem.progress = Math.round((completedSegments / segments.length) * 100);
                    if (completedSegments % 5 === 0) saveQueue();
                    resolve();
                  });
                  segRes.on('error', () => resolve());
                }).on('error', () => {
                  if (retries > 0) return fetchSeg(urlObj, retries - 1);
                  resolve();
                });
              };
              fetchSeg(segTarget);
            });
          };

          try {
            for (const segUrl of segments) {
              await downloadHLSSegment(segUrl);
            }
            fileStream.end();
            fileStream.on('finish', () => {
              nextItem.status = 'completed';
              nextItem.progress = 100;
              currentDownloadReq = null;
              saveQueue();
              processQueue();
            });
          } catch (err) {
            fs.unlink(hlsFilePath, () => {});
            nextItem.status = 'failed';
            nextItem.error = err.message || 'HLS download failed';
            currentDownloadReq = null;
            saveQueue();
            processQueue();
          }
        });
        return;
      }

      // Normal direct file download
      const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
      let downloadedBytes = 0;
      nextItem.totalBytes = totalBytes;
      nextItem.downloadedBytes = 0;
      
      const fileStream = fs.createWriteStream(filePath);
      res.pipe(fileStream);

      let lastSave = Date.now();
      res.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        nextItem.downloadedBytes = downloadedBytes;
        if (totalBytes) {
          nextItem.progress = Math.round((downloadedBytes / totalBytes) * 100);
          // Throttle saveQueue to avoid disk thrashing
          if (Date.now() - lastSave > 1000) {
            saveQueue();
            lastSave = Date.now();
          }
        }
      });

      fileStream.on('finish', () => {
        fileStream.close();
        nextItem.status = 'completed';
        nextItem.progress = 100;
        currentDownloadReq = null;
        currentDownloadingId = null;
        saveQueue();
        processQueue();
      });

      fileStream.on('error', (err) => {
        fs.unlink(filePath, () => {}); // Try to delete partial file
        nextItem.status = 'failed';
        nextItem.error = err.message;
        currentDownloadReq = null;
        currentDownloadingId = null;
        saveQueue();
        processQueue();
      });
    }).on('error', (err) => {
      nextItem.status = 'failed';
      nextItem.error = err.message;
      currentDownloadReq = null;
      currentDownloadingId = null;
      saveQueue();
      processQueue();
    });
  };

  startDownload(nextItem.url);
};

setInterval(processQueue, 3000);

// Settings Endpoints
app.get('/api/settings', (req, res) => {
  res.json(settings);
});

app.post('/api/settings', (req, res) => {
  settings = { ...settings, ...req.body };
  saveSettings();
  res.json({ success: true });
});

// Queue Endpoints
app.get('/api/queue', (req, res) => {
  res.json(downloadQueue);
});

app.post('/api/queue', (req, res) => {
  const { url, filename, location } = req.body;
  if (!url || !filename || !location) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  const id = Date.now().toString() + Math.random().toString(36).substring(7);
  // Replace only forbidden filesystem characters (Windows/Linux/Mac), allowing Arabic and other unicode
  const safeName = filename.replace(/[/\\?%*:|"<>]/g, '-');
  
  downloadQueue.push({
    id,
    url,
    filename: safeName,
    location,
    status: 'queued',
    progress: 0,
    addedAt: new Date().toISOString()
  });
  
  saveQueue();
  processQueue(); // trigger immediately if idle
  res.json({ success: true, id });
});

app.delete('/api/queue/:id', (req, res) => {
  const { id } = req.params;
  const index = downloadQueue.findIndex(item => item.id === id);
  if (index === -1) return res.status(404).json({ error: 'Not found' });
  
  const item = downloadQueue[index];
  
  if (item.status === 'downloading') {
    // Abort active download
    if (currentDownloadReq && typeof currentDownloadReq.destroy === 'function') {
      currentDownloadReq.destroy();
    }
    currentDownloadReq = null;
    currentDownloadingId = null;
    const filePath = path.join(item.location, item.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    
    // Process next
    setTimeout(processQueue, 1000);
  }
  
  downloadQueue.splice(index, 1);
  saveQueue();
  res.json({ success: true });
});

app.delete('/api/queue', (req, res) => {
  // Clear completed and failed
  downloadQueue = downloadQueue.filter(item => item.status === 'queued' || item.status === 'downloading' || item.status === 'paused');
  saveQueue();
  res.json({ success: true });
});

// Pause/Resume endpoint
app.patch('/api/queue/:id', (req, res) => {
  const { id } = req.params;
  const { action } = req.body;
  const item = downloadQueue.find(i => i.id === id);
  if (!item) return res.status(404).json({ error: 'Not found' });

  if (action === 'pause') {
    if (item.status === 'downloading') {
      // Abort active download
      if (currentDownloadReq && typeof currentDownloadReq.destroy === 'function') {
        currentDownloadReq.destroy();
      }
      currentDownloadReq = null;
      currentDownloadingId = null;
      // Delete partial file
      const filePath = path.join(item.location, item.filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    item.status = 'paused';
    item.progress = 0;
    item.downloadedBytes = 0;
    saveQueue();
    setTimeout(processQueue, 500);
    return res.json({ success: true });
  }

  if (action === 'resume') {
    if (item.status === 'paused') {
      item.status = 'queued';
      item.error = undefined;
      saveQueue();
      setTimeout(processQueue, 500);
    }
    return res.json({ success: true });
  }

  res.status(400).json({ error: 'Invalid action' });
});

app.use('/api/download', (req, res) => {
  try {
    const urlObj = new URL(req.url || '', `http://${req.headers.host}`);
    const targetUrl = urlObj.searchParams.get('url');
    const filename = urlObj.searchParams.get('filename') || 'download.mp4';
    
    if (!targetUrl) {
      return res.status(400).send('Missing target url');
    }

    console.log(`Proxying download for: ${targetUrl}`);
    proxyRequest(targetUrl, res, filename);

  } catch (e) {
    console.error('Download Proxy Error:', e);
    res.status(500).send('Internal Server Error');
  }
});

// Serve static React files
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback for React Router
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Xtream-Downloader is running on http://0.0.0.0:${PORT}`);
});
