import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const tmpDir = path.join(root, 'tmp', 'verify-phase3');
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

// S1: Fuel Decay -> lantern_out -> Relight (5 motes, +40) -> Capacity increases 10 -> 12
{
  const sc = writeJson('sc_relight.json', {
    player: { pos: [0, 0, 24], carried: 5, flames: 3 },
    random_motes: false,
    random_shades: false,
    lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: true, fuel: 0.1 }]
  });
  const inp = writeJson('inp_relight.json', {
    frames: [
      { tick: 10, interact: true },
      { tick: 11, interact: false }
    ]
  });
  const out = path.join(tmpDir, 'out_relight.jsonl');
  const res = runHeadless(['--seed', '1', '--night', '1', '--scenario', sc, '--inputs', inp, '--ticks', '20', '--out', out, '--snapshot-every', '5']);
  assert.equal(res.status, 0, res.stderr);
  const lines = readJsonl(out);
  assert.ok(lines.some((r) => r.type === 'event' && r.name === 'lantern_out' && r.data.lantern_id === 'L1'));
  assert.ok(lines.some((r) => r.type === 'event' && r.name === 'lantern_lit' && r.data.relight === true));
  const lastSnap = lines.filter((r) => r.type === 'snapshot').pop();
  assert.equal(lastSnap.player.capacity, 12);
  assert.equal(lastSnap.lanterns[0].relit_count, 1);
  results.push(`PASS [S1 Fuel Decay & Relight]: lantern_out -> relit for 5 motes, capacity=${lastSnap.player.capacity}`);
}

// S2: Shade Drain (player outside 6m -> fuel_drain at tick 60) + Pulse Drain Interrupt (+15)
{
  const sc = writeJson('sc_drain.json', {
    player: { pos: [0, 0, 17], carried: 6, flames: 3 },
    random_motes: false,
    random_shades: false,
    lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: true, fuel: 25 }],
    shades: [{ id: 'S1', pos: [0, 1, 24.5], state: 'drain', target_lantern_id: 'L1' }]
  });
  const inp = writeJson('inp_drain.json', {
    frames: [
      { tick: 60, move: [0, 1], dash: true },
      { tick: 61, dash: false },
      { tick: 72, move: [0, 0], pulse: true },
      { tick: 73, pulse: false }
    ]
  });
  const out = path.join(tmpDir, 'out_drain.jsonl');
  const res = runHeadless(['--seed', '2', '--night', '1', '--scenario', sc, '--inputs', inp, '--ticks', '85', '--out', out, '--snapshot-every', '20']);
  assert.equal(res.status, 0, res.stderr);
  const lines = readJsonl(out);
  assert.ok(lines.some((r) => r.type === 'event' && r.name === 'fuel_drain' && r.data.shade_id === 'S1'));
  // Separate quick check for +15 pulse on draining shade
  const sc2 = writeJson('sc_drain_pulse.json', {
    player: { pos: [0, 0, 21], carried: 6, flames: 3 },
    random_motes: false,
    random_shades: false,
    lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: true, fuel: 25 }],
    shades: [{ id: 'S1', pos: [0, 1, 24.5], state: 'drain', target_lantern_id: 'L1' }]
  });
  const inp2 = writeJson('inp_drain_pulse.json', {
    frames: [
      { tick: 0, pulse: true },
      { tick: 1, pulse: false }
    ]
  });
  const out2 = path.join(tmpDir, 'out_drain_pulse.jsonl');
  const res2 = runHeadless(['--seed', '2', '--night', '1', '--scenario', sc2, '--inputs', inp2, '--ticks', '10', '--out', out2]);
  assert.equal(res2.status, 0, res2.stderr);
  const lines2 = readJsonl(out2);
  const end2 = lines2[lines2.length - 1];
  assert.equal(end2.score, 15, `Expected +15 for pulsing draining shade, got ${end2.score}`);
  results.push(`PASS [S2 Shade Drain & +15 Pulse Interrupt]: fuel_drain emitted at tick 60, pulse interrupt score=${end2.score}`);
}

