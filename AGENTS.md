# AGENTS.md — Đảo Đèn Lồng (AI SDLC Harness)

## Architecture
- `src/sim/`: Pure deterministic 60 Hz simulation engine + headless CLI. **Zero DOM / Three.js imports allowed.**
- `src/game/`: Three.js 3D renderer, input controller, HUD, procedural Web Audio. Imports `src/sim/` directly.
- `game.contract.json`: Single source of truth for tuning parameters; `src/sim/tuning.ts` MUST stay in sync with `game.contract.json` (enforced by unit tests).

## Commands
- Build all: `npm run build` (`build:sim` + `build:web`)
- Run unit tests: `npm run test:unit`
- Run scenario & determinism verification: `npm run test:scenarios`
- Full verification gate: `npm test`
- Run headless CLI: `node dist-sim/headless.js --seed 42 --night 1 --ticks 600 --out tmp/out.jsonl`
- Run 3D web game: `npm run dev` (dev) or `npm run preview` (built)

## Non-Negotiable Contract Invariants
1. **Determinism**: Same `--seed`, `--scenario`, `--inputs` must produce byte-for-byte identical JSONL output. Never use `Math.random()` or `Date.now()` in `src/sim/`.
2. **Tick model**: Snapshot tick 0 is post-scenario, pre-input. Step `k` (`0..N-1`) reads input at tick `k` and produces state/events at tick `k+1`.
3. **Distances**: All tuning radii are XZ-plane distances (`<= r`), no character radius added.
4. **Scenario setup**: Never emit events or award score during scenario initialization.
5. **Exit codes**: `0` on success; `2` on malformed `--inputs` or `--scenario`; non-zero on other errors with message to `stderr`.
6. **Creativity isolation**: Any creative visual/audio/cosmetic additions must NOT alter headless simulation outputs.

## Workflow Rules
- Never declare a phase or change done without running `npm test` and saving real output evidence in `docs/proof/`.
- If a later phase changes an old rule, update or remove affected tests with an explicit reason in `docs/notes/`.
- Never commit `.env`, API keys, or secrets.
