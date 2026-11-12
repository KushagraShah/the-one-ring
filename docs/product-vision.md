# Product vision and future direction

This document records the owner's long-term ideas and working principles discussed on 2026-11-11. It is a direction for future design, **not** a commitment to build these features, a finished security design, or a description of what the app currently does. Decisions about scope, design, providers and priorities remain open and need the owner's input.

## A personal digital home

The One Ring is intended to grow over time into a mobile-first home for tools tailored to the owner's life. The aim is to make useful things for personal needs and reduce reliance on inconvenient, paid or advertising-driven services where practical. Workout Tracker and Habit Tracker are the first mini-apps, not the identity or limit of the platform.

The owner is considering moving some uses away from Notion and other apps. Possible future tools include a recipe book, work portfolio, finance tracking and photo organization or cleanup. These are examples, not approved feature specifications or a promised roadmap.

## The rings as a theme

The name and envisioned overhaul draw inspiration from *The Lord of the Rings*. The owner's initial idea is:

- **Nine human rings:** mini-apps that the owner uses.
- **Seven dwarf rings, four eaten by dragons:** potentially services or background capabilities.
- **Three elven rings:** potentially integrations or monitors.

The owner clarified that the nine Rings of Men are the nine mini-app slots: Home shows the two existing apps and seven unassigned placeholders. This visual choice does not impose a technical app limit. The roles of the dwarf and elven rings remain undecided and should follow actual needs; a separate view presents them as concepts. The deployed dragon-ring interaction is playful and non-persistent, with four randomly selected Dwarf rings; it does not implement services. The ring theme preserves workout and habit accents and workflows. Keep labels and navigation explicit. Consider intellectual-property implications if the project is ever distributed or marketed beyond personal use.

## Privacy, sharing and integrations

The owner may eventually onboard a partner or family members, add carefully scoped social features, or connect mini-apps. These are future possibilities, not current functionality or authorization to share data. Data movement, permissions, transactions and exceptions must be understandable and deliberately controlled.

Possible integrations include read-only financial account access, Samsung Health, Google Photos and email masking. Each has different data, permissions, provider constraints and risks. Before implementing one, investigate its actual API and access model, assess threats and failure modes, and agree on what data is accessed, retained, shared and deleted. Read-only access is still sensitive; never infer that a service or account grants permission to connect.

Working principles for future design—not claims about current implementation:

- Default to private data and explicit, narrowly scoped sharing; make ownership, access and revocation understandable.
- Give each mini-app clear responsibility for its own data and rules. Inter-app access and data movement should be intentional and visible, not implicit.
- Distinguish read access from write authority and use least privilege. Protect credentials and privileged operations on trusted infrastructure, never in browser-delivered code.
- Make consequential actions, transactions, background jobs, failures and recovery clear. Design confirmation, retry and idempotency appropriate to each operation; do not silently overwrite or duplicate work.
- Consider export, deletion, retention, recovery and provider portability when introducing data or dependencies. Portability is a goal, not a guarantee.
- Verify security against the actual deployment and users; automated tests and demo behavior alone do not establish live isolation or privacy.

## Infrastructure can evolve

The current app targets GitHub Pages, an installable web app and Supabase's free tier. Account data is currently online-only and revision-checked; see [setup and current limitations](setup.md) for what exists and what remains unverified. Static Pages hosting cannot keep backend secrets. The owner may eventually choose a custom hostname, paid hosting, AWS with workers and a database, a self-hosted server, or another arrangement. None has been selected or authorized.

Choose infrastructure in response to concrete needs, security, operational burden, portability and cost. A custom domain does not by itself require a backend migration. Avoid building a speculative plugin platform or provider abstraction before it solves a real problem; equally, avoid unnecessary coupling when a simple boundary is practical.

## AI agents and human judgment

The owner intends AI agents to build the project, with human judgment retained for product direction and consequential engineering decisions. Agents should follow the repository handoff, preserve existing work and data, and surface meaningful uncertainty rather than silently choosing privacy, security or sharing policy.

For consequential work, document the relevant decision and alternatives, affected data and permission boundaries, verification and limitations, and any necessary owner approval. Tests, deployment and review are evidence, not a substitute for evaluating real-world security and operations. No agent should infer authorization to access accounts, connect services or perform destructive changes from this vision.

## Possible sequence, not a commitment

1. Develop a concise product/security charter with the owner, including trust and sharing boundaries.
2. Verify real-account isolation, conflicts and recovery; decide signup availability when onboarding is complete.
3. Continue evolving the deployed ring-inspired visual direction without forcing a speculative platform structure.
4. Build the next useful tool and extract shared capabilities only as actual workflows justify them.
5. Design each sensitive integration and any infrastructure migration separately, with an explicit security and operational review.

The owner can change this order, defer items or choose a different direction. See [next steps](next-steps.md) for nearer-term follow-ups.
