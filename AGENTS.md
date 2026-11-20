# AGENTS.md — Đảo Đèn Lồng (AI SDLC Harness — Contract v1.2)

## Architecture
- `src/sim/`: Pure deterministic 60 Hz simulation engine (`engine.ts`, `maps.ts`, `tuning.ts`, `prng.ts`, `types.ts`) + headless CLI (`headless.ts`). **Zero DOM / Three.js imports allowed.**
- `src/game/`: Three.js 3D renderer for Nights 1–3, standard & colorblind palettes, 3D fuel bars, menus/pause/settings UI, HUD, procedural Web Audio. Imports `src/sim/` directly.
- `game.contract.json`: Single source of truth for Contract v1.2 tuning; `src/sim/tuning.ts` MUST match `game.contract.json` (enforced by unit tests).

## Commands
- Build all: `npm run build` (`build:sim` + `build:web`)
- Unit tests: `npm run test:unit`
- Headless scenarios & determinism/perf: `npm run test:scenarios`
- Full verification gate: `npm test`
- Headless CLI: `node dist-sim/headless.js --seed 42 --night 1|2|3 --ticks 600 --out tmp/out.jsonl`

## Non-Negotiable Contract v1.2 Invariants
1. **Determinism**: Same `--seed`, `--night`, `--scenario`, `--inputs` must produce byte-for-byte identical JSONL. Never use `Math.random()` or `Date.now()` in `src/sim/`.
2. **Exact Fuel Arithmetic**: Lantern fuel MUST be tracked in integer `1/60` units (`0..6000`) to avoid floating-point drift; round to 1 decimal place only on snapshot/event output.
3. **12-Step Tick Order**: Input/Pause → Timers & Fuel Decay/Drain (extinguish `fuel <= 0` right after) → Player Move/Dash/Pad/Wind/Fall → Pickups → Interact (Light/Relight/Refuel) → Safe Zones (`fuel >= 30` only) → Pulse (`+15` total on draining shade) → Shades/Drifters Move → Collisions → Spawns → Win/Loss (`no_flames` > `dawn_survived` if `lit >= ceil(0.6*N)` > `dawn`) → Snapshot.
4. **Shade states**: Must use exact names `spawning`, `wander`, `chase`, `recoil`, `stunned`, `drain`.
5. **No early win**: Lighting all lanterns does NOT end the night; win occurs only at dawn with `lit >= ceil(0.6 * total)`.
6. **Exit codes**: `0` on success; `2` on malformed `--inputs`/`--scenario`; non-zero on other errors with message to `stderr`.
7. **Creativity isolation**: Visual/audio additions must NOT alter headless simulation outputs.

## Workflow Rules
- Never declare a phase done without running `npm test` and saving real output in `docs/proof/`.
- Document breaking changes in `CHANGELOG.md`, design decisions in `docs/notes/adr-*.md`, and updated/removed tests with explicit reasons in `docs/notes/`.
- Never commit `.env`, API keys, or secrets.
