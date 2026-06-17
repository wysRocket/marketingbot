import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
console.log('=== SERVER START ===');
console.log('CWD:', process.cwd());
console.log('PORT:', process.env.PORT);
console.log('Auth:', process.env.GITHUB_CLIENT_ID ? 'github' : 'disabled');

const PORT = parseInt(process.env.PORT || '3000', 10);
const PUBLIC = path.join(__dirname, 'dist');
const TYPES = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.ico':'image/x-icon','.svg':'image/svg+xml' };

// --- GitHub OAuth config ---
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const COOKIE_NAME = 'dash_sess';
const ALLOWED_USERS = (process.env.ALLOWED_GITHUB_USERS || '').split(',').map(s => s.trim()).filter(Boolean);

// --- Session store (in-memory) ---
const sessions = new Map();

function createSession(username) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { username, created: Date.now() });
  return token;
}

function validateSession(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  // Expire after 24h
  if (Date.now() - session.created > 86400000) {
    sessions.delete(token);
    return null;
  }
  return session;
}

function parseCookies(header) {
  const cookies = {};
  header.split(';').forEach(c => {
    const [k, v] = c.trim().split('=');
    if (k) cookies[k] = decodeURIComponent(v || '');
  });
  return cookies;
}

function setCookie(res, name, value, maxAge) {
  res.setHeader('Set-Cookie', `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`);
}

