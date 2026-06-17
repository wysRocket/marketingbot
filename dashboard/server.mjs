import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
console.log('=== SERVER START ===');
console.log('CWD:', process.cwd());
console.log('__dirname:', __dirname);
console.log('PORT:', process.env.PORT);
console.log('dist exists:', fs.existsSync(path.join(__dirname, 'dist')));
console.log('index.html exists:', fs.existsSync(path.join(__dirname, 'dist', 'index.html')));
console.log('Auth:', process.env.DASHBOARD_PASSWORD ? 'enabled' : 'disabled');

const PORT = parseInt(process.env.PORT || '3000', 10);
const PUBLIC = path.join(__dirname, 'dist');
const PASSWORD = process.env.DASHBOARD_PASSWORD || '';
const TYPES = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.ico':'image/x-icon','.svg':'image/svg+xml' };

function checkAuth(req) {
  if (!PASSWORD) return true;
  const header = req.headers['authorization'] || '';
  if (!header.startsWith('Basic ')) return false;
  try {
    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
    const [user, pass] = decoded.split(':');
    return pass === PASSWORD;
  } catch { return false; }
}

function send401(res) {
  res.writeHead(401, {
    'WWW-Authenticate': 'Basic realm="Dashboard"',
    'Content-Type': 'text/html'
  });
  res.end('<h1>401 Unauthorized</h1>');
}

http.createServer((req, res) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

  // Health check bypasses auth (for Railway health checks)
  if (req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true }));
  }

  // All other requests require auth
  if (!checkAuth(req)) {
    return send401(res);
  }

  if (req.url === '/api/data') {
    try {
      const raw = fs.readFileSync(path.join(process.env.TELEMETRY_DIR || path.join(__dirname, '..', 'telemetry'), 'patchright.sessions.jsonl'), 'utf8');
      const sessions = raw.split('\n').filter(Boolean).slice(-500).map(l => JSON.parse(l));
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({ sessions, extEvents: [], swObservations: [], fingerprint: sessions.length + ':' + (sessions[sessions.length-1]?.recordedAt || '') }));
    } catch(e) {
      console.error('[API ERROR]', e.message);
      // Return empty data if telemetry file doesn't exist
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({ sessions: [], extEvents: [], swObservations: [], fingerprint: 'empty' }));
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
}).listen(PORT, '0.0.0.0', () => console.log(`=== LISTENING on ${PORT} ===`));
