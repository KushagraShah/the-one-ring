# Agent entry point

Read [.agents/rules/repository.md](.agents/rules/repository.md), then use [.agents/README.md](.agents/README.md) to select only guidance relevant to this task. Inspect the affected implementation and tests. Do not load every document, old plan or historical log.

Keep persistent context small, current and relevant. Each fact has one authoritative home; update or remove superseded text instead of appending corrections.

Manager, Developer and Reviewer must not change this file or protected governance. Only Instructor may maintain it on an explicit user request. Native roles live in `~/.config/opencode/agents/`; their workflow is not duplicated here.

Write a fresh short task log in ignored `.agents/logs/` at completion. Save plans under `.agents/plans/` only when requested. Never commit logs or the local reference app.
