import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const root = process.cwd();
const distDir = path.join(root, 'dist');
const dataDir = path.join(root, 'data');
const leaderboardPath = path.join(dataDir, 'leaderboard.json');

function sortEntries(entries) {
  return [...entries]
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(a.achieved_at).getTime() - new Date(b.achieved_at).getTime();
    })
    .slice(0, 10);
}

function loadLeaderboard() {
  try {
    if (fs.existsSync(leaderboardPath)) {
      const parsed = JSON.parse(fs.readFileSync(leaderboardPath, 'utf8'));
      if (parsed && Array.isArray(parsed.entries)) {
        return { entries: sortEntries(parsed.entries) };
      }
    }
  } catch {
    // ignore corrupt file
  }
  return { entries: [] };
}

function saveLeaderboard(entries) {
  fs.mkdirSync(dataDir, { recursive: true });
  const payload = { entries: sortEntries(entries) };
  fs.writeFileSync(leaderboardPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return payload;
}

const args = process.argv.slice(2);
const exportIdx = args.indexOf('--export-leaderboard');
if (exportIdx !== -1) {
  const outPath = args[exportIdx + 1];
  if (!outPath) {
    process.stderr.write('Error: Missing output path for --export-leaderboard\n');
    process.exit(1);
  }
  const board = loadLeaderboard();
  fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(board, null, 2)}\n`, 'utf8');
  process.exit(0);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const port = Number(process.env.PORT || 4173);

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);

  if (url.pathname === '/api/leaderboard') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (req.method === 'GET') {
      res.end(JSON.stringify(loadLeaderboard()));
      return;
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        try {
          const entry = JSON.parse(body);
          if (
            typeof entry.name !== 'string' ||
            entry.name.length < 3 ||
            entry.name.length > 12 ||
            typeof entry.score !== 'number'
          ) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Invalid entry' }));
            return;
          }
          const current = loadLeaderboard();
          current.entries.push({
            name: entry.name,
            score: Math.round(entry.score),
            nights_won: Number(entry.nights_won) || 0,
            achieved_at: entry.achieved_at || new Date().toISOString(),
            seed: Number(entry.seed) || 0
          });
          const updated = saveLeaderboard(current.entries);
          res.end(JSON.stringify(updated));
        } catch {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Malformed JSON' }));
        }
      });
      return;
    }
  }

  let filePath = path.join(distDir, url.pathname === '/' ? 'index.html' : url.pathname);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(distDir, 'index.html');
  }
  const ext = path.extname(filePath);
  res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
  fs.createReadStream(filePath).pipe(res);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Đảo Đèn Lồng running at http://localhost:${port}`);
});
