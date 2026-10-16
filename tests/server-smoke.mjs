import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { after, before, test } from 'node:test';

const port = 31000 + Math.floor(Math.random() * 1000);
const origin = `http://127.0.0.1:${port}`;
let server;

const waitForServer = async () => {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${origin}/`, { method: 'HEAD' });
      if (response.ok) return;
    } catch {
      // The process may still be starting.
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('Test server did not start within 5 seconds.');
};

before(async () => {
  server = spawn(process.execPath, ['server.js'], {
    cwd: new URL('../', import.meta.url),
    env: {
      ...process.env,
      PORT: String(port),
      WHATSAPP_ACCESS_TOKEN: '',
      WHATSAPP_PHONE_NUMBER_ID: ''
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  await waitForServer();
});

after(() => {
  if (server && !server.killed) server.kill();
});

test('serves the app with security headers', async () => {
  const response = await fetch(`${origin}/`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /^text\/html/);
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.match(response.headers.get('content-security-policy') || '', /frame-ancestors 'none'/);
  const html = await response.text();
  assert.match(html, /Print Ghar/);
  assert.match(html, /app-skeleton/);
});

test('serves client routes without exposing project files', async () => {
  assert.equal((await fetch(`${origin}/orders`)).status, 200);
  assert.equal((await fetch(`${origin}/assets/print-ghar-bill-logo.png`)).status, 200);
  const appResponse = await fetch(`${origin}/dist/app.js`);
  assert.equal(appResponse.status, 200);
  const appScript = await appResponse.text();
  assert.match(appScript, /Print Bill/);
  assert.match(appScript, /Design & Reference Files/);
  assert.match(appScript, /jpg.*jpeg.*png.*pdf.*tif.*tiff.*psd/);
  assert.match(appScript, /psb.*ai.*eps.*svg.*cdr.*dxf.*dwg/);
  assert.match(appScript, /Keyboard shortcuts/);
  assert.match(appScript, /Back to top/);
  assert.match(appScript, /Enter Job Number \*/);
  assert.match(appScript, /before moving .* to Progress/);
  for (const privatePath of ['/server.js', '/package.json', '/src/types/index.ts', '/README_RUNTIME.txt']) {
    assert.equal((await fetch(`${origin}${privatePath}`)).status, 404, privatePath);
  }
});

test('rejects malformed or non-JSON API requests', async () => {
  const wrongType = await fetch(`${origin}/api/whatsapp`, { method: 'POST', body: 'hello' });
  assert.equal(wrongType.status, 415);

  const malformed = await fetch(`${origin}/api/whatsapp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{not-json'
  });
  assert.equal(malformed.status, 400);
});

test('never accepts a WhatsApp token supplied by the browser', async () => {
  const response = await fetch(`${origin}/api/whatsapp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: '9779800000000',
      message: 'test',
      phoneNumberId: '123456',
      accessToken: 'browser-supplied-token-must-be-ignored'
    })
  });
  assert.equal(response.status, 503);
});

test('WhatsApp document endpoint requires multipart PDF and server credentials', async () => {
  const wrongType = await fetch(`${origin}/api/whatsapp/document`, {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body:JSON.stringify({ to:'9779800000000' })
  });
  assert.equal(wrongType.status, 415);

  const form = new FormData();
  form.append('to', '9779800000000');
  form.append('filename', 'statement.pdf');
  form.append('document', new Blob(['%PDF-1.4\n%%EOF'], { type:'application/pdf' }), 'statement.pdf');
  const unconfigured = await fetch(`${origin}/api/whatsapp/document`, { method:'POST', body:form });
  assert.equal(unconfigured.status, 503);
  assert.match((await unconfigured.json()).error, /not configured/i);
});
