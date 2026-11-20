import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const tmpDir = path.join(root, 'tmp', 'verify-phase4');
fs.mkdirSync(tmpDir, { recursive: true });

// 1. Run Phase 3 regression scenarios first
const p3 = spawnSync(process.execPath, [path.join(root, 'scripts', 'verify-phase3.mjs')], {
  encoding: 'utf8'
});
if (p3.stdout) process.stdout.write(p3.stdout);
if (p3.status !== 0) {
  process.stderr.write(p3.stderr || 'Phase 3 regression failed\n');
  process.exit(p3.status ?? 1);
}

// 2. Run Soak Test (10 nights, seed 7)
const soakOut = path.join(tmpDir, 'soak-test.json');
const soakRes = spawnSync(
  process.execPath,
  ['--max-semi-space-size=2', '--expose-gc', path.join(root, 'dist-sim', 'soak.js'), '--seed', '7', '--nights', '10', '--out', soakOut],
  { encoding: 'utf8' }
);
assert.equal(soakRes.status, 0, soakRes.stderr);
const soakData = JSON.parse(fs.readFileSync(soakOut, 'utf8'));
assert.equal(soakData.nights, 10);
assert.equal(soakData.crashes, 0);
assert.equal(soakData.results.length, 10);
assert.ok(
  soakData.mem_end_mb <= 1.2 * soakData.mem_start_mb,
  `Memory grew > 1.2x: start=${soakData.mem_start_mb}MB end=${soakData.mem_end_mb}MB`
);
console.log(
  `PASS [S7 Soak Test 10 Nights]: crashes=${soakData.crashes}, mem=${soakData.mem_start_mb}->${soakData.mem_end_mb}MB, duration=${soakData.duration_s}s`
);

// 3. Test --export-leaderboard CLI contract
const lbOut = path.join(tmpDir, 'exported-lb.json');
const lbRes = spawnSync(
  process.execPath,
  [path.join(root, 'scripts', 'run-game.mjs'), '--export-leaderboard', lbOut],
  { encoding: 'utf8' }
);
assert.equal(lbRes.status, 0, lbRes.stderr);
const lbData = JSON.parse(fs.readFileSync(lbOut, 'utf8'));
assert.ok(Array.isArray(lbData.entries), 'Expected { entries: [...] }');
console.log(`PASS [S8 Export Leaderboard CLI]: exported ${lbData.entries.length} entries cleanly`);
