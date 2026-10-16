import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || '';
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const WHATSAPP_API_VERSION = process.env.WHATSAPP_API_VERSION || 'v23.0';
const JSON_BODY_LIMIT = 64 * 1024;
const PDF_BODY_LIMIT = 8 * 1024 * 1024;
const WHATSAPP_TIMEOUT_MS = 15000;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.ts': 'text/javascript',
  '.tsx': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};
const APP_FILES = new Set([
  '/index.html',
  '/dist/app.js',
  '/owner-login.html',
  '/employee-login.html',
  '/assets/print-ghar-bill-logo.png',
  '/assets/login-hero-ribbon.jpg',
  '/assets/login-hero-first.png',
  '/assets/login-hero-clean.jpg',
  '/assets/login-hero-luxury.jpg',
  '/assets/login-hero-light-trails.jpg',
  '/assets/login-hero-neon-trails.jpg',
  '/developer.html',
  '/dist/developer.js',
]);

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(JSON.stringify(payload));
}

function serveFile(req, res, filePath) {
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  fs.readFile(filePath, (readErr, content) => {
    if (readErr) return sendJson(res, 404, { ok: false, error: 'File not found.' });
    res.writeHead(200, {
      'Content-Type': `${contentType}${contentType.startsWith('text/') || contentType === 'application/json' ? '; charset=utf-8' : ''}`,
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'X-Frame-Options': 'DENY',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://unpkg.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://res.cloudinary.com; frame-src 'self' blob:; connect-src 'self' https://res.cloudinary.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
      'Cache-Control': ['.html', '.js', '.css'].includes(ext) || filePath.includes('login-hero') ? 'no-cache, no-store, must-revalidate' : 'public, max-age=3600'
    });
    res.end(req.method === 'HEAD' ? undefined : content);
  });
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let tooLarge = false;
    req.on('data', chunk => {
      if (tooLarge) return;
      body += chunk;
      if (Buffer.byteLength(body, 'utf8') > JSON_BODY_LIMIT) {
        tooLarge = true;
        reject(Object.assign(new Error('Request body is too large.'), { statusCode: 413 }));
      }
    });
    req.on('end', () => {
      if (tooLarge) return;
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function readBuffer(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;
    req.on('data', chunk => {
      if (tooLarge) return;
      size += chunk.length;
      if (size > limit) {
        tooLarge = true;
        reject(Object.assign(new Error('PDF upload is too large.'), { statusCode: 413 }));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => { if (!tooLarge) resolve(Buffer.concat(chunks)); });
    req.on('error', reject);
  });
}

async function fetchWhatsApp(url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WHATSAPP_TIMEOUT_MS);
  try { return await fetch(url, { ...options, signal:controller.signal }); }
  finally { clearTimeout(timeout); }
}

async function handleWhatsApp(req, res) {
  try {
    if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) {
      return sendJson(res, 415, { ok: false, error: 'Content-Type must be application/json.' });
    }

    const { to, message, phoneNumberId, apiVersion } = await readJson(req);
    // Access tokens are server-only secrets. Never accept or persist them in browser requests.
    const token = String(WHATSAPP_ACCESS_TOKEN || '').trim();
    const phoneId = String(phoneNumberId || WHATSAPP_PHONE_NUMBER_ID || '').trim();
    const version = String(apiVersion || WHATSAPP_API_VERSION || 'v23.0').trim();

    if (!token || !phoneId) {
      return sendJson(res, 503, {
        ok: false,
        error: 'WhatsApp auto-send is not configured on the server.'
      });
    }
    if (!/^\d+$/.test(phoneId) || !/^v\d+\.\d+$/.test(version)) {
      return sendJson(res, 400, { ok: false, error: 'Invalid WhatsApp Phone ID or Graph API version.' });
    }
    const cleanTo = String(to || '').replace(/\D/g, '');
    const cleanMessage = String(message || '').trim();
    if (!/^\d{8,15}$/.test(cleanTo) || !cleanMessage) {
      return sendJson(res, 400, { ok: false, error: 'Missing WhatsApp number or message.' });
    }
    if (cleanMessage.length > 4096) {
      return sendJson(res, 400, { ok: false, error: 'WhatsApp message is too long.' });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), WHATSAPP_TIMEOUT_MS);
    const apiResponse = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanTo,
        type: 'text',
        text: { preview_url: false, body: cleanMessage }
      })
    }).finally(() => clearTimeout(timeout));

    const data = await apiResponse.json().catch(() => ({}));
    if (!apiResponse.ok) {
      return sendJson(res, apiResponse.status, { ok: false, error: data?.error?.message || 'WhatsApp API rejected the message.', details: data });
    }
    return sendJson(res, 200, { ok: true, data });
  } catch (err) {
    if (err?.name === 'AbortError') {
      return sendJson(res, 504, { ok: false, error: 'WhatsApp API timed out. Please try again.' });
    }
    const status = err instanceof SyntaxError ? 400 : (err?.statusCode || 500);
    return sendJson(res, status, { ok: false, error: status === 400 ? 'Invalid JSON request.' : (err?.message || 'Unable to send WhatsApp message.') });
  }
}