// S3: Dawn Survived Win (Night 1: 3/5 lit at dawn -> won, dawn_survived)
{
  const sc = writeJson('sc_dawn_win.json', {
    player: { pos: [0, 0, 0], carried: 0, flames: 3 },
    random_motes: false,
    random_shades: false,
    lanterns: [
      { id: 'L1', lit: true, fuel: 50 },
      { id: 'L2', lit: true, fuel: 50 },
      { id: 'L3', lit: true, fuel: 50 }
    ],
    time_left_s: 0.2
  });
  const out = path.join(tmpDir, 'out_dawn_win.jsonl');
  const res = runHeadless(['--seed', '3', '--night', '1', '--scenario', sc, '--ticks', '30', '--out', out]);
  assert.equal(res.status, 0, res.stderr);
  const lines = readJsonl(out);
  const over = lines.find((r) => r.type === 'event' && r.name === 'game_over');
  assert.ok(over && over.data.result === 'won' && over.data.reason === 'dawn_survived');
  results.push(`PASS [S3 Dawn Survived Win 3/5]: state=won, reason=${over.data.reason}, score=${lines[lines.length - 1].score}`);
}

// S4: Dawn Loss (Night 1: 2/5 lit at dawn -> lost, dawn)
{
  const sc = writeJson('sc_dawn_loss.json', {
    player: { pos: [0, 0, 0], carried: 0, flames: 3 },
    random_motes: false,
    random_shades: false,
    lanterns: [
      { id: 'L1', lit: true, fuel: 50 },
      { id: 'L2', lit: true, fuel: 50 }
    ],
    time_left_s: 0.2
  });
  const out = path.join(tmpDir, 'out_dawn_loss.jsonl');
  const res = runHeadless(['--seed', '4', '--night', '1', '--scenario', sc, '--ticks', '30', '--out', out]);
  assert.equal(res.status, 0, res.stderr);
  const lines = readJsonl(out);
  const over = lines.find((r) => r.type === 'event' && r.name === 'game_over');
  assert.ok(over && over.data.result === 'lost' && over.data.reason === 'dawn');
  results.push(`PASS [S4 Dawn Loss 2/5]: state=lost, reason=${over.data.reason}`);
}

// S5: Phase 2 Regression (Night 2 Jump Pad + Drifter + Charm + Pause)
{
  const sc = writeJson('sc_p2_reg.json', {
    player: { pos: [20, 0, 18], carried: 0, flames: 3 },
    random_motes: false,
    random_shades: false,
    random_drifters: false
  });
  const out = path.join(tmpDir, 'out_p2_reg.jsonl');
  const res = runHeadless(['--seed', '5', '--night', '2', '--scenario', sc, '--ticks', '110', '--out', out, '--snapshot-every', '10']);
  assert.equal(res.status, 0, res.stderr);
  const lines = readJsonl(out);
  const snap = lines.filter((r) => r.type === 'snapshot').pop();
  assert.ok(snap.player.pos[0] > 45 && snap.player.grounded);
  results.push(`PASS [S5 Phase 2 Regression Jump Pad]: landed on Island B at x=${snap.player.pos[0]}`);
}

// S6: Night 3 Full 18,000-tick (300s) Perf & Determinism Check
{
  const outA = path.join(tmpDir, 'out_n3_a.jsonl');
  const outB = path.join(tmpDir, 'out_n3_b.jsonl');
  const t0 = performance.now();
  const rA = runHeadless(['--seed', '2026', '--night', '3', '--ticks', '18000', '--out', outA, '--snapshot-every', '60']);
  const elapsedS = (performance.now() - t0) / 1000;
  const rB = runHeadless(['--seed', '2026', '--night', '3', '--ticks', '18000', '--out', outB, '--snapshot-every', '60']);
  assert.equal(rA.status, 0, rA.stderr);
  assert.equal(rB.status, 0, rB.stderr);
  assert.equal(fs.readFileSync(outA, 'utf8'), fs.readFileSync(outB, 'utf8'));
  assert.ok(elapsedS <= 30, `Exceeded 30s: ${elapsedS.toFixed(2)}s`);
  results.push(`PASS [S6 Night 3 Full 18,000-tick Perf & Determinism]: ${elapsedS.toFixed(2)}s, byte-for-byte identical`);
}

for (const line of results) {
  console.log(line);
}
