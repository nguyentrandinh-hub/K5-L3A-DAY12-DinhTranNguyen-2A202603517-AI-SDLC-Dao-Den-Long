import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createDefaultInput, SimulationEngine } from '../engine.js';
import { DEFAULT_TUNING } from '../tuning.js';

test('DEFAULT_TUNING matches game.contract.json v1.1 exactly', () => {
  const contractPath = path.resolve(process.cwd(), 'game.contract.json');
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  assert.equal(contract.contract_version, '1.1');
  assert.deepEqual(DEFAULT_TUNING, contract.tuning);
});

test('Scenario setup emits no events and awards no score even with pre-lit lanterns', () => {
  const eng = new SimulationEngine(42, 1, DEFAULT_TUNING, {
    random_motes: false,
    random_shades: false,
    lanterns: [
      { id: 'L1', lit: true },
      { id: 'L2', deposited: 10 }
    ]
  });
  const snap = eng.getSnapshot();
  assert.equal(snap.tick, 0);
  assert.equal(snap.sim_tick, 0);
  assert.equal(snap.score, 0);
  assert.equal(snap.lanterns[0].lit, true);
  assert.equal(snap.lanterns[1].lit, true);
  assert.equal(snap.motes_active, 0);
  assert.equal(snap.shades.length, 0);
});

