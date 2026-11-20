import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const tmpDir = path.join(root, 'tmp', 'verify-phase1');
fs.mkdirSync(tmpDir, { recursive: true });

function runHeadless(args) {
  const res = spawnSync(process.execPath, [path.join(root, 'dist-sim', 'headless.js'), ...args], {
    encoding: 'utf8'
  });
  return res;
}

function writeJson(name, obj) {
  const p = path.join(tmpDir, name);
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf8');
  return p;
}

function readJsonl(filePath) {
  const text = fs.readFileSync(filePath, 'utf8').trim();
  return text.split('\n').map((line) => JSON.parse(line));
}

const results = [];

// Scenario 1: Pickup, Deposit, Lantern Lit, Win
{
  const sc = writeJson('sc_win.json', {
    player: { pos: [0, 0, 0], carried: 0, flames: 3 },
    random_motes: false,
    random_shades: false,
    motes: [
      [0, 0, 4],
      [0, 0, 8],
      [0, 0, 12]
    ],
    lanterns: [
      { id: 'L1', pos: [0, 0, 16], deposited: 0 },
      { id: 'L2', lit: true },
      { id: 'L3', lit: true },
      { id: 'L4', lit: true },
      { id: 'L5', lit: true }
    ],
    time_left_s: 200
  });
  const inp = writeJson('inp_win.json', {
    frames: [
      { tick: 0, move: [0, 1], cam_yaw_deg: 0 },
      { tick: 115, move: [0, 0], interact: true },
      { tick: 116, interact: false }
    ]
  });
  const out = path.join(tmpDir, 'out_win.jsonl');
  const res = runHeadless(['--seed', '42', '--night', '1', '--scenario', sc, '--inputs', inp, '--ticks', '300', '--out', out]);
  assert.equal(res.status, 0, res.stderr);
  const lines = readJsonl(out);
  assert.equal(lines[0].type, 'snapshot');
  assert.equal(lines[0].tick, 0);
  assert.equal(lines[0].score, 0);
  assert.equal(lines.filter((r) => r.type === 'event' && r.name === 'mote_picked').length, 3);
  assert.ok(lines.some((r) => r.type === 'event' && r.name === 'deposit' && r.data.lantern_id === 'L1'));
  assert.ok(lines.some((r) => r.type === 'event' && r.name === 'lantern_lit' && r.data.lantern_id === 'L1'));
  const end = lines[lines.length - 1];
  assert.equal(end.type, 'end');
  assert.equal(end.state, 'won');
  results.push(`PASS [S1 Win Flow]: ticks=${end.ticks}, score=${end.score}`);
}

// Scenario 2: Pulse stun & push + safe_radius repulsion
{
  const sc = writeJson('sc_pulse.json', {
    player: { pos: [0, 0, 0], carried: 3, flames: 3 },
    random_motes: false,
    random_shades: false,
    shades: [{ id: 'S1', pos: [6, 1, 0] }]
  });
  const inp = writeJson('inp_pulse.json', {
    frames: [
      { tick: 0, pulse: true },
      { tick: 1, pulse: false }
    ]
  });
  const out = path.join(tmpDir, 'out_pulse.jsonl');
  const res = runHeadless(['--seed', '99', '--night', '1', '--scenario', sc, '--inputs', inp, '--ticks', '60', '--out', out, '--snapshot-every', '10']);
  assert.equal(res.status, 0, res.stderr);
  const lines = readJsonl(out);
  const pulseEv = lines.find((r) => r.type === 'event' && r.name === 'pulse');
  assert.ok(pulseEv);
  assert.deepEqual(pulseEv.data.stunned_ids, ['S1']);
  const snap10 = lines.find((r) => r.type === 'snapshot' && r.tick === 10);
  assert.equal(snap10.shades[0].state, 'stunned');
  results.push(`PASS [S2 Pulse Stun/Push]: shade pushed to x=${snap10.shades[0].pos[0]}, state=${snap10.shades[0].state}`);
}

// Scenario 3: Shade hit & Loss (no_flames)
{
  const sc = writeJson('sc_loss.json', {
    player: { pos: [0, 0, 0], carried: 4, flames: 1 },
    random_motes: false,
    random_shades: false,
    shades: [{ id: 'S1', pos: [3, 1, 0] }]
  });
  const out = path.join(tmpDir, 'out_loss.jsonl');
  const res = runHeadless(['--seed', '12', '--night', '1', '--scenario', sc, '--ticks', '120', '--out', out]);
  assert.equal(res.status, 0, res.stderr);
  const lines = readJsonl(out);
  const hit = lines.find((r) => r.type === 'event' && r.name === 'player_hit');
  assert.ok(hit);
  assert.equal(hit.data.by, 'shade');
  assert.equal(hit.data.dropped, 2);
  const end = lines[lines.length - 1];
  assert.equal(end.state, 'lost');
  results.push(`PASS [S3 Shade Hit & Loss]: hit at tick=${hit.tick}, dropped=${hit.data.dropped}, end=${end.state}`);
}

// Scenario 4: Determinism check (same seed, random_motes=true, random_shades=true, 600 ticks x 2 runs)
{
  const inp = writeJson('inp_det.json', {
    frames: [
      { tick: 0, move: [0.6, 0.8], cam_yaw_deg: 30 },
      { tick: 120, move: [-0.5, 0.5], jump: true },
      { tick: 121, jump: false },
      { tick: 240, move: [0, -1], cam_yaw_deg: 120 }
    ]
  });
  const outA = path.join(tmpDir, 'det_a.jsonl');
  const outB = path.join(tmpDir, 'det_b.jsonl');
  const rA = runHeadless(['--seed', '2026', '--night', '1', '--inputs', inp, '--ticks', '600', '--out', outA]);
  const rB = runHeadless(['--seed', '2026', '--night', '1', '--inputs', inp, '--ticks', '600', '--out', outB]);
  assert.equal(rA.status, 0, rA.stderr);
  assert.equal(rB.status, 0, rB.stderr);
  const contentA = fs.readFileSync(outA, 'utf8');
  const contentB = fs.readFileSync(outB, 'utf8');
  assert.equal(contentA, contentB, 'Determinism check failed: outputs differ!');
  results.push(`PASS [S4 Determinism]: 600 ticks x 2 runs byte-for-byte identical (${contentA.length} bytes)`);
}

// Scenario 5: Invalid inputs file -> exit code 2
{
  const badInp = writeJson('bad_inp.json', {
    frames: [
      { tick: 10, move: [0, 1] },
      { tick: 10, move: [0, 0] }
    ]
  });
  const out = path.join(tmpDir, 'out_bad.jsonl');
  const res = runHeadless(['--seed', '1', '--night', '1', '--inputs', badInp, '--ticks', '60', '--out', out]);
  assert.equal(res.status, 2, `Expected exit code 2, got ${res.status}`);
  assert.ok(res.stderr.length > 0, 'Expected error message on stderr');
  results.push(`PASS [S5 Invalid Input Exit 2]: exit=${res.status}, stderr="${res.stderr.trim()}"`);
}

for (const line of results) {
  console.log(line);
}
