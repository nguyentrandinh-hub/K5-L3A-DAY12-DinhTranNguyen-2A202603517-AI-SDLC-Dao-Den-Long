# AGENTS.md — Đảo Đèn Lồng (AI SDLC Harness — Contract v1.3)

## Architecture
- `src/sim/`: Pure deterministic 60 Hz simulation engine (`engine.ts`, `maps.ts`, `tuning.ts`, `prng.ts`, `types.ts`) + headless CLI (`headless.ts`) + soak runner (`soak.ts`). **Zero DOM / Three.js imports allowed.**
- `src/game/`: Three.js 3D renderer (`main.ts`, `bench-runner.ts`, `audio.ts`) for Nights 1–3, standard & colorblind palettes, accessibility (key remap, subtitles, reduce motion, 18px/1.25x text), local leaderboard, procedural Web Audio.
- `scripts/`: `run-game.mjs` (static server + disk leaderboard + `--export-leaderboard`), `bench.mjs` (1280×720 WebGL benchmark runner), `verify-phase4.mjs` (full regression + soak + leaderboard CLI suite).
- `game.contract.json`: Single source of truth for Contract v1.3 tuning & commands; `src/sim/tuning.ts` MUST match `game.contract.json` (enforced by unit tests).

## Commands
- Build all: `npm run build` (`build:sim` + `build:web`)
- Run game: `node scripts/run-game.mjs` (or `npm start`)
- Export leaderboard: `node scripts/run-game.mjs --export-leaderboard out.json`
- Headless CLI: `node dist-sim/headless.js --seed 42 --night 1|2|3 --ticks 600 --out tmp/out.jsonl`
- Soak test: `node dist-sim/soak.js --seed 7 --nights 10 --out soak.json`
- Benchmark: `node scripts/bench.mjs --seed 42 --duration 30 --out bench.json`
- Full verification gate: `npm test`

## Non-Negotiable Contract v1.3 Invariants
1. **Determinism**: Same `--seed`, `--night`, `--scenario`, `--inputs` must produce byte-for-byte identical JSONL. Never use `Math.random()` or `Date.now()` in `src/sim/`.
2. **Exact Fuel Arithmetic**: Lantern fuel MUST be tracked in integer `1/60` units (`0..6000`); round to 1 decimal only on output.
3. **12-Step Tick Order & Dawn Win**: No early win; `no_flames` > `dawn_survived` (`lit >= ceil(0.6*N)`) > `dawn`.
4. **Shade states**: Exact names `spawning`, `wander`, `chase`, `recoil`, `stunned`, `drain`.
5. **Bench & Soak isolation**: All creative extras MUST be disabled during benchmark and soak runs so measurements match the standard scene.
6. **Exit codes**: `0` on success; `2` on malformed `--inputs`/`--scenario`; non-zero on other errors with message to `stderr`.
