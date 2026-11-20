import fs from 'node:fs';
import path from 'node:path';
import { createDefaultInput, SimulationEngine } from './engine.js';
import { DeterministicRNG } from './prng.js';
import { DEFAULT_TUNING, TICK_RATE } from './tuning.js';

interface SoakOptions {
  seed: number;
  nights: number;
  outPath: string;
}

function fail(msg: string, code = 1): never {
  process.stderr.write(`Error: ${msg}\n`);
  process.exit(code);
}

function parseArgs(argv: string[]): SoakOptions {
  let seed = 7;
  let nights = 10;
  let outPath = 'soak.json';

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    switch (arg) {
      case '--seed':
        if (next === undefined) fail('Missing --seed value');
        seed = Number(next);
        if (!Number.isInteger(seed)) fail(`Invalid --seed: ${next}`);
        i++;
        break;
      case '--nights':
        if (next === undefined) fail('Missing --nights value');
        nights = Number(next);
        if (!Number.isInteger(nights) || nights < 1) fail(`Invalid --nights: ${next}`);
        i++;
        break;
      case '--out':
        if (next === undefined) fail('Missing --out value');
        outPath = next;
        i++;
        break;
      default:
        fail(`Unknown argument: ${arg}`);
    }
  }
  return { seed, nights, outPath };
}

function getRssMb(): number {
  return Math.round((process.memoryUsage().rss / (1024 * 1024)) * 10) / 10;
}

function main(): void {
  const opts = parseArgs(process.argv.slice(2));

  // Pre-warm V8 JIT before Night 1 so RSS reflects steady-state simulation memory rather than initial JIT compilation
  {
    const warm = new SimulationEngine(0, 1, DEFAULT_TUNING);
    const wi = createDefaultInput();
    wi.move = [1, 0];
    for (let w = 0; w < 2400 && warm.state === 'playing'; w++) warm.step(wi);
  }

  const t0 = performance.now();

  let crashes = 0;
  const results: string[] = [];
  let memStartMb = 0;

  for (let i = 0; i < opts.nights; i++) {
    const nightNum = (i % 3) + 1;
    const nightSeed = opts.seed + i;
    const maxTicks =
      (nightNum === 1
        ? DEFAULT_TUNING.night1_duration_s
        : nightNum === 2
          ? DEFAULT_TUNING.night2_duration_s
          : DEFAULT_TUNING.night3_duration_s) * TICK_RATE;

    try {
      let engine: SimulationEngine | null = new SimulationEngine(nightSeed, nightNum, DEFAULT_TUNING);
      if (i === 0) {
        memStartMb = getRssMb();
      }

      const inputRng = new DeterministicRNG(nightSeed * 31 + 17);
      let moveX = 0;
      let moveZ = 0;
      let prevJump = false;
      let prevDash = false;
      let prevPulse = false;
      let prevInteract = false;

      for (let t = 0; t < maxTicks && engine.state === 'playing'; t++) {
        if (t % 30 === 0) {
          const ang = inputRng.range(0, Math.PI * 2);
          moveX = Math.cos(ang);
          moveZ = Math.sin(ang);
        }

        const wantJump: boolean = !prevJump && inputRng.next() < 0.05;
        const wantDash: boolean = !prevDash && inputRng.next() < 0.03;
        const wantPulse: boolean = !prevPulse && inputRng.next() < 0.02;
        const wantInteract: boolean = !prevInteract && inputRng.next() < 0.1;

        const input = createDefaultInput();
        input.move = [moveX, moveZ];
        input.jump = wantJump;
        input.dash = wantDash;
        input.pulse = wantPulse;
        input.interact = wantInteract;

        prevJump = wantJump;
        prevDash = wantDash;
        prevPulse = wantPulse;
        prevInteract = wantInteract;

        engine.step(input);
      }

      results.push(engine.state === 'won' ? 'won' : 'lost');
      engine = null;
    } catch (err) {
      crashes += 1;
      results.push('crash');
      process.stderr.write(`Night ${i + 1} crashed: ${(err as Error).message}\n`);
    }
  }

  if (typeof globalThis.gc === 'function') {
    globalThis.gc();
  }
  const memEndMb = getRssMb();
  const durationS = Math.round(((performance.now() - t0) / 1000) * 100) / 100;

  const report = {
    nights: opts.nights,
    crashes,
    results,
    mem_start_mb: memStartMb,
    mem_end_mb: memEndMb,
    duration_s: durationS
  };

  const outDir = path.dirname(path.resolve(opts.outPath));
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(opts.outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report));
}

main();