test('Camera-relative movement (6.0 m/s) and diagonal normalization follow contract formula', () => {
  const eng = new SimulationEngine(1, 1, DEFAULT_TUNING, {
    random_motes: false,
    random_shades: false
  });
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

test('Dash moves at 14 m/s for 12 ticks, holds air altitude, and enforces 1.5s cooldown', () => {
  const eng = new SimulationEngine(1, 1, DEFAULT_TUNING, {
    random_motes: false,
    random_shades: false
  });
  // Jump first, then dash on tick 2 while airborne
  eng.step({ ...createDefaultInput(), jump: true });
  const yBeforeDash = eng.player.y;
  const ev = eng.step({ ...createDefaultInput(), dash: true, move: [0, 1] });
  assert.ok(ev.some((e) => e.name === 'dash'));
  assert.ok(Math.abs(eng.player.y - yBeforeDash) < 1e-6, 'Air dash must hold altitude');
  assert.ok(eng.player.dashCooldownTicks > 0);
});

test('Deposit awards +10 per mote, +100 per lantern, and wins on all lit', () => {
  const eng = new SimulationEngine(7, 1, DEFAULT_TUNING, {
    random_motes: false,
    random_shades: false,
    player: { pos: [0, 0, 24], carried: 10, flames: 3 },
    lanterns: [
      { id: 'L1', pos: [0, 0, 25], deposited: 0 },
      { id: 'L2', lit: true },
      { id: 'L3', lit: true },
      { id: 'L4', lit: true },
      { id: 'L5', lit: true }
    ],
    time_left_s: 100
  });

  const ev = eng.step({ ...createDefaultInput(), interact: true });
  assert.ok(ev.some((e) => e.name === 'deposit' && e.data.lantern_id === 'L1' && e.data.amount === 10));
  assert.ok(ev.some((e) => e.name === 'lantern_lit' && e.data.lantern_id === 'L1'));
  assert.ok(ev.some((e) => e.name === 'game_over' && e.data.result === 'won' && e.data.reason === 'all_lit'));
  assert.equal(eng.state, 'won');
  // 10*10 + 100 + floor(99.983)*2 + 3*50 = 100 + 100 + 198 + 150 = 548
  assert.equal(eng.score, 548);
});

test('Pulse (cost 3, 3D radius 5m) stuns for 120 ticks, pushes 4m over 15 ticks, +5 score', () => {
  const eng = new SimulationEngine(7, 1, DEFAULT_TUNING, {
    random_motes: false,
    random_shades: false,
    player: { pos: [0, 0, 0], carried: 4, flames: 3 },
    shades: [{ id: 'S1', pos: [3, 1, 0], state: 'chase' }]
  });

  const ev = eng.step({ ...createDefaultInput(), pulse: true });
  assert.ok(ev.some((e) => e.name === 'pulse' && Array.isArray(e.data.stunned_ids) && e.data.stunned_ids[0] === 'S1'));
  assert.equal(eng.player.carried, 1);
  assert.equal(eng.score, 5);
  assert.equal(eng.shades[0].state, 'stunned');
  for (let i = 0; i < 16; i++) eng.step(createDefaultInput());
  assert.ok(eng.shades[0].x >= 6.8, `Expected shade pushed ~4m from x=3, got ${eng.shades[0].x}`);
});

test('Shade hit drops floor(carried/2) dropped motes with TTL, enters recoil, invuln 90 ticks', () => {
  const eng = new SimulationEngine(7, 1, DEFAULT_TUNING, {
    random_motes: false,
    random_shades: false,
    player: { pos: [0, 0, 0], carried: 5, flames: 3 },
    shades: [{ id: 'S1', pos: [0.8, 1, 0], state: 'chase' }]
  });

  const ev = eng.step(createDefaultInput());
  const hit = ev.find((e) => e.name === 'player_hit');
  assert.ok(hit);
  assert.equal(hit.data.by, 'shade');
  assert.equal(hit.data.flames, 2);
  assert.equal(hit.data.dropped, 2);
  assert.equal(eng.player.carried, 3);
  assert.equal(eng.player.invulnTicks, 90);
  assert.equal(eng.shades[0].state, 'recoil');
  assert.equal(eng.motes.filter((m) => m.kind === 'dropped').length, 2);
});

test('Fall off island (Y < -10) deducts 1 flame, loses all motes, respawns after 60 ticks', () => {
  const eng = new SimulationEngine(7, 1, DEFAULT_TUNING, {
    random_motes: false,
    random_shades: false,
    player: { pos: [42, -9.8, 0], carried: 4, flames: 2 }
  });

  let fallEv = null;
  for (let i = 0; i < 10; i++) {
    const evs = eng.step(createDefaultInput());
    const f = evs.find((e) => e.name === 'player_hit' && e.data.by === 'fall');
    if (f) {
      fallEv = f;
      break;
    }
  }
  assert.ok(fallEv);
  assert.equal(fallEv.data.flames, 1);
  assert.equal(fallEv.data.lost, 4);
  assert.equal(eng.player.carried, 0);

  for (let i = 0; i < 60; i++) eng.step(createDefaultInput());
  assert.equal(eng.player.x, 0);
  assert.equal(eng.player.y, 0);
  assert.equal(eng.player.z, 0);
  assert.ok(eng.player.invulnTicks > 0);
});

test('Pause freezes sim_tick and time_left_s while incrementing tick', () => {
  const eng = new SimulationEngine(5, 1, DEFAULT_TUNING, {
    random_motes: false,
    random_shades: false
  });
  eng.step(createDefaultInput());
  const simBefore = eng.simTick;
  const timeBefore = eng.timeLeftS;

  const evPause = eng.step({ ...createDefaultInput(), pause: true });
  assert.ok(evPause.some((e) => e.name === 'paused'));
  assert.equal(eng.state, 'paused');

  for (let i = 0; i < 10; i++) eng.step(createDefaultInput());
  assert.equal(eng.simTick, simBefore);
  assert.equal(eng.timeLeftS, timeBefore);
  assert.equal(eng.tick, 12);

  const evResume = eng.step({ ...createDefaultInput(), pause: true });
  assert.ok(evResume.some((e) => e.name === 'resumed'));
  assert.equal(eng.state, 'playing');
  assert.equal(eng.simTick, simBefore + 1);
});

test('Drifter steals up to 3 motes when carried >= 5 and drops them when pulsed while fleeing', () => {
  const eng = new SimulationEngine(9, 2, DEFAULT_TUNING, {
    random_motes: false,
    random_shades: false,
    random_drifters: false,
    player: { pos: [0, 0, 0], carried: 6, flames: 3 },
    drifters: [{ id: 'D1', pos: [0.5, 1.5, 0], state: 'chase' }]
  });

  const ev1 = eng.step(createDefaultInput());
  const steal = ev1.find((e) => e.name === 'drifter_steal');
  assert.ok(steal);
  assert.equal(steal.data.amount, 3);
  assert.equal(eng.player.carried, 3);
  assert.equal(eng.drifters[0].state, 'flee');

  // Pulse next tick while drifter is still within 5m
  const ev2 = eng.step({ ...createDefaultInput(), pulse: true });
  const drop = ev2.find((e) => e.name === 'drifter_drop');
  assert.ok(drop);
  assert.equal(drop.data.amount, 3);
  assert.equal(eng.motes.filter((m) => m.kind === 'dropped').length, 3);
});

test('Charm grants 7.2 m/s speed and zero dash cooldown for 600 ticks', () => {
  const eng = new SimulationEngine(9, 2, DEFAULT_TUNING, {
    random_motes: false,
    random_shades: false,
    random_drifters: false,
    player: { pos: [35, 0, 0], carried: 0, flames: 3 }
  });

  const ev = eng.step(createDefaultInput());
  assert.ok(ev.some((e) => e.name === 'charm_picked' && e.data.charm_id === 'C1'));
  assert.equal(eng.player.charmTicks, 600);
  assert.equal(eng.charms[0].available, false);

  eng.step({ ...createDefaultInput(), dash: true, move: [0, 1] });
  assert.equal(eng.player.dashCooldownTicks, 0);
});

test('Night 2 jump pad launches player across islands and Night 3 wind activates at 30s', () => {
  const eng2 = new SimulationEngine(9, 2, DEFAULT_TUNING, {
    random_motes: false,
    random_shades: false,
    random_drifters: false,
    player: { pos: [20, 0, 18], carried: 0, flames: 3 }
  });
  eng2.step(createDefaultInput());
  assert.ok(eng2.player.vy > 13, 'Jump pad should launch with vy=14');
  assert.equal(eng2.player.launchLocked, true);

  const eng3 = new SimulationEngine(9, 3, DEFAULT_TUNING, {
    random_motes: false,
    random_shades: false,
    random_drifters: false,
    wind_enabled: true
  });
  for (let i = 0; i < 1805; i++) eng3.step(createDefaultInput());
  assert.equal(eng3.wind.active, true);
});
