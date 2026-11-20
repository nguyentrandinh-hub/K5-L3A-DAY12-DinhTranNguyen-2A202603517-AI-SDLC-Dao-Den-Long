# AGENTS.md — Đảo Đèn Lồng (AI SDLC Harness — Contract v1.1)

## Architecture
- `src/sim/`: Pure deterministic 60 Hz simulation engine (`engine.ts`, `maps.ts`, `tuning.ts`, `prng.ts`, `types.ts`) + headless CLI (`headless.ts`). **Zero DOM / Three.js imports allowed.**
- `src/game/`: Three.js 3D renderer for Nights 1–3, standard color palette, menu/pause/settings UI, HUD, procedural Web Audio. Imports `src/sim/` directly.
- `game.contract.json`: Single source of truth for Contract v1.1 tuning; `src/sim/tuning.ts` MUST match `game.contract.json` (enforced by unit tests).

## Commands
- Build all: `npm run build` (`build:sim` + `build:web`)
- Unit tests: `npm run test:unit`
- Headless scenarios & determinism/perf: `npm run test:scenarios`
- Full verification gate: `npm test`
- Headless CLI: `node dist-sim/headless.js --seed 42 --night 1|2|3 --ticks 600 --out tmp/out.jsonl`

## Non-Negotiable Contract v1.1 Invariants
1. **Determinism**: Same `--seed`, `--night`, `--scenario`, `--inputs` must produce byte-for-byte identical JSONL. Never use `Math.random()` or `Date.now()` in `src/sim/`.
2. **12-Step Tick Order**: Input/Pause → Timers → Player Move/Dash/Pad/Wind/Fall → Pickups → Interact → Safe Zones → Pulse → Shades/Drifters Move → Collisions (Drifters then Shades by ID) → Spawns → Win/Loss → Snapshot.
3. **Pause semantics**: While paused, `tick` increments but `sim_tick`, timers, spawns, and TTL freeze; snapshot records `state: "paused"`.
4. **Shade states**: Must use exact names `spawning`, `wander`, `chase`, `recoil`, `stunned`.
5. **Performance**: Full Night headless run (21,600 ticks) must complete in `<= 30s`.
6. **Exit codes**: `0` on success; `2` on malformed `--inputs`/`--scenario`; non-zero on other errors with message to `stderr`.
7. **Creativity isolation**: Visual/audio additions must NOT alter headless simulation outputs.

## Workflow Rules
- Never declare a phase done without running `npm test` and saving real output in `docs/proof/`.
- Document any modified/removed tests from earlier phases with explicit reasons in `docs/notes/`.
- Never commit `.env`, API keys, or secrets.
