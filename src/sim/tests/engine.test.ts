import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createDefaultInput, SimulationEngine } from '../engine.js';
import { DEFAULT_TUNING } from '../tuning.js';

test('DEFAULT_TUNING matches game.contract.json v1.3 exactly', () => {
  const contractPath = path.resolve(process.cwd(), 'game.contract.json');
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  assert.equal(contract.contract_version, '1.3');
  assert.ok(typeof contract.bench_cmd === 'string' && contract.bench_cmd.length > 0);
  assert.ok(typeof contract.soak_cmd === 'string' && contract.soak_cmd.length > 0);
  assert.deepEqual(DEFAULT_TUNING, contract.tuning);
});

test('Scenario setup emits no events, awards no score, sets default fuel=100 for lit lanterns', () => {
  const eng = new SimulationEngine(42, 1, DEFAULT_TUNING, {
    random_motes: false,
    random_shades: false,
    lanterns: [
      { id: 'L1', lit: true },
      { id: 'L2', lit: true, fuel: 25 }
    ]
  });
  const snap = eng.getSnapshot();
  assert.equal(snap.tick, 0);
  assert.equal(snap.score, 0);
  assert.equal(snap.lanterns[0].fuel, 100);
  assert.equal(snap.lanterns[0].ever_lit, true);
  assert.equal(snap.lanterns[1].fuel, 25);
  assert.equal(snap.player.capacity, 10);
});

test('Lantern fuel decays at exact 1/60 per tick, extinguishes at 0, and relights for 5 motes (+40)', () => {
  const eng = new SimulationEngine(10, 1, DEFAULT_TUNING, {
    random_motes: false,
    random_shades: false,
    player: { pos: [0, 0, 24], carried: 5, flames: 3 },
    lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: true, fuel: 0.1 }]
  });

  let outEv = null;
  for (let i = 0; i < 10; i++) {
    const evs = eng.step(createDefaultInput());
    const found = evs.find((e) => e.name === 'lantern_out');
    if (found) {
      outEv = found;
      break;
    }
  }
  assert.ok(outEv, 'Expected lantern_out event');
  assert.equal(eng.lanterns[0].lit, false);
  assert.equal(eng.lanterns[0].everLit, true);

  // Relight L1 with 5 motes
  const evRelight = eng.step({ ...createDefaultInput(), interact: true });
  assert.ok(evRelight.some((e) => e.name === 'lantern_lit' && e.data.relight === true));
  assert.equal(eng.lanterns[0].lit, true);
  assert.equal(eng.lanterns[0].relitCount, 1);
  assert.equal(eng.getCarryCapacity(), 12);
  // 5 motes * 5 + 40 relight = 65
  assert.equal(eng.score, 65);
});

test('Refuel lit lantern uses ceil((100-fuel)/10) motes, skips full lanterns, pushes shades when >= 30', () => {
  const eng = new SimulationEngine(11, 1, DEFAULT_TUNING, {
    random_motes: false,
    random_shades: false,
    player: { pos: [0, 0, 24], carried: 6, flames: 3 },
    lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: true, fuel: 25 }],
    shades: [{ id: 'S1', pos: [0, 1, 24.5], state: 'drain', target_lantern_id: 'L1' }]
  });

  const ev = eng.step({ ...createDefaultInput(), interact: true });
  const refuel = ev.find((e) => e.name === 'refuel');
  assert.ok(refuel);
  assert.equal(refuel.data.amount, 6);
  assert.equal(eng.player.carried, 0);
  assert.equal(eng.score, 30); // 6 * 5
  assert.ok(eng.shades[0].safePushTicks > 0, 'Draining shade should be pushed out when fuel >= 30');
});