async function handleWhatsAppDocument(req, res) {
  try {
    const contentType = String(req.headers['content-type'] || '').toLowerCase();
    if (!contentType.startsWith('multipart/form-data;') || !contentType.includes('boundary=')) {
      return sendJson(res, 415, { ok:false, error:'Content-Type must be multipart/form-data.' });
    }
    const token = String(WHATSAPP_ACCESS_TOKEN || '').trim();
    if (!token || !WHATSAPP_PHONE_NUMBER_ID) {
      return sendJson(res, 503, { ok:false, error:'WhatsApp PDF sending is not configured. Please configure WhatsApp Cloud API in Print Ghar Settings.' });
    }
    const body = await readBuffer(req, PDF_BODY_LIMIT + 256 * 1024);
    const request = new Request('http://localhost/api/whatsapp/document', { method:'POST', headers:{ 'content-type':req.headers['content-type'] }, body });
    const form = await request.formData();
    const cleanTo = String(form.get('to') || '').replace(/\D/g, '');
    const caption = String(form.get('caption') || '').trim().slice(0, 1024);
    const requestedName = String(form.get('filename') || 'Print-Ghar-Statement.pdf');
    const safeName = requestedName.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').slice(0, 140);
    const phoneId = String(form.get('phoneNumberId') || WHATSAPP_PHONE_NUMBER_ID).trim();
    const version = String(form.get('apiVersion') || WHATSAPP_API_VERSION || 'v23.0').trim();
    const file = form.get('document');
    if (!/^\d{8,15}$/.test(cleanTo)) return sendJson(res, 400, { ok:false, error:'Missing or invalid WhatsApp recipient number.' });
    if (!/^\d+$/.test(phoneId) || !/^v\d+\.\d+$/.test(version)) return sendJson(res, 400, { ok:false, error:'Invalid WhatsApp Phone ID or Graph API version.' });
    if (!safeName.toLowerCase().endsWith('.pdf')) return sendJson(res, 400, { ok:false, error:'Statement filename must end in .pdf.' });
    if (!file || typeof file.arrayBuffer !== 'function' || file.type !== 'application/pdf') return sendJson(res, 400, { ok:false, error:'A PDF document is required.' });
    if (file.size <= 0 || file.size > PDF_BODY_LIMIT) return sendJson(res, 413, { ok:false, error:'PDF must be between 1 byte and 8 MB.' });
    const pdfBytes = Buffer.from(await file.arrayBuffer());
    if (pdfBytes.subarray(0, 5).toString('ascii') !== '%PDF-') return sendJson(res, 400, { ok:false, error:'The uploaded file is not a valid PDF document.' });

    const uploadForm = new FormData();
    uploadForm.append('messaging_product', 'whatsapp');
    uploadForm.append('type', 'application/pdf');
    uploadForm.append('file', new Blob([pdfBytes], { type:'application/pdf' }), safeName);
    const uploadResponse = await fetchWhatsApp(`https://graph.facebook.com/${version}/${phoneId}/media`, {
      method:'POST', headers:{ Authorization:`Bearer ${token}` }, body:uploadForm
    });
    const uploadData = await uploadResponse.json().catch(() => ({}));
    if (!uploadResponse.ok || !uploadData.id) {
      return sendJson(res, uploadResponse.status || 502, { ok:false, error:uploadData?.error?.message || 'WhatsApp rejected the PDF upload.' });
    }
    const sendResponse = await fetchWhatsApp(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
      method:'POST', headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' },
      body:JSON.stringify({ messaging_product:'whatsapp', recipient_type:'individual', to:cleanTo, type:'document', document:{ id:uploadData.id, filename:safeName, ...(caption ? { caption } : {}) } })
    });
    const sendData = await sendResponse.json().catch(() => ({}));
    if (!sendResponse.ok) return sendJson(res, sendResponse.status, { ok:false, error:sendData?.error?.message || 'WhatsApp rejected the document message.' });
    return sendJson(res, 200, { ok:true, mediaId:uploadData.id, messageId:sendData?.messages?.[0]?.id || '' });
  } catch (err) {
    if (err?.name === 'AbortError') return sendJson(res, 504, { ok:false, error:'WhatsApp API timed out. Please try again.' });
    return sendJson(res, err?.statusCode || 500, { ok:false, error:err?.message || 'Unable to send WhatsApp PDF.' });
  }
}