function clearCookie(res, name) {
  res.setHeader('Set-Cookie', `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

function httpsPost(url, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'User-Agent': 'marketingbot-dashboard',
      },
    }, res => {
      let chunks = '';
      res.on('data', d => chunks += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(chunks) }); }
        catch { resolve({ status: res.statusCode, body: chunks }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function httpsGet(url, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.get({
      hostname: u.hostname,
      path: u.pathname,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'User-Agent': 'marketingbot-dashboard',
      },
    }, res => {
      let chunks = '';
      res.on('data', d => chunks += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(chunks) }); }
        catch { resolve({ status: res.statusCode, body: chunks }); }
      });
    });
    req.on('error', reject);
  });
}

// --- Auth check ---
function isAuthenticated(req) {
  if (!GITHUB_CLIENT_ID) return true; // No OAuth configured = open access
  return validateSession(req) !== null;
}

function requireAuth(res) {
  res.writeHead(401, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'unauthorized' }));
}

// --- Server ---
http.createServer(async (req, res) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

  // Health check (no auth)
  if (req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true }));
  }

  // --- GitHub OAuth endpoints ---
  if (req.url === '/api/auth/status') {
    const session = validateSession(req);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      authenticated: !!session,
      user: session ? { login: session.username } : null,
      oauthEnabled: !!GITHUB_CLIENT_ID,
    }));
  }

  if (req.url === '/api/auth/login') {
    if (!GITHUB_CLIENT_ID) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'OAuth not configured' }));
    }
    const state = crypto.randomBytes(16).toString('hex');
    // Store state in a temporary cookie for CSRF protection
    setCookie(res, 'dash_oauth_state', state, 600);
    const params = new URLSearchParams({
      client_id: GITHUB_CLIENT_ID,
      redirect_uri: `${process.env.DASHBOARD_URL || 'https://dashboard.wysmyfree.com'}/api/auth/callback`,
      scope: 'read:user',
      state,
    });
    res.writeHead(302, { Location: `https://github.com/login/oauth/authorize?${params}` });
    return res.end();
  }

  if (req.url.startsWith('/api/auth/callback')) {
    const url = new URL(req.url, `http://localhost`);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const cookies = parseCookies(req.headers.cookie || '');
    const savedState = cookies['dash_oauth_state'];

    if (!code || !state || state !== savedState) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      return res.end('<h1>Auth failed</h1><p>Invalid or missing state. <a href="/">Go back</a></p>');
    }

    try {
      // Exchange code for access token
      const tokenRes = await httpsPost('https://github.com/login/oauth/access_token', {
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
      });

      if (!tokenRes.body.access_token) {
        throw new Error('No access token received');
      }

      // Get user info
      const userRes = await httpsGet('https://api.github.com/user', tokenRes.body.access_token);
      if (!userRes.body.login) {
        throw new Error('Could not fetch user info');
      }

      // Check allowed users
      if (ALLOWED_USERS.length > 0 && !ALLOWED_USERS.includes(userRes.body.login)) {
        res.writeHead(403, { 'Content-Type': 'text/html' });
        return res.end(`<h1>Access denied</h1><p>User @${userRes.body.login} is not authorized. <a href="/">Go back</a></p>`);
      }

      // Create session
      const sessionToken = createSession(userRes.body.login);
      setCookie(res, COOKIE_NAME, sessionToken, 86400);
      clearCookie(res, 'dash_oauth_state');

      // Redirect to dashboard
      res.writeHead(302, { Location: '/' });
      return res.end();
    } catch (e) {
      console.error('[OAUTH ERROR]', e.message);
      res.writeHead(500, { 'Content-Type': 'text/html' });
      return res.end(`<h1>Auth error</h1><p>${e.message}</p><a href="/">Go back</a>`);
    }
  }

  if (req.url === '/api/auth/logout') {
    const cookies = parseCookies(req.headers.cookie || '');
    const token = cookies[COOKIE_NAME];
    if (token) sessions.delete(token);
    clearCookie(res, COOKIE_NAME);
    res.writeHead(302, { Location: '/' });
    return res.end();
  }

  // --- Protected API ---
  if (req.url === '/api/data') {
    if (!isAuthenticated(req)) return requireAuth(res);
    try {
      const raw = fs.readFileSync(path.join(process.env.TELEMETRY_DIR || path.join(__dirname, '..', 'telemetry'), 'patchright.sessions.jsonl'), 'utf8');
      const sessions = raw.split('\n').filter(Boolean).slice(-500).map(l => JSON.parse(l));
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({ sessions, extEvents: [], swObservations: [], fingerprint: sessions.length + ':' + (sessions[sessions.length-1]?.recordedAt || '') }));
    } catch(e) {
      console.error('[API ERROR]', e.message);
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({ sessions: [], extEvents: [], swObservations: [], fingerprint: 'empty' }));
    }
  }

  // --- Static files (protected) ---
  if (!isAuthenticated(req)) {
    // Serve login page for HTML requests
    if (!req.url.startsWith('/api') && (req.url === '/' || !req.url.includes('.'))) {
      const loginHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login - Marketingbot Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0b0d11; color: #c9d1d9; display: flex; align-items: center; justify-content: center; height: 100vh; }
    .login-box { background: #11151c; border: 1px solid #2a2f3a; border-radius: 12px; padding: 40px; text-align: center; max-width: 360px; width: 100%; }
    .logo { width: 48px; height: 48px; border-radius: 12px; background: linear-gradient(135deg, #f4c430, #f59e0b); display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 700; color: #000; margin: 0 auto 20px; }
    h1 { font-size: 18px; margin-bottom: 8px; color: #e6edf3; }
    p { font-size: 13px; color: #8b949e; margin-bottom: 24px; }
    .btn { display: inline-flex; align-items: center; gap: 8px; background: #238636; color: #fff; border: none; border-radius: 8px; padding: 12px 24px; font-size: 14px; font-weight: 600; cursor: pointer; text-decoration: none; transition: background 0.2s; }
    .btn:hover { background: #2ea043; }
    .btn svg { width: 18px; height: 18px; }
  </style>
</head>
<body>
  <div class="login-box">
    <div class="logo">M</div>
    <h1>Marketingbot Dashboard</h1>
    <p>Sign in with GitHub to access your dashboard</p>
    <a href="/api/auth/login" class="btn">
      <svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
      Sign in with GitHub
    </a>
  </div>
</body>
</html>`;
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end(loginHtml);
    }
    // For non-HTML unauthenticated requests, return 401
    if (req.url.startsWith('/api')) {
      return requireAuth(res);
    }
    // For static assets, still serve them (they're public)
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
