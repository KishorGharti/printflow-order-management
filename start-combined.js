'use strict';

import { spawn } from 'child_process';
import net from 'net';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function isPortInUse(port) {
  return new Promise((resolve) => {
    const tester = net.createConnection({ port, host: '127.0.0.1' })
      .once('connect', () => {
        tester.destroy();
        resolve(true);
      })
      .once('error', () => {
        resolve(false);
      });
  });
}

async function start() {
  console.log('====================================================');
  console.log('🚀 Starting Print Ghar (Frontend + Backend Combined)');
  console.log('====================================================\n');

  const backendPort = 3001;
  const frontendPort = 3000;

  const backendRunning = await isPortInUse(backendPort);
  let backend = null;

  if (backendRunning) {
    console.log(`\x1b[36m[BACKEND 3001]\x1b[0m ℹ️ Backend API is already active and listening on port ${backendPort}.`);
  } else {
    console.log(`\x1b[36m[BACKEND 3001]\x1b[0m ⚡ Starting Backend Express server on port ${backendPort}...`);
    backend = spawn('node', ['src/index.js'], {
      cwd: path.join(__dirname, 'backend'),
      stdio: 'pipe',
      shell: true,
      env: process.env,
    });

    backend.stdout?.on('data', (data) => {
      data.toString().trim().split('\n').forEach((line) => {
        if (line) console.log(`\x1b[36m[BACKEND 3001]\x1b[0m ${line}`);
      });
    });

    backend.stderr?.on('data', (data) => {
      data.toString().trim().split('\n').forEach((line) => {
        if (line) console.error(`\x1b[31m[BACKEND ERROR]\x1b[0m ${line}`);
      });
    });
  }

  const frontendRunning = await isPortInUse(frontendPort);
  let frontend = null;

  if (frontendRunning) {
    console.log(`\x1b[32m[FRONTEND 3000]\x1b[0m ℹ️ Frontend server is already running on http://localhost:${frontendPort}`);
  } else {
    console.log(`\x1b[32m[FRONTEND 3000]\x1b[0m ⚡ Starting Frontend server on http://localhost:${frontendPort}...`);
    frontend = spawn('node', ['--env-file-if-exists=.env', 'server.js'], {
      cwd: __dirname,
      stdio: 'pipe',
      shell: true,
      env: process.env,
    });

    frontend.stdout?.on('data', (data) => {
      data.toString().trim().split('\n').forEach((line) => {
        if (line) console.log(`\x1b[32m[FRONTEND 3000]\x1b[0m ${line}`);
      });
    });

    frontend.stderr?.on('data', (data) => {
      data.toString().trim().split('\n').forEach((line) => {
        if (line) console.error(`\x1b[31m[FRONTEND ERROR]\x1b[0m ${line}`);
      });
    });
  }

  console.log('\n✅ System Ready: Open http://localhost:3000 in your browser.\n');

  function shutdown() {
    console.log('\n🛑 Shutting down Print Ghar servers...');
    try { if (backend) backend.kill(); } catch (_) {}
    try { if (frontend) frontend.kill(); } catch (_) {}
    process.exit(0);
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch(console.error);