function proxyToBackend(req, res) {
  const backendPort = process.env.BACKEND_PORT || 3001;
  const options = {
    hostname: '127.0.0.1',
    port: backendPort,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: `127.0.0.1:${backendPort}` },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    sendJson(res, 503, {
      ok: false,
      error: `Backend API service is not reachable on port ${backendPort}. Start the backend server or run npm run dev:all.`,
      details: err.message,
    });
  });

  req.pipe(proxyReq, { end: true });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'POST' && url.pathname === '/api/whatsapp') {
    return handleWhatsApp(req, res);
  }
  if (req.method === 'POST' && url.pathname === '/api/whatsapp/document') {
    return handleWhatsAppDocument(req, res);
  }

  // Forward all other API requests & health checks to Express backend (Port 3001)
  if (url.pathname.startsWith('/api/') || url.pathname === '/health') {
    return proxyToBackend(req, res);
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return sendJson(res, 405, { ok: false, error: 'Method not allowed.' });
  }

  let reqUrl = url.pathname;
  if (reqUrl === '/') reqUrl = '/index.html';
  if (reqUrl === '/developer' || reqUrl === '/developer/') reqUrl = '/developer.html';
  // ── Dedicated login portals ──────────────────────────────────────────────
  if (reqUrl === '/owner/login' || reqUrl === '/owner/login/') reqUrl = '/owner-login.html';
  if (reqUrl === '/employee/login' || reqUrl === '/employee/login/') reqUrl = '/employee-login.html';
  if (reqUrl === '/admin/login' || reqUrl === '/admin/login/') reqUrl = '/developer.html';
  // ────────────────────────────────────────────────────────────────────────

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(reqUrl);
  } catch {
    return sendJson(res, 400, { ok: false, error: 'Invalid URL path.' });
  }
  decodedPath = decodedPath.replace(/\\/g, '/');
  if (!APP_FILES.has(decodedPath)) {
    // Keep client-side routes working without exposing source, settings, or project files.
    if (path.posix.extname(decodedPath)) return sendJson(res, 404, { ok: false, error: 'File not found.' });
    decodedPath = '/index.html';
  }
  const rootPath = path.resolve(__dirname);
  let filePath = path.resolve(rootPath, `.${decodedPath}`);
  if (filePath !== rootPath && !filePath.startsWith(rootPath + path.sep)) {
    return sendJson(res, 403, { ok: false, error: 'Forbidden path.' });
  }
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) return sendJson(res, 404, { ok: false, error: 'File not found.' });
    serveFile(req, res, filePath);
  });
});

server.listen(PORT, () => {
  console.log(`Print Ghar Order Manager running at http://localhost:${PORT}`);
  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    console.log('WhatsApp auto-send is OFF until WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID are configured.');
  }
});
