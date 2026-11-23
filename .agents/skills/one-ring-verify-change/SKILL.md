---
name: One Ring verification
description: Select targeted checks for an approved One Ring change and report the evidence accurately.
---

Inspect the diff, affected code and `package.json`. Check the shell's Node version; use Node 24+. Finish implementation before routine verification and run the checks relevant to actual risk once near completion. Do not add tests for trivial reversible edits or repeat successful broad checks without a reason.

| Change | Relevant checks |
| --- | --- |
| Documentation or governance | Links/anchors, retired references, scope/diff and duplication review; validate changed OpenCode configuration through its actual loader |
| Supabase runbook SQL examples | `node --test tests/habit-schema.test.mjs` when changing the tested habit examples |
| Shared UI/configuration/artwork | `npm run test:config`; focused browser coverage for changed behavior |
| Domain/store logic | Relevant files under `tests/` via `node --import tsx --test tests/<file>.test.ts`; use `npm run test:history` for changes spanning domains |
| SQL/schema | `npm run test:schema` or the affected schema test; inspect privileges, revision/retry and format guards |
| Browser interactions | `npm run test:browser -- tests/browser/<file>.spec.ts -g '<pattern>'` |
| TypeScript/build or production shell | `npm run build`; build before `npm run test:pwa` |

Playwright uses its own mock-configured server at `127.0.1.1:4179`, without existing-server reuse. Install the Chromium shell with `npx playwright install --only-shell chromium`, or use an installed executable via `CHROMIUM_PATH`; system libraries may also be needed. Avoid unnecessary dependency or system installation for documentation work.

Report commands actually run and results. Distinguish PGlite, fake service, production-shell simulation and real-service/device evidence. Tests do not expand authorization for live changes or protected edits. Reviewer independently checks the approved diff and relevant evidence.
