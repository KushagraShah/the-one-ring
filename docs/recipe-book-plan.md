# Recipe Book: local first implementation

## Purpose and decisions

The owner creates precise vegetarian, macro-aware meal-prep recipes outside the app with AI tools. The app is not an AI recipe generator, meal diary or nutrition authority. It should support a personal collection, explicit shopping and cooking phases, fixed portions, metric ingredients and authored per-portion macros. A pantry inventory, images, web importing, automatic nutrition calculation, scaling, offline sync and sharing are not in scope. No real recipe examples were supplied; demo examples are fictional.

Recipe, Shopping and Cooking are separate, freely accessible views. Opening a library recipe shows a styled, independently scrollable dialog, full-screen on phones, rather than resizing a library card; × and Escape close it. Shopping uses per-recipe ingredient snapshots, not guessed combined quantities. Items stay in place with clearly labeled Have/Bought actions, a Need reset, visible status and a summary; no persistent pantry inventory. Cooking offers its own recipe picker when no phase is active, then snapshots the chosen recipe and saves a current step. A separate full-recipe screen returns to the current step; it does not use expanding sections. Both phases can be resumed after closing once online saves are confirmed. One active phase of each kind is supported initially. Ending a phase is explicit and confirmed.

The local preview uses the shared dark forest and aged-gold surfaces with a fixed warm terracotta (`#efaa89`) recipe accent throughout the shell and cookbook views. The book-spine heading, selected page tabs and recipe cards retain a distinct cookbook character. The color revision is for owner review; it does not change the established workout or habit palettes.

## Markdown and fidelity

The template uses a `#` title, optional `Portions:` and `Macros per portion:` lines, and `## Quick glance`, `## Ingredients`, `## Pantry`, and `## Instructions` sections. Quick glance is authored Markdown displayed during cooking, not a generated summary; older recipes without it show an explicit empty state. Ingredient bullets and numbered instruction lines are extracted. Original Markdown remains intact; recipe details and the full cooking recipe render Markdown, including tables, without executing raw HTML or loading external images. Add/edit opens its own styled window, full-screen on phones, with review as a separate view in that window; × and Escape retain the discard confirmation. Parsing is deliberately conservative: review extracted data and warnings before saving, with a return to the retained draft; never infer quantities, macros or units. Markdown is authoritative; editing re-parses the whole document. Phase snapshots do not change on edits. This is a first template, not a claim that arbitrary Markdown imports correctly.

## Implementation and safety plan

1. Add an independently owned recipe workspace, revision-checked Supabase RPC and a local-only migration; do not apply it without explicit owner authorization. Demo remains in memory. Account preview requires that migration; no demo data enters accounts.
2. Add a distinct mobile-first recipe app, import review, library, shopping checklist, cooking step navigation and deliberate completion. Preserve authored Markdown and show structured extraction without rendering unsafe HTML.
3. Integrate launcher, app switching, sign-out and update draft/save guards. Provide recipe-only export/restore; the existing full backup remains explicitly workout/habit-only in this first local preview and must not be called a complete backup for recipes.
4. Validate workspace/restore data, revision conflicts, retries and snapshots; exercise parser and core interactions using demo/fake service. Do not claim live Supabase, real device or offline verification. Show loading/error and recovery; no SQL execution against the real project.
5. Owner reviews the local preview. Refine interaction, import format, full-backup integration, migration application and real service safety before any deployment.
