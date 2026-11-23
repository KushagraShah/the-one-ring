# Agent resources

The root entry point and `rules/repository.md` are the small common reading set. Use this map to select additional material; links are not an instruction to read every target.

| Task | Read when relevant |
| --- | --- |
| UI or navigation | [UI rules](rules/ui.md), affected section of [app behavior](../docs/app-behavior.md) |
| Persistence, backups, formats or SQL | [Data rules](rules/data.md), [architecture](../docs/architecture.md); SQL work also needs the [migration runbook](../docs/supabase-migrations.md) |
| Domain behavior | Affected app section in [app behavior](../docs/app-behavior.md), implementation and tests |
| Local setup or deployment | [Setup](../docs/setup.md) |
| Choosing verification | Load `one-ring-verify-change` |
| Completing a task | Load `one-ring-task-closeout` |
| Product direction | [Product vision](../docs/product-vision.md), [next steps](../docs/next-steps.md) |
| Explicit governance maintenance | Instructor reads the affected governance and native agent definitions |

## Ownership

Protected governance comprises `AGENTS.md`/`CLAUDE.md` at any level, this index, `.agents/rules/`, `.agents/skills/`, `.agents/templates/`, project OpenCode configuration, and global OpenCode configuration and agent definitions. Manager, Developer and Reviewer may inspect it as needed and flag mismatches, but cannot edit it or bypass permissions through shell, alternate files, symlinks or configuration. Instructor maintains it only when the user explicitly requests this work. The user selects Instructor directly; it is not a fourth stage in ordinary tasks.

Developer can update ordinary human documentation with implementation. Reviewer checks documentation accuracy and unnecessary growth as part of independent review. Governance tool restrictions supplement instructions; approval-controlled shell is not an absolute filesystem sandbox.

## Plans and local logs

Plans stay in chat unless requested as files. Manager may create `.agents/plans/<task>.md` on request; Developer does not edit approved plans. No task directory is required.

At completion, create `.agents/logs/<date-time>-<task>.md` using the [template](templates/task-log.md), usually 150–250 words. The directory is ignored by Git and may be created on first use. Write a new file rather than appending project history. Historical logs are not startup context; read one only for a specific investigation or user request. Reviewer may inspect the current task's log to check its claims. Local logs are absent from fresh clones: lasting knowledge must be in maintained docs. Never stage ignored logs.

Skills and templates define procedures, not new authority. Do not add automatic instruction globs, duplicate agent-role definitions or a documentation archive.

## Local artifact homes

Keep the working tree readable. `supabase/migrations/` contains committed migrations only. Private exports and conversion inputs stay in the ignored root `backups/`; disposable reviews, scratch files, browser profiles and temporary SQL belong in ignored `.local/` subdirectories. `.agents/logs/` contains one fresh ignored task log per completed task. Remove disposable artifacts after use and do not create new root dot-directories or `*.local` folders.
