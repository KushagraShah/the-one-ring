# Product vision

The One Ring aims to be a personal, mobile-first home for small tools that make everyday life easier. Workout Tracker, Habit Tracker and Recipe Book are the current apps; [app behavior](app-behavior.md) describes them. This page describes future intent, not approved implementation work or a promised roadmap.

## Useful tools with clear boundaries

The priority is a useful workflow tailored to real needs, with less dependence on inconvenient, advertising-driven or paid services where practical. Possible later tools include a work portfolio, finance tracking and photo organization. No next app is selected. Investigating the workflow should precede choosing features or infrastructure.

Each mini-app should own its data and domain rules. Shared navigation, identity and controls should make the collection coherent without making every tool depend on every other. Inter-app data movement should be visible and intentional. Shared capabilities can emerge from actual workflows; a speculative plugin platform or provider abstraction is not a current goal.

The ring theme provides a recognizable home rather than a technical app limit. Nine human rings represent app slots; Dwarf and Elven rings suggest possible future capabilities whose roles remain undecided. Labels and navigation should stay explicit. Artwork provenance and third-party terms remain separate from the code license, and wider distribution would require considering character and likeness rights as well.

## Privacy and deliberate connections

Partner/family access, sharing and social features are possibilities for later design. Current accounts do not imply permission to share records or connect services. Future designs should default to private data and explain ownership, access, revocation and deletion clearly.

Potential integrations include Samsung Health, financial account access, Google Photos and email masking. Each needs its own provider/API investigation, permission model and failure/recovery design. Read-only access can expose sensitive information. Agree on accessed data, retention and deletion before implementation; keep privileged credentials and operations on trusted infrastructure rather than browser-delivered code.

Consequential actions should communicate what changes, how completion is confirmed, and what happens on retries or partial failure. Export, recovery and portability should be considered when adding dependencies, without promising guarantees that have not been implemented and verified. A concise product/security charter could help settle these boundaries before a sensitive app or integration is chosen.

## Infrastructure and priorities

GitHub Pages and Supabase currently support the project. A custom domain, paid hosting, workers, AWS or self-hosting may become useful, but none is selected. Choose based on a concrete requirement, cost, operational burden, security and portability. A custom hostname alone does not require replacing the backend.

Account data is currently online-only. Offline sync, automatic cloud/email backups, integrations and sharing need separate scope and design; installing the web app does not supply these capabilities. Near-term priorities are making existing workflows dependable, resolving the evidence gaps in [setup](setup.md#preview-limitations), and choosing another tool only when its need is understood. Human judgment remains central to product direction and consequential engineering decisions, even when agents help build the software.
