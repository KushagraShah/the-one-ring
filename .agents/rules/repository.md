# Repository rules

Keep persistent context small, current and relevant. Maintain one authoritative home for each fact. Update or remove superseded text instead of appending corrections. Historical logs are local records, never required reading. Governance changes require an explicit user request and Instructor; ordinary application approval is not an exception.

Inspect the working tree before editing and preserve unrelated work. The One Ring has a shared shell plus Workout Tracker, Habit Tracker and Recipe Book. Locate current code through `docs/architecture.md` when needed; old plans and retained experiments are not implementation authority. Keep shared wording app-neutral. Product ideas do not authorize new features or integrations.

Use Node 24+ and check the actual runtime. Commands live in `package.json`; `npm run build` includes TypeScript checking, and there is no separate lint task. Choose relevant verification using `one-ring-verify-change`. Inspect test scripts before running them. Finish implementation before routine verification, and report actual checks and material gaps accurately.

Update ordinary docs when behavior or setup changes. Keep `docs/setup.md` operational, `docs/architecture.md` structural, `docs/app-behavior.md` about current domain behavior, and `docs/next-steps.md` about unresolved priorities. Link to the authoritative page instead of repeating it. General pages should usually fit 400–800 words; tested runbook examples justify exceptions. Retire completed plans after preserving valid decisions; use Git history rather than a docs archive. Do not maintain an accumulating release narrative.

Write one fresh short ignored task log at completion. Do not read old logs by default. Plans stay in chat unless requested. Protected paths and ownership are listed in `.agents/README.md`; report stale rules to the user instead of editing them as Developer, Manager or Reviewer.

Keep private backups, screenshots, conversion outputs and browser profiles out of Git. Never stage `habit-tracker-copy-ref-donotpushtogit/`; it is a private read-only reference, not publishable code. Use ignored `*.local` directories for temporary project artifacts.

Authorization is task-specific. Do not infer permission to publish, rewrite history, change live systems or access private accounts from an old document. Keep package/lock versions consistent if an approved task changes them. No tags or GitHub Releases without explicit authorization.
