import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3000', 10);
const PUBLIC = path.join(__dirname, 'dist');
const TYPES = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.ico':'image/x-icon','.svg':'image/svg+xml' };

http.createServer((req, res) => {
  if (req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true }));
  }
  if (req.url === '/api/data') {
    try {
      const raw = fs.readFileSync(path.join(process.env.TELEMETRY_DIR || path.join(__dirname, '..', 'telemetry'), 'patchright.sessions.jsonl'), 'utf8');
      const sessions = raw.split('\n').filter(Boolean).slice(-500).map(l => JSON.parse(l));
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({ sessions, extEvents: [], swObservations: [], fingerprint: sessions.length + ':' + (sessions[sessions.length-1]?.recordedAt || '') }));
    } catch(e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: e.message }));
    }
  }
  let file = req.url === '/' ? 'index.html' : req.url.slice(1);
  const ext = path.extname(file);
  try {
    const content = fs.readFileSync(path.join(PUBLIC, file));
    res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream' });
    res.end(content);
  } catch {
    if (!req.url.startsWith('/api')) {
      const idx = fs.readFileSync(path.join(PUBLIC, 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end(idx);
    }
    res.writeHead(404);
    res.end('Not found');
  }
}).listen(PORT, '0.0.0.0', () => console.log(`Dashboard at http://localhost:${PORT}`));
