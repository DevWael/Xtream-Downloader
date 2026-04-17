import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import http from 'http';
import https from 'https';
import { URL } from 'url';

function proxyRequest(targetUrlStr: string, res: http.ServerResponse, originalFilename: string) {
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
            await new Promise<void>((resolve) => {
              const segUrlStr = segments[i];
              const segUrl = new URL(segUrlStr);
              const segClient = segUrl.protocol === 'https:' ? https : http;
              
              const fetchSegment = (urlObj: URL, retries = 3) => {
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

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'force-download-proxy',
      configureServer(server) {
        server.middlewares.use('/api/proxy', (req, res, _next) => {
          try {
            const urlObj = new URL(req.url || '', `http://${req.headers.host}`);
            const targetUrlStr = urlObj.searchParams.get('url');
            
            if (!targetUrlStr) {
              res.statusCode = 400;
              return res.end('Missing target url');
            }

            const targetUrl = new URL(targetUrlStr);
            const client = targetUrl.protocol === 'https:' ? https : http;

            client.get(targetUrl, (upstreamRes) => {
              res.statusCode = upstreamRes.statusCode || 200;
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
              res.statusCode = 500;
              res.end('API Proxy Error');
            });
          } catch (e) {
            res.statusCode = 500;
            res.end('Internal Server Error');
          }
        });

        server.middlewares.use('/api/download', (req, res, _next) => {
          try {
            const urlObj = new URL(req.url || '', `http://${req.headers.host}`);
            const targetUrl = urlObj.searchParams.get('url');
            const filename = urlObj.searchParams.get('filename') || 'download.mp4';
            
            if (!targetUrl) {
              res.statusCode = 400;
              return res.end('Missing target url');
            }

            console.log(`Proxying download for: ${targetUrl}`);
            proxyRequest(targetUrl, res, filename);

          } catch (e) {
            console.error('Download Proxy Error:', e);
            res.statusCode = 500;
            res.end('Internal Server Error');
          }
        });
      }
    }
  ],
})
