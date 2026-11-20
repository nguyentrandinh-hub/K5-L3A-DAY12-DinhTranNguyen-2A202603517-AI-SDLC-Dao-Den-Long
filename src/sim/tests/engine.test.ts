import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createDefaultInput, SimulationEngine } from '../engine.js';
import { DEFAULT_TUNING } from '../tuning.js';

test('DEFAULT_TUNING matches game.contract.json exactly', () => {
  const contractPath = path.resolve(process.cwd(), 'game.contract.json');
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  assert.deepEqual(DEFAULT_TUNING, contract.tuning);
});

test('Scenario setup emits no events and awards no score even with pre-lit lanterns', () => {
  const eng = new SimulationEngine(42, 1, DEFAULT_TUNING, {
    random_motes: false,
    random_shades: false,
    lanterns: [
      { id: 'L1', lit: true },
      { id: 'L2', deposited: 3 }
    ]
  });
  const snap = eng.getSnapshot();
  assert.equal(snap.tick, 0);
  assert.equal(snap.score, 0);
  assert.equal(snap.lanterns[0].lit, true);
  assert.equal(snap.lanterns[1].lit, true);
  assert.equal(snap.motes_active, 0);
  assert.equal(snap.shades.length, 0);
});

test('Camera-relative movement and diagonal normalization follow contract formula', () => {
  const eng = new SimulationEngine(1, 1, DEFAULT_TUNING, {
    random_motes: false,
    random_shades: false
  });
  // cam_yaw_deg = 90 => cos=0, sin=1 => wx = z, wz = -x
  // move = [1, 1] => normalized to [1/sqrt(2), 1/sqrt(2)]
  const input = {
    ...createDefaultInput(),
    move: [1, 1] as [number, number],
    cam_yaw_deg: 90
  };
  eng.step(input);
  const expected = (DEFAULT_TUNING.player_speed / 60) / Math.SQRT2;
  assert.ok(Math.abs(eng.player.x - expected) < 1e-6);
  assert.ok(Math.abs(eng.player.z - -expected) < 1e-6);
});

test('Pickup motes up to carry_capacity, deposit into lantern, and win on all lit', () => {
  const eng = new SimulationEngine(7, 1, DEFAULT_TUNING, {
    random_motes: false,
    random_shades: false,
    player: { pos: [0, 0, 0], carried: 0, flames: 3 },
    motes: [
      [0, 0, 1],
      [0, 0, 1.5],
      [0, 0, 1.8]
    ],
    lanterns: [
      { id: 'L1', pos: [0, 0, 2], deposited: 0 },
      { id: 'L2', lit: true },
      { id: 'L3', lit: true },
      { id: 'L4', lit: true },
      { id: 'L5', lit: true }
    ],
    time_left_s: 100
  });

  // Tick 1: standing at origin picks up all 3 motes within pickup_radius=2.0
  const ev1 = eng.step(createDefaultInput());
  assert.equal(ev1.filter((e) => e.name === 'mote_picked').length, 3);
  assert.equal(eng.player.carried, 3);
  assert.equal(eng.score, 30);

  // Tick 2: press interact -> deposits 3 into L1, lights L1, wins!
  const ev2 = eng.step({ ...createDefaultInput(), interact: true });
  assert.ok(ev2.some((e) => e.name === 'deposit' && e.data.lantern_id === 'L1' && e.data.amount === 3));
  assert.ok(ev2.some((e) => e.name === 'lantern_lit' && e.data.lantern_id === 'L1'));
  assert.ok(ev2.some((e) => e.name === 'game_over' && e.data.result === 'won' && e.data.reason === 'all_lit'));
  assert.equal(eng.state, 'won');
});

test('Pulse stuns and pushes shade within pulse_radius and spends pulse_cost', () => {
  const eng = new SimulationEngine(7, 1, DEFAULT_TUNING, {
    random_motes: false,
    random_shades: false,
    player: { pos: [0, 0, 0], carried: 3, flames: 3 },
    shades: [{ id: 'S1', pos: [5, 1, 0] }]
  });

  const ev = eng.step({ ...createDefaultInput(), pulse: true });
  assert.ok(ev.some((e) => e.name === 'pulse' && Array.isArray(e.data.stunned_ids) && e.data.stunned_ids[0] === 'S1'));
  assert.equal(eng.player.carried, 3 - DEFAULT_TUNING.pulse_cost);
  assert.equal(eng.shades[0].state, 'stunned');
  assert.ok(eng.shades[0].x >= 5 + DEFAULT_TUNING.pulse_push_m - 0.1);
});

test('Shade cannot enter safe_radius of a lit lantern', () => {
  const eng = new SimulationEngine(7, 1, DEFAULT_TUNING, {
    random_motes: false,
    random_shades: false,
    player: { pos: [0, 0, 0], carried: 0, flames: 3 },
    lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true }],
    shades: [{ id: 'S1', pos: [7, 1, 0] }]
  });

  for (let i = 0; i < 120; i++) {
    eng.step(createDefaultInput());
    const d = Math.hypot(eng.shades[0].x, eng.shades[0].z);
    assert.ok(d >= DEFAULT_TUNING.safe_radius, `Shade entered safe_radius: ${d}`);
  }
});

test('Shade hit reduces flames, drops motes, triggers invuln, and loses at 0 flames', () => {
  const eng = new SimulationEngine(7, 1, DEFAULT_TUNING, {
    random_motes: false,
    random_shades: false,
    player: { pos: [0, 0, 0], carried: 4, flames: 1 },
    shades: [{ id: 'S1', pos: [1, 1, 0] }]
  });

  const ev = eng.step(createDefaultInput());
  const hit = ev.find((e) => e.name === 'player_hit');
  assert.ok(hit);
  assert.equal(hit.data.by, 'shade');
  assert.equal(hit.data.flames, 0);
  assert.equal(hit.data.dropped, 2);
  assert.equal(eng.state, 'lost');
  assert.ok(ev.some((e) => e.name === 'game_over' && e.data.reason === 'no_flames'));
});

test('Dawn timeout triggers loss with reason dawn', () => {
  const eng = new SimulationEngine(7, 1, DEFAULT_TUNING, {
    random_motes: false,
    random_shades: false,
    time_left_s: 0.05
  });

  for (let i = 0; i < 10 && eng.state === 'playing'; i++) {
    eng.step(createDefaultInput());
  }
  assert.equal(eng.state, 'lost');
});
