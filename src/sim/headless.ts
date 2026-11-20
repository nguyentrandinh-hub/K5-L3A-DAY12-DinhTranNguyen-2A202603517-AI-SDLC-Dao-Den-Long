import fs from 'node:fs';
import path from 'node:path';
import { createDefaultInput, SimulationEngine } from './engine.js';
import { DEFAULT_TUNING } from './tuning.js';
import type { InputFrame, InputsFile, InputState, ScenarioFile } from './types.js';

interface CliOptions {
  seed: number;
  night: number;
  scenarioPath?: string;
  inputsPath?: string;
  ticks: number;
  outPath: string;
  snapshotEvery: number;
}

function fail(message: string, exitCode = 1): never {
  process.stderr.write(`Error: ${message}\n`);
  process.exit(exitCode);
}

function parseArgs(argv: string[]): CliOptions {
  let seed: number | undefined;
  let night: number | undefined;
  let scenarioPath: string | undefined;
  let inputsPath: string | undefined;
  let ticks: number | undefined;
  let outPath: string | undefined;
  let snapshotEvery = 10;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    switch (arg) {
      case '--seed':
        if (next === undefined) fail('Missing value for --seed');
        seed = Number(next);
        if (!Number.isInteger(seed)) fail(`Invalid --seed: ${next}`);
        i++;
        break;
      case '--night':
        if (next === undefined) fail('Missing value for --night');
        night = Number(next);
        if (!Number.isInteger(night) || night < 1 || night > 3) fail(`Invalid --night: ${next} (expected 1, 2, or 3)`);
        i++;
        break;
      case '--scenario':
        if (next === undefined) fail('Missing value for --scenario');
        scenarioPath = next;
        i++;
        break;
      case '--inputs':
        if (next === undefined) fail('Missing value for --inputs');
        inputsPath = next;
        i++;
        break;
      case '--ticks':
        if (next === undefined) fail('Missing value for --ticks');
        ticks = Number(next);
        if (!Number.isInteger(ticks) || ticks < 0) fail(`Invalid --ticks: ${next}`);
        i++;
        break;
      case '--out':
        if (next === undefined) fail('Missing value for --out');
        outPath = next;
        i++;
        break;
      case '--snapshot-every':
        if (next === undefined) fail('Missing value for --snapshot-every');
        snapshotEvery = Number(next);
        if (!Number.isInteger(snapshotEvery) || snapshotEvery < 1) {
          fail(`Invalid --snapshot-every: ${next}`);
        }
        i++;
        break;
      default:
        fail(`Unknown argument: ${arg}`);
    }
  }

  if (seed === undefined) fail('Missing required argument --seed');
  if (night === undefined) fail('Missing required argument --night');
  if (ticks === undefined) fail('Missing required argument --ticks');
  if (!outPath) fail('Missing required argument --out');

  return { seed, night, scenarioPath, inputsPath, ticks, outPath, snapshotEvery };
}

function isVec3(val: unknown): val is [number, number, number] {
  return (
    Array.isArray(val) &&
    val.length === 3 &&
    val.every((v) => typeof v === 'number' && Number.isFinite(v))
  );
}

function parseInputsFile(filePath: string): InputFrame[] {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    fail(`Cannot read inputs file "${filePath}": ${(err as Error).message}`, 2);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    fail(`Malformed JSON in inputs file "${filePath}": ${(err as Error).message}`, 2);
  }

  if (typeof parsed !== 'object' || parsed === null || !Array.isArray((parsed as InputsFile).frames)) {
    fail(`Invalid inputs schema in "${filePath}": expected { "frames": [...] }`, 2);
  }

  const frames = (parsed as InputsFile).frames;
  let lastTick = -1;
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    if (typeof f !== 'object' || f === null) {
      fail(`Invalid frame at index ${i}: expected object`, 2);
    }
    if (typeof f.tick !== 'number' || !Number.isInteger(f.tick) || f.tick < 0) {
      fail(`Invalid tick at frame ${i}: expected non-negative integer`, 2);
    }
    if (f.tick <= lastTick) {
      fail(`Non-increasing tick at frame ${i}: ${f.tick} <= ${lastTick}`, 2);
    }
    lastTick = f.tick;

    if (f.move !== undefined) {
      if (
        !Array.isArray(f.move) ||
        f.move.length !== 2 ||
        typeof f.move[0] !== 'number' ||
        typeof f.move[1] !== 'number' ||
        !Number.isFinite(f.move[0]) ||
        !Number.isFinite(f.move[1]) ||
        f.move[0] < -1 ||
        f.move[0] > 1 ||
        f.move[1] < -1 ||
        f.move[1] > 1
      ) {
        fail(`Invalid move at frame ${i}: expected [x, z] with components in [-1, 1]`, 2);
      }
    }
    if (f.cam_yaw_deg !== undefined && (typeof f.cam_yaw_deg !== 'number' || !Number.isFinite(f.cam_yaw_deg))) {
      fail(`Invalid cam_yaw_deg at frame ${i}`, 2);
    }
    for (const key of ['jump', 'interact', 'pulse', 'dash', 'pause'] as const) {
      if (f[key] !== undefined && typeof f[key] !== 'boolean') {
        fail(`Invalid ${key} at frame ${i}: expected boolean`, 2);
      }
    }
  }

  return frames;
}

