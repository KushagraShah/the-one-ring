---
name: One Ring task closeout
description: Finish an approved task with concise maintained documentation and one fresh untracked local log.
---

1. Inspect the complete task diff and new files. Preserve unrelated work and exclude private references, backups and local artifacts.
2. Update the existing authoritative human document for changed behavior/setup. Remove obsolete statements; link instead of duplicating. Keep proposals distinct from current behavior and recorded verification. Avoid conversation timelines and repeated caveats. Do not create an archive or mandatory plan file.
3. Manager, Developer and Reviewer must leave protected governance unchanged. Report a concrete mismatch for Instructor and the user. This skill does not grant an exception or publication authority.
4. Create `.agents/logs/` if missing. Write a new `<date-time>-<task>.md` using `../../templates/task-log.md`, usually 150–250 words. Do not open previous logs to imitate them or append to a project history. Record actual verification and unresolved limitations; Developer's checks are not independent review.
5. Verify that the log is ignored and absent from the index. Never force-add it. Fresh clones do not contain local logs, so lasting facts belong in maintained docs.
6. Report changed paths, tests/results and material remaining work. Reviewer may inspect the current task log. Manager reports independent review in chat; no shared accumulating completion file is needed. Save a plan only if the user requested it.

Commits, pushes, deployments, history rewrites and live-system actions require task authorization. If publication is authorized, verify the exact result and report it separately from local implementation. Do not import old permission claims from historical docs.
