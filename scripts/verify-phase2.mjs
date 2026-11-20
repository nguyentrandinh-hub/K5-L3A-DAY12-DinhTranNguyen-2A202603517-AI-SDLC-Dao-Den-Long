import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const tmpDir = path.join(root, 'tmp', 'verify-phase2');
fs.mkdirSync(tmpDir, { recursive: true });

function runHeadless(args) {
  return spawnSync(process.execPath, [path.join(root, 'dist-sim', 'headless.js'), ...args], {
    encoding: 'utf8'
  });
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

// S1: Night 1 Regression — Pickup, Deposit, Lantern Lit, Win + safe zone push
{
  const sc = writeJson('sc_n1_win.json', {
    player: { pos: [0, 0, 23.5], carried: 10, flames: 3 },
    random_motes: false,
    random_shades: false,
    shades: [{ id: 'S1', pos: [0, 1, 22], state: 'chase' }],
    lanterns: [
      { id: 'L1', pos: [0, 0, 25], deposited: 0 },
      { id: 'L2', lit: true },
      { id: 'L3', lit: true },
      { id: 'L4', lit: true },
      { id: 'L5', lit: true }
    ],
    time_left_s: 200
  });
  const inp = writeJson('inp_n1_win.json', {
    frames: [
      { tick: 0, interact: true },
      { tick: 1, interact: false }
    ]
  });
  const out = path.join(tmpDir, 'out_n1_win.jsonl');
  const res = runHeadless(['--seed', '42', '--night', '1', '--scenario', sc, '--inputs', inp, '--ticks', '60', '--out', out]);
  assert.equal(res.status, 0, res.stderr);
  const lines = readJsonl(out);
  assert.equal(lines[0].tick, 0);
  assert.equal(lines[0].night, 1);
  assert.ok(lines.some((r) => r.type === 'event' && r.name === 'lantern_lit' && r.data.lantern_id === 'L1'));
  const end = lines[lines.length - 1];
  assert.equal(end.state, 'won');
  results.push(`PASS [S1 Night 1 Win Regression]: ticks=${end.ticks}, score=${end.score}`);
}

// S2: Dash + Charm (Night 2)
{
  const sc = writeJson('sc_n2_charm_dash.json', {
    player: { pos: [35, 0, 0], carried: 0, flames: 3 },
    random_motes: false,
    random_shades: false,
    random_drifters: false
  });
  const inp = writeJson('inp_n2_charm_dash.json', {
    frames: [
      { tick: 0, move: [0, 1] },
      { tick: 2, dash: true },
      { tick: 3, dash: false },
      { tick: 16, dash: true },
      { tick: 17, dash: false }
    ]
  });
  const out = path.join(tmpDir, 'out_n2_charm.jsonl');
  const res = runHeadless(['--seed', '11', '--night', '2', '--scenario', sc, '--inputs', inp, '--ticks', '40', '--out', out]);
  assert.equal(res.status, 0, res.stderr);
  const lines = readJsonl(out);
  assert.ok(lines.some((r) => r.type === 'event' && r.name === 'charm_picked' && r.data.charm_id === 'C1'));
  assert.equal(lines.filter((r) => r.type === 'event' && r.name === 'dash').length, 2);
  results.push(`PASS [S2 Night 2 Charm + Zero-CD Dash]: 2 dashes triggered under charm`);
}

// S3: Jump Pad (Night 2 Island A -> Island B)
{
  const sc = writeJson('sc_n2_pad.json', {
    player: { pos: [20, 0, 18], carried: 0, flames: 3 },
    random_motes: false,
    random_shades: false,
    random_drifters: false
  });
  const out = path.join(tmpDir, 'out_n2_pad.jsonl');
  const res = runHeadless(['--seed', '12', '--night', '2', '--scenario', sc, '--ticks', '110', '--out', out, '--snapshot-every', '10']);
  assert.equal(res.status, 0, res.stderr);
  const lines = readJsonl(out);
  const snapEnd = lines.filter((r) => r.type === 'snapshot').pop();
  assert.ok(snapEnd.player.pos[0] > 45, `Expected landing on Island B (x>45), got x=${snapEnd.player.pos[0]}`);
  assert.equal(snapEnd.player.grounded, true);
  results.push(`PASS [S3 Night 2 Jump Pad]: landed on Island B at x=${snapEnd.player.pos[0]}, z=${snapEnd.player.pos[2]}`);
}

// S4: Drifter Steal & Pulse Drop (Night 2)
{
  const sc = writeJson('sc_n2_drifter.json', {
    player: { pos: [0, 0, 0], carried: 6, flames: 3 },
    random_motes: false,
    random_shades: false,
    random_drifters: false,
    drifters: [{ id: 'D1', pos: [0.5, 1.5, 0], state: 'chase' }]
  });
  const inp = writeJson('inp_n2_drifter.json', {
    frames: [
      { tick: 1, pulse: true },
      { tick: 2, pulse: false }
    ]
  });
  const out = path.join(tmpDir, 'out_n2_drifter.jsonl');
  const res = runHeadless(['--seed', '13', '--night', '2', '--scenario', sc, '--inputs', inp, '--ticks', '30', '--out', out]);
  assert.equal(res.status, 0, res.stderr);
  const lines = readJsonl(out);
  assert.ok(lines.some((r) => r.type === 'event' && r.name === 'drifter_steal' && r.data.amount === 3));
  assert.ok(lines.some((r) => r.type === 'event' && r.name === 'drifter_drop' && r.data.amount === 3));
  results.push(`PASS [S4 Drifter Steal & Pulse Drop]: stole 3 motes, dropped 3 on pulse`);
}

// S5: Fall off Island & Respawn (Night 1)
{
  const sc = writeJson('sc_fall.json', {
    player: { pos: [41, 0, 0], carried: 5, flames: 2 },
    random_motes: false,
    random_shades: false
  });
  const out = path.join(tmpDir, 'out_fall.jsonl');
  const res = runHeadless(['--seed', '14', '--night', '1', '--scenario', sc, '--ticks', '140', '--out', out, '--snapshot-every', '20']);
  assert.equal(res.status, 0, res.stderr);
  const lines = readJsonl(out);
  const hit = lines.find((r) => r.type === 'event' && r.name === 'player_hit' && r.data.by === 'fall');
  assert.ok(hit);
  assert.equal(hit.data.lost, 5);
  const lastSnap = lines.filter((r) => r.type === 'snapshot').pop();
  assert.equal(lastSnap.player.pos[0], 0);
  results.push(`PASS [S5 Fall & Respawn]: hit at tick=${hit.tick}, lost=${hit.data.lost}, respawned at origin`);
}

// S6: Pause & Resume
{
  const sc = writeJson('sc_pause.json', {
    random_motes: false,
    random_shades: false
  });
  const inp = writeJson('inp_pause.json', {
    frames: [
      { tick: 5, pause: true },
      { tick: 6, pause: false },
      { tick: 25, pause: true },
      { tick: 26, pause: false }
    ]
  });
  const out = path.join(tmpDir, 'out_pause.jsonl');
  const res = runHeadless(['--seed', '15', '--night', '1', '--scenario', sc, '--inputs', inp, '--ticks', '40', '--out', out, '--snapshot-every', '10']);
  assert.equal(res.status, 0, res.stderr);
  const lines = readJsonl(out);
  const snap20 = lines.find((r) => r.type === 'snapshot' && r.tick === 20);
  assert.equal(snap20.state, 'paused');
  assert.equal(snap20.sim_tick, 5);
  results.push(`PASS [S6 Pause/Resume]: tick=20 state=paused sim_tick=${snap20.sim_tick}`);
}

// S7: Night 3 Wind + Determinism (2000 ticks x 2 runs)
{
  const outA = path.join(tmpDir, 'out_n3_a.jsonl');
  const outB = path.join(tmpDir, 'out_n3_b.jsonl');
  const rA = runHeadless(['--seed', '2026', '--night', '3', '--ticks', '2000', '--out', outA, '--snapshot-every', '100']);
  const rB = runHeadless(['--seed', '2026', '--night', '3', '--ticks', '2000', '--out', outB, '--snapshot-every', '100']);
  assert.equal(rA.status, 0, rA.stderr);
  assert.equal(rB.status, 0, rB.stderr);
  const txtA = fs.readFileSync(outA, 'utf8');
  const txtB = fs.readFileSync(outB, 'utf8');
  assert.equal(txtA, txtB, 'Night 3 determinism failed!');
  const lines = txtA.trim().split('\n').map((l) => JSON.parse(l));
  assert.ok(lines.some((r) => r.type === 'snapshot' && r.wind && r.wind.active === true));
  results.push(`PASS [S7 Night 3 Wind & Determinism]: 2000 ticks x 2 runs identical (${txtA.length} bytes), wind activated`);
}

// S8: Full Night 3 Performance Benchmark (21,600 ticks <= 30s)
{
  const outPerf = path.join(tmpDir, 'out_perf.jsonl');
  const t0 = performance.now();
  const res = runHeadless(['--seed', '777', '--night', '3', '--ticks', '21600', '--out', outPerf, '--snapshot-every', '60']);
  const elapsedS = (performance.now() - t0) / 1000;
  assert.equal(res.status, 0, res.stderr);
  assert.ok(elapsedS <= 30, `Performance exceeded 30s: ${elapsedS.toFixed(2)}s`);
  results.push(`PASS [S8 Full Night Perf 21,600 ticks]: completed in ${elapsedS.toFixed(2)}s (limit <= 30s)`);
}

// S9: Invalid Input Exit Code 2
{
  const bad = writeJson('bad_inp.json', { frames: [{ tick: 5 }, { tick: 3 }] });
  const out = path.join(tmpDir, 'out_bad.jsonl');
  const res = runHeadless(['--seed', '1', '--night', '1', '--inputs', bad, '--ticks', '10', '--out', out]);
  assert.equal(res.status, 2);
  results.push(`PASS [S9 Invalid Input Exit 2]: exit=${res.status}`);
}

for (const line of results) {
  console.log(line);
}
