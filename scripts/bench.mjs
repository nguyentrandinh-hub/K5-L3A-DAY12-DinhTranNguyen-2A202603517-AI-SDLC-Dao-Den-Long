import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const distDir = path.join(root, 'dist');

function fail(msg, code = 1) {
  process.stderr.write(`Error: ${msg}\n`);
  process.exit(code);
}

let seed = 42;
let duration = 30;
let outPath = 'bench.json';
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--seed') seed = Number(argv[++i]);
  else if (argv[i] === '--duration') duration = Number(argv[++i]);
  else if (argv[i] === '--out') outPath = argv[++i];
  else fail(`Unknown argument: ${argv[i]}`);
}
if (!Number.isInteger(seed)) fail('Invalid --seed');
if (!Number.isFinite(duration) || duration <= 0) fail('Invalid --duration');

function findBrowser() {
  const candidates =
    process.platform === 'win32'
      ? [
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
          'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
        ]
      : process.platform === 'darwin'
        ? [
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Chromium.app/Contents/MacOS/Chromium',
            '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
          ]
        : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge'];

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

const procStartMs = performance.now();
let browserProc = null;
let finished = false;

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1');

  if (url.pathname === '/api/bench-result' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const result = {
          contract_version: '1.3',
          avg_fps: data.avg_fps,
          p1_low_fps: data.p1_low_fps,
          frame_ms_p95: data.frame_ms_p95,
          frames: data.frames,
          load_ms: Math.round(data.load_ms),
          peak_mem_mb: data.peak_mem_mb ?? null,
          vsync_off: true,
          renderer: data.renderer || 'Three.js 0.170.0 (WebGL2)',
          os: `${os.platform()} ${os.release()} (${os.arch()})`
        };
        fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
        fs.writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true }));
        finished = true;
        console.log(JSON.stringify(result, null, 2));
        setTimeout(() => {
          if (browserProc) browserProc.kill();
          server.close(() => process.exit(0));
        }, 150);
      } catch (err) {
        res.statusCode = 400;
        res.end(String(err));
      }
    });
    return;
  }

  let filePath = path.join(distDir, url.pathname === '/' ? 'index.html' : url.pathname);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(distDir, 'index.html');
  }
  const ext = path.extname(filePath);
  res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
  fs.createReadStream(filePath).pipe(res);
});

server.listen(0, '127.0.0.1', () => {
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 4174;
  const browser = findBrowser();
  if (!browser) {
    fail('No Chromium/Chrome/Edge browser found to run WebGL benchmark.');
  }

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-bench-'));
  const targetUrl = `http://127.0.0.1:${port}/?bench=1&seed=${seed}&duration=${duration}&t0=${Math.round(procStartMs)}`;

  browserProc = spawn(
    browser,
    [
      `--user-data-dir=${userDataDir}`,
      '--window-size=1280,720',
      '--disable-gpu-vsync',
      '--disable-frame-rate-limit',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--no-first-run',
      '--no-default-browser-check',
      '--autoplay-policy=no-user-gesture-required',
      `--app=${targetUrl}`
    ],
    { stdio: 'ignore' }
  );

  // Safety timeout (warmup 3s + duration + 25s buffer)
  setTimeout(() => {
    if (!finished) {
      if (browserProc) browserProc.kill();
      fail('Benchmark timed out waiting for result.');
    }
  }, (duration + 28) * 1000);
});
