const http = require('http');
const fs = require('fs');
const path = require('path');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

const s = http.createServer((req, res) => {
  const f = path.join('.', decodeURIComponent(req.url.split('?')[0]));
  try {
    const d = fs.readFileSync(f);
    const ext = path.extname(f).toLowerCase();
    res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream' });
    res.end(d);
  } catch (e) {
    res.writeHead(404);
    res.end('not found');
  }
});

s.listen(9955, () => console.log('Server on http://localhost:9955'));
