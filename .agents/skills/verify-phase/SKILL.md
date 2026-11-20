---
name: verify-phase
description: Run build, unit tests, headless contract scenarios, and determinism check, then save verification evidence to docs/proof/.
---

# Verify Phase Skill

Use this skill before tagging any phase (`phase-1` .. `phase-4`).

## Steps
1. Run `npm run build` to verify both `src/sim` (TypeScript NodeNext) and `src/game` (Vite + Three.js) compile cleanly with zero errors.
2. Run `npm test` to execute:
   - Unit tests (`src/sim/tests/`) including `game.contract.json` sync check.
   - Headless scenario suite (`scripts/verify-phase1.mjs`) testing pickup, deposit, lantern_lit, win, pulse stun/push, shade hit/loss, dawn timeout, safe_radius repulsion, invalid input exit code 2, and byte-for-byte determinism across 2 runs.
3. Save the real command output and scenario summary into `docs/proof/phase-<N>-report.md`.
4. Verify `git status` has no untracked temp files or secrets (`.env`), then tag `phase-<N>`.