test('Shade drains weak lantern (<30 fuel) at 5/s and pulsing draining shade awards +15 total', () => {
  const eng = new SimulationEngine(12, 1, DEFAULT_TUNING, {
    random_motes: false,
    random_shades: false,
    player: { pos: [0, 0, 22], carried: 5, flames: 3 },
    lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: true, fuel: 20 }],
    shades: [{ id: 'S1', pos: [0, 1, 24.2], state: 'drain', target_lantern_id: 'L1' }]
  });

  // Tick 1: Step 2 drains 1+5 = 6/60 = 0.1 fuel; Step 7 pulses S1 while still in drain -> +15!
  const ev = eng.step({ ...createDefaultInput(), pulse: true });
  assert.ok(ev.some((e) => e.name === 'pulse'));
  assert.equal(eng.lanterns[0].fuelUnits, 20 * 60 - 6);
  assert.equal(eng.shades[0].state, 'stunned');
  assert.equal(eng.score, 15);
});

test('No early win on all lit; dawn win requires >= ceil(0.6*N) lit lanterns (dawn_survived)', () => {
  const eng = new SimulationEngine(13, 1, DEFAULT_TUNING, {
    random_motes: false,
    random_shades: false,
    player: { pos: [0, 0, 24], carried: 10, flames: 3 },
    lanterns: [
      { id: 'L1', pos: [0, 0, 25], deposited: 0 },
      { id: 'L2', lit: true, fuel: 80 },
      { id: 'L3', lit: true, fuel: 80 },
      { id: 'L4', lit: true, fuel: 80 },
      { id: 'L5', lit: true, fuel: 80 }
    ],
    time_left_s: 0.05
  });

  // Tick 1: light L1 -> all 5 lit, MUST NOT win early!
  eng.step({ ...createDefaultInput(), interact: true });
  assert.equal(eng.state, 'playing', 'All lanterns lit must NOT trigger early win in v1.2');
  assert.equal(eng.getCarryCapacity(), 12);

  // Run to dawn (3 ticks total)
  let overEv = null;
  for (let i = 0; i < 5 && eng.state === 'playing'; i++) {
    const evs = eng.step(createDefaultInput());
    const g = evs.find((e) => e.name === 'game_over');
    if (g) overEv = g;
  }
  assert.equal(eng.state, 'won');
  assert.ok(overEv && overEv.data.reason === 'dawn_survived');
});

test('Dawn loss occurs when lit lanterns < ceil(0.6*N)', () => {
  const eng = new SimulationEngine(14, 1, DEFAULT_TUNING, {
    random_motes: false,
    random_shades: false,
    lanterns: [
      { id: 'L1', lit: true, fuel: 50 },
      { id: 'L2', lit: true, fuel: 50 }
    ],
    time_left_s: 0.05
  });

  let overEv = null;
  for (let i = 0; i < 5 && eng.state === 'playing'; i++) {
    const evs = eng.step(createDefaultInput());
    const g = evs.find((e) => e.name === 'game_over');
    if (g) overEv = g;
  }
  assert.equal(eng.state, 'lost');
  assert.ok(overEv && overEv.data.reason === 'dawn');
});

test('Phase 2 regression: Dash, Charm, Drifter, Fall, Pause still work under v1.2', () => {
  const eng = new SimulationEngine(15, 2, DEFAULT_TUNING, {
    random_motes: false,
    random_shades: false,
    random_drifters: false,
    player: { pos: [35, 0, 0], carried: 6, flames: 3 },
    drifters: [{ id: 'D1', pos: [35.5, 1.5, 0], state: 'chase' }]
  });
  const ev1 = eng.step({ ...createDefaultInput(), dash: true });
  assert.ok(ev1.some((e) => e.name === 'dash'));
  assert.ok(ev1.some((e) => e.name === 'charm_picked'));
  assert.ok(ev1.some((e) => e.name === 'drifter_steal'));

  const evPause = eng.step({ ...createDefaultInput(), pause: true });
  assert.ok(evPause.some((e) => e.name === 'paused'));
  assert.equal(eng.state, 'paused');
});
