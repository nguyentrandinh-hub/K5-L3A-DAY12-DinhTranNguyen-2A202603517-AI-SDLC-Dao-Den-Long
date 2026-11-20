---
name: verify-phase
description: Run build, unit tests, headless Contract v1.1 scenarios (Nights 1-3, dash, jump pad, drifters, charms, wind, fall, pause, perf, determinism), and save evidence to docs/proof/.
---

# Verify Phase Skill (v1.1)

Use this skill before tagging any phase (`phase-2` .. `phase-4`).

## Steps
1. Run `npm run build` to verify both `src/sim` (TypeScript NodeNext) and `src/game` (Vite + Three.js) compile cleanly.
2. Run `npm test` to execute:
   - Unit tests (`src/sim/tests/engine.test.ts`): contract sync, tick model, movement/dash/jump, pickup/deposit/win, pulse 3D, safe zone push, shade states & recoil, fall respawn, drifters, charms, wind, pause.
   - Headless scenario suite (`scripts/verify-phase2.mjs`): covers every Night (1, 2, 3) and every new Ticket-02 feature, exit code 2 validation, byte-for-byte determinism, and full 21,600-tick performance benchmark (`<= 30s`).
3. Record real command output and requirement traceability table in `docs/proof/phase-<N>-report.md`.
4. Verify clean `git status`, no secrets, then commit in small logical slices and tag `phase-<N>`.
