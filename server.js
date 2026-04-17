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
    hasServerDownload: settings.locations && settings.locations.length > 0
  });
});

// Server-side API cache (2 hour TTL)
const apiCache = new Map();
const CACHE_TTL = 2 * 60 * 60 * 1000;

const getCacheKey = (url) => {
  try {
    const u = new URL(url);
    // Cache key from action + params, excluding credentials
    const action = u.searchParams.get('action') || '';
    const params = [...u.searchParams.entries()]
      .filter(([k]) => !['username', 'password'].includes(k))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('&');
    return `${u.pathname}?${params}`;
  } catch {
    return null;
  }
};

const isCacheableRequest = (url) => {
  return url.includes('player_api.php');
};

// Clear cache endpoint
app.delete('/api/cache', (req, res) => {
  apiCache.clear();
  console.log('[Cache] Cache cleared');
  res.json({ success: true });
});

app.get('/api/cache/stats', (req, res) => {
  res.json({ entries: apiCache.size });
});

app.use('/api/proxy', (req, res) => {
  try {
    const urlObj = new URL(req.url || '', `http://${req.headers.host}`);
    const targetUrlStr = urlObj.searchParams.get('url');
    
    if (!targetUrlStr) {
      return res.status(400).send('Missing target url');
    }

    // Check server-side cache
    const cacheKey = getCacheKey(targetUrlStr);
    if (cacheKey && isCacheableRequest(targetUrlStr)) {
      const cached = apiCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log(`[Cache] HIT: ${cacheKey.substring(0, 80)}`);
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('X-Cache', 'HIT');
        return res.send(cached.data);
      }
    }

    const targetUrl = new URL(targetUrlStr);
    const client = targetUrl.protocol === 'https:' ? https : http;

    client.get(targetUrl, (upstreamRes) => {
      const statusCode = upstreamRes.statusCode || 200;

      // If cacheable, buffer the response to store in cache
      if (cacheKey && isCacheableRequest(targetUrlStr) && statusCode === 200) {
        let data = '';
        upstreamRes.on('data', chunk => data += chunk);
        upstreamRes.on('end', () => {
          apiCache.set(cacheKey, { data, timestamp: Date.now() });
          console.log(`[Cache] STORE: ${cacheKey.substring(0, 80)} (${apiCache.size} entries)`);
          res.status(statusCode);
          res.setHeader('Content-Type', upstreamRes.headers['content-type'] || 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('X-Cache', 'MISS');
          res.send(data);
        });
        return;
      }

      // Non-cacheable: stream directly
      res.status(statusCode);
      Object.entries(upstreamRes.headers).forEach(([key, value]) => {
        if (value && !['transfer-encoding'].includes(key.toLowerCase())) {
          res.setHeader(key, value);
        }
      });
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
  // Test write permissions
  const testFile = path.join(actualConfigDir, '.write-test');
  fs.writeFileSync(testFile, 'ok');
  fs.unlinkSync(testFile);
  console.log(`[Config] Using config directory: ${actualConfigDir} (writable)`);
} catch (e) {
  console.error(`[Config] WARNING: ${actualConfigDir} is not writable (${e.message}). Falling back to local ./config`);
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
  console.log(`[Config] Loaded ${settings.locations?.length || 0} locations, ${downloadQueue.length} queue items`);
} catch (e) {
  console.error('[Config] Failed to load config files:', e.message);
}

const saveSettings = () => {
  try {
    fs.writeFileSync(getSettingsFile(), JSON.stringify(settings, null, 2));
  } catch (e) {
    console.error('[Config] ERROR: Failed to save settings:', e.message);
  }
};
const saveQueue = () => {
  try {
    fs.writeFileSync(getQueueFile(), JSON.stringify(downloadQueue, null, 2));
  } catch (e) {
    console.error('[Config] ERROR: Failed to save queue:', e.message);
  }
};

// Download configuration
const DOWNLOAD_CONFIG = {
  connectTimeoutMs: 30_000,     // 30s to establish connection
  socketTimeoutMs: 60_000,      // 60s idle before killing socket
  stallTimeoutMs: 120_000,      // 2min no progress = stalled
  maxRetries: 3,                // retry failed downloads up to 3 times
  retryDelayMs: 5_000,          // base delay between retries (exponential)
  maxHlsFailRate: 0.10,         // fail HLS if >10% segments fail
  hlsSegmentTimeoutMs: 30_000,  // 30s timeout per HLS segment
};

// Helper: make an HTTP GET with timeouts
const httpGetWithTimeout = (url, onResponse, onError) => {
  const targetUrl = new URL(url);
  const client = targetUrl.protocol === 'https:' ? https : http;

  const req = client.get(targetUrl, (res) => {
    res.setTimeout(DOWNLOAD_CONFIG.socketTimeoutMs, () => {
      console.error(`[Download] Socket idle timeout for ${url.substring(0, 80)}`);
      req.destroy(new Error('Socket idle timeout'));
    });
    onResponse(res);
  });

  req.setTimeout(DOWNLOAD_CONFIG.connectTimeoutMs, () => {
    console.error(`[Download] Connection timeout for ${url.substring(0, 80)}`);
    req.destroy(new Error('Connection timeout'));
  });

  req.on('error', onError);
  return req;
};

// Helper: cleanup after download attempt
const resetDownloadState = () => {
  currentDownloadReq = null;
  currentDownloadingId = null;
};

// Background Queue Processor
const processQueue = () => {
  if (currentDownloadReq !== null) return; // Already downloading
  const nextItem = downloadQueue.find(item => item.status === 'queued');
  if (!nextItem) return;

  // Initialize retry counter
  if (nextItem.retryCount === undefined) nextItem.retryCount = 0;

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
      resetDownloadState();
      saveQueue();
      processQueue();
      return;
    }
  }

  const filePath = path.join(nextItem.location, nextItem.filename);
  
  // Retry handler — retries with exponential backoff
  const handleFailure = (error) => {
    const errorMsg = typeof error === 'string' ? error : (error?.message || 'Unknown error');
    console.error(`[Download] Failed "${nextItem.filename}": ${errorMsg} (attempt ${nextItem.retryCount + 1}/${DOWNLOAD_CONFIG.maxRetries})`);

    // Clean up partial file
    try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch {}

    if (nextItem.retryCount < DOWNLOAD_CONFIG.maxRetries - 1) {
      nextItem.retryCount++;
      nextItem.status = 'queued';
      nextItem.progress = 0;
      nextItem.downloadedBytes = 0;
      nextItem.error = `Retry ${nextItem.retryCount}/${DOWNLOAD_CONFIG.maxRetries - 1}: ${errorMsg}`;
      resetDownloadState();
      saveQueue();
      const delay = DOWNLOAD_CONFIG.retryDelayMs * Math.pow(2, nextItem.retryCount - 1);
      console.log(`[Download] Retrying "${nextItem.filename}" in ${delay / 1000}s...`);
      setTimeout(processQueue, delay);
    } else {
      nextItem.status = 'failed';
      nextItem.error = errorMsg;
      resetDownloadState();
      saveQueue();
      processQueue();
    }
  };

  let redirectCount = 0;

  const startDownload = (urlToFetch) => {
    if (redirectCount > 5) {
      return handleFailure('Too many redirects');
    }

    currentDownloadReq = httpGetWithTimeout(urlToFetch, (res) => {
      // Handle redirects
      if ([301, 302, 303, 307, 308].includes(res.statusCode || 0) && res.headers.location) {
        redirectCount++;
        const redirectUrl = new URL(res.headers.location, urlToFetch).toString();
        startDownload(redirectUrl);
        return;
      }

      if (res.statusCode !== 200) {
        return handleFailure(`HTTP ${res.statusCode}`);
      }

      const contentType = res.headers['content-type'] || '';
      const isHLS = contentType.includes('mpegurl') || contentType.includes('m3u') || urlToFetch.includes('.m3u8');

      if (isHLS) {
        downloadHLS(nextItem, urlToFetch, filePath, res, handleFailure);
        return;
      }

      downloadDirect(nextItem, filePath, res, handleFailure);

    }, (err) => {
      handleFailure(err);
    });
  };

  startDownload(nextItem.url);
};

// Direct file download with stall detection
const downloadDirect = (item, filePath, res, onFailure) => {
  const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
  let downloadedBytes = 0;
  item.totalBytes = totalBytes;
  item.downloadedBytes = 0;
  
  const fileStream = fs.createWriteStream(filePath);
  res.pipe(fileStream);

  // Stall watchdog — abort if no progress for 2 minutes
  let lastProgressTime = Date.now();
  let lastProgressBytes = 0;
  const stallCheck = setInterval(() => {
    if (downloadedBytes === lastProgressBytes) {
      if (Date.now() - lastProgressTime > DOWNLOAD_CONFIG.stallTimeoutMs) {
        clearInterval(stallCheck);
        console.error(`[Download] Stall detected for "${item.filename}" at ${Math.round(downloadedBytes / 1024 / 1024)}MB — aborting`);
        res.destroy();
        fileStream.destroy();
        onFailure('Download stalled (no progress for 2 minutes)');
        return;
      }
    } else {
      lastProgressTime = Date.now();
      lastProgressBytes = downloadedBytes;
    }
  }, 10_000); // Check every 10 seconds

  let lastSave = Date.now();
  res.on('data', (chunk) => {
    downloadedBytes += chunk.length;
    item.downloadedBytes = downloadedBytes;
    if (totalBytes) {
      item.progress = Math.round((downloadedBytes / totalBytes) * 100);
      if (Date.now() - lastSave > 1000) {
        saveQueue();
        lastSave = Date.now();
      }
    }
  });

  fileStream.on('finish', () => {
    clearInterval(stallCheck);
    fileStream.close();
    item.status = 'completed';
    item.progress = 100;
    item.retryCount = 0;
    resetDownloadState();
    console.log(`[Download] ✅ Completed "${item.filename}" (${Math.round(downloadedBytes / 1024 / 1024)}MB)`);
    saveQueue();
    processQueue();
  });

  fileStream.on('error', (err) => {
    clearInterval(stallCheck);
    onFailure(err);
  });

  res.on('error', (err) => {
    clearInterval(stallCheck);
    fileStream.destroy();
    onFailure(err);
  });
};

// HLS download with segment failure tracking and timeouts
const downloadHLS = (item, playlistUrl, filePath, res, onFailure) => {
  console.log(`[Queue] HLS playlist detected for "${item.filename}"`);
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', async () => {
    const lines = data.split('\n');
    const segments = lines.filter(l => l.trim() && !l.startsWith('#')).map(l => new URL(l.trim(), playlistUrl).toString());

    if (segments.length === 0) {
      return onFailure('HLS playlist is empty');
    }

    console.log(`[Queue] Downloading ${segments.length} HLS segments for "${item.filename}"`);
    
    // Fix extension to .mp4 for HLS streams
    const hlsFilePath = filePath.replace(/\.[^/.]+$/, '') + '.mp4';
    if (item.filename.match(/\.[^/.]+$/)) {
      item.filename = item.filename.replace(/\.[^/.]+$/, '.mp4');
    }

    const fileStream = fs.createWriteStream(hlsFilePath);
    let completedSegments = 0;
    let failedSegments = 0;

    const downloadHLSSegment = (segUrl, segIndex) => {
      return new Promise((resolve) => {
        const fetchSeg = (urlStr, retries = 3) => {
          let segTimedOut = false;
          
          const segReq = httpGetWithTimeout(urlStr, (segRes) => {
            if ([301, 302, 303, 307, 308].includes(segRes.statusCode || 0) && segRes.headers.location) {
              return fetchSeg(new URL(segRes.headers.location, urlStr).toString(), retries);
            }
            if (segRes.statusCode !== 200) {
              if (retries > 0) return fetchSeg(urlStr, retries - 1);
              failedSegments++;
              return resolve();
            }

            // Per-segment timeout
            const segTimeout = setTimeout(() => {
              segTimedOut = true;
              segReq.destroy();
              if (retries > 0) return fetchSeg(urlStr, retries - 1);
              failedSegments++;
              resolve();
            }, DOWNLOAD_CONFIG.hlsSegmentTimeoutMs);

            segRes.pipe(fileStream, { end: false });
            segRes.on('end', () => {
              if (segTimedOut) return;
              clearTimeout(segTimeout);
              completedSegments++;
              item.progress = Math.round((completedSegments / segments.length) * 100);
              if (completedSegments % 5 === 0) saveQueue();
              resolve();
            });
            segRes.on('error', () => {
              if (segTimedOut) return;
              clearTimeout(segTimeout);
              if (retries > 0) return fetchSeg(urlStr, retries - 1);
              failedSegments++;
              resolve();
            });
          }, (err) => {
            if (segTimedOut) return;
            if (retries > 0) return fetchSeg(urlStr, retries - 1);
            failedSegments++;
            resolve();
          });
        };
        fetchSeg(segUrl);
      });
    };

    try {
      for (let i = 0; i < segments.length; i++) {
        await downloadHLSSegment(segments[i], i);

        // Check if too many segments have failed
        const totalProcessed = completedSegments + failedSegments;
        if (failedSegments > 0 && totalProcessed > 10) {
          const failRate = failedSegments / totalProcessed;
          if (failRate > DOWNLOAD_CONFIG.maxHlsFailRate) {
            fileStream.destroy();
            try { fs.unlinkSync(hlsFilePath); } catch {}
            return onFailure(`Too many HLS segments failed (${failedSegments}/${totalProcessed}, ${Math.round(failRate * 100)}%)`);
          }
        }
      }

      fileStream.end();
      fileStream.on('finish', () => {
        if (failedSegments > 0) {
          console.warn(`[Download] ⚠️ HLS completed with ${failedSegments}/${segments.length} failed segments`);
        }
        item.status = 'completed';
        item.progress = 100;
        item.retryCount = 0;
        resetDownloadState();
        console.log(`[Download] ✅ Completed HLS "${item.filename}" (${completedSegments}/${segments.length} segments)`);
        saveQueue();
        processQueue();
      });
    } catch (err) {
      fileStream.destroy();
      try { fs.unlinkSync(hlsFilePath); } catch {}
      onFailure(err);
    }
  });

  res.on('error', (err) => {
    onFailure(err);
  });
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