function parseScenarioFile(filePath: string): ScenarioFile {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    fail(`Cannot read scenario file "${filePath}": ${(err as Error).message}`, 2);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    fail(`Malformed JSON in scenario file "${filePath}": ${(err as Error).message}`, 2);
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    fail(`Invalid scenario schema in "${filePath}": expected JSON object`, 2);
  }

  const sc = parsed as ScenarioFile;
  if (sc.player !== undefined) {
    if (typeof sc.player !== 'object' || sc.player === null) {
      fail('Invalid scenario.player: expected object', 2);
    }
    if (sc.player.pos !== undefined && !isVec3(sc.player.pos)) {
      fail('Invalid scenario.player.pos: expected [x, y, z]', 2);
    }
    if (sc.player.carried !== undefined && (typeof sc.player.carried !== 'number' || sc.player.carried < 0)) {
      fail('Invalid scenario.player.carried', 2);
    }
    if (sc.player.flames !== undefined && (typeof sc.player.flames !== 'number' || sc.player.flames < 0)) {
      fail('Invalid scenario.player.flames', 2);
    }
  }

  for (const flag of ['random_motes', 'random_shades', 'random_drifters', 'wind_enabled'] as const) {
    if (sc[flag] !== undefined && typeof sc[flag] !== 'boolean') {
      fail(`Invalid scenario.${flag}: expected boolean`, 2);
    }
  }
  if (sc.time_left_s !== undefined && (typeof sc.time_left_s !== 'number' || !Number.isFinite(sc.time_left_s))) {
    fail('Invalid scenario.time_left_s: expected number', 2);
  }

  if (sc.motes !== undefined) {
    if (!Array.isArray(sc.motes)) fail('Invalid scenario.motes: expected array', 2);
    for (let i = 0; i < sc.motes.length; i++) {
      const m = sc.motes[i];
      if (!isVec3(m) && !(typeof m === 'object' && m !== null && isVec3((m as { pos: unknown }).pos))) {
        fail(`Invalid scenario.motes[${i}]`, 2);
      }
    }
  }

  if (sc.shades !== undefined) {
    if (!Array.isArray(sc.shades)) fail('Invalid scenario.shades: expected array', 2);
    for (let i = 0; i < sc.shades.length; i++) {
      const s = sc.shades[i];
      if (typeof s !== 'object' || s === null || !isVec3(s.pos)) {
        fail(`Invalid scenario.shades[${i}]`, 2);
      }
    }
  }

  if (sc.drifters !== undefined) {
    if (!Array.isArray(sc.drifters)) fail('Invalid scenario.drifters: expected array', 2);
    for (let i = 0; i < sc.drifters.length; i++) {
      const d = sc.drifters[i];
      if (typeof d !== 'object' || d === null || !isVec3(d.pos)) {
        fail(`Invalid scenario.drifters[${i}]`, 2);
      }
    }
  }

  if (sc.charms !== undefined) {
    if (!Array.isArray(sc.charms)) fail('Invalid scenario.charms: expected array', 2);
    for (let i = 0; i < sc.charms.length; i++) {
      const c = sc.charms[i];
      if (typeof c !== 'object' || c === null || !isVec3(c.pos)) {
        fail(`Invalid scenario.charms[${i}]`, 2);
      }
    }
  }

  if (sc.lanterns !== undefined) {
    if (!Array.isArray(sc.lanterns)) fail('Invalid scenario.lanterns: expected array', 2);
    for (let i = 0; i < sc.lanterns.length; i++) {
      const l = sc.lanterns[i];
      if (typeof l !== 'object' || l === null || typeof l.id !== 'string') {
        fail(`Invalid scenario.lanterns[${i}]`, 2);
      }
      if (l.pos !== undefined && !isVec3(l.pos)) {
        fail(`Invalid scenario.lanterns[${i}].pos`, 2);
      }
    }
  }

  return sc;
}

function main(): void {
  const opts = parseArgs(process.argv.slice(2));
  const scenario = opts.scenarioPath ? parseScenarioFile(opts.scenarioPath) : undefined;
  const frames = opts.inputsPath ? parseInputsFile(opts.inputsPath) : [];

  const engine = new SimulationEngine(opts.seed, opts.night, DEFAULT_TUNING, scenario);
  const lines: string[] = [];

  // Snapshot tick 0: post-scenario, pre-input
  lines.push(JSON.stringify(engine.getSnapshot()));

  const currentInput: InputState = createDefaultInput();
  let frameIdx = 0;

  for (let k = 0; k < opts.ticks; k++) {
    if ((engine.state as string) === 'won' || (engine.state as string) === 'lost') break;

    while (frameIdx < frames.length && frames[frameIdx].tick === k) {
      const f = frames[frameIdx];
      if (f.move !== undefined) currentInput.move = [f.move[0], f.move[1]];
      if (f.cam_yaw_deg !== undefined) currentInput.cam_yaw_deg = f.cam_yaw_deg;
      if (f.jump !== undefined) currentInput.jump = f.jump;
      if (f.interact !== undefined) currentInput.interact = f.interact;
      if (f.pulse !== undefined) currentInput.pulse = f.pulse;
      if (f.dash !== undefined) currentInput.dash = f.dash;
      if (f.pause !== undefined) currentInput.pause = f.pause;
      frameIdx++;
    }

    const events = engine.step(currentInput);
    for (const ev of events) {
      lines.push(JSON.stringify(ev));
    }

    if (engine.tick % opts.snapshotEvery === 0) {
      lines.push(JSON.stringify(engine.getSnapshot()));
    }

    if ((engine.state as string) === 'won' || (engine.state as string) === 'lost') break;
  }

  lines.push(JSON.stringify(engine.getEndRecord()));

  const outDir = path.dirname(path.resolve(opts.outPath));
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(opts.outPath, `${lines.join('\n')}\n`, 'utf8');
}

main();
