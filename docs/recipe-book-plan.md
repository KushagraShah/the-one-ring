# Recipe Book: meal-prep preview

## Status and scope

The approved redesign and account integration are included in the main release, version 1.1.1. The owner reported successful execution of the supplied SQL queries on 2026-11-22 and authorized merge/deployment. The original preview checkpoint was `b2c96f8` (1.0.0), followed by merge preparation at `60b19df` (1.1.0). See the [Recipe Book Supabase runbook](recipe-book-supabase.md) for installation history and verification limits. Demo is temporary and resets on refresh.

The app supports a personal vegetarian meal-prep collection with authored portions and nutrition. It does not generate recipes or calculate nutrition from ingredients. No ingredient library, pantry inventory, automatic scaling, AI service, images, web scraping, offline sync or sharing is implemented.

## Plan, rotation and sides

- Plan, Recipes, Shopping and Cooking are freely accessible views. Two recipes per prep is a suggestion, not a limit. Plans retain snapshots of chosen recipes and sides. Changed/deleted recipes produce a contextual notice; using a newer saved recipe is an explicit confirmed action.
- Rotation membership is manual. Plan gently suggests a rotation recipe not already chosen, prioritizing never-prepared recipes, then the oldest recorded preparation date. A confirmed **Finish and record** updates the recipe's last-prepared date; cancelling cooking does not. There is no nutrition score, forced schedule or automatic rotation membership.
- All recipes, Rotation, Ideas and Archived keep readiness, archive state and rotation distinct. Ideas are incomplete drafts saved as library records. Archiving or marking an idea removes rotation membership without deleting content; restoring does not silently rejoin rotation. Ideas and archives are excluded from new plan, shopping and cooking pickers. Existing snapshots remain usable.
- Sides are lightweight reusable presets outside the main recipe library, with an optional authored portion, four macro values and exact shopping text. Editing/deleting a preset does not change a chosen plan or cooking side. Choose a side again to replace the plan copy.
- Combined per-meal nutrition appears only when both portions are described and all four values are usable. Numeric values, decimals, `~`/`≈` approximations and hyphen/en-dash ranges are supported. Missing/ambiguous values are never zero. Values remain authored and their scope requires review; there is no automatic inference about whether a recipe already includes its side.
- Shopping uses the side's shopping text exactly once per planned meal, without multiplying it by yield. Repeated plan handoff adds only newly chosen meals; edits to already handed-off meals do not rewrite shopping. Start next prep clears only the plan after confirmation.

## Editing and importing

The guided editor has separate Basics, Nutrition, Ingredients, Steps, Notes and Review screens within a styled dialog, full-screen on phones. Each major cooking step has its own field and preserves paragraphs and nested Markdown lists. Quick glance is authored, never generated. Structured fields are authoritative; rendered/exported Markdown is generated from them, and workspace validation rejects mismatched copies.

Markdown/Notion-text and a documented recipe JSON object can be imported into a reviewable guided draft. The original source is retained separately and can be compared in its own dialog. Normal edits retain it. Reimport explicitly replaces editor fields and retained source after confirmation when the draft contains content. JSON accepts text fields `title`, `description`, `portions`, `quickGlance`, `notes`, text arrays `fresh`, `pantry`, `steps`, and a `nutrition` object with text `scope`, `calories`, `protein`, `carbs`, `fat`.

Markdown import recognizes common emoji headings, portions/serves/yield fields, fresh/pantry groups, ingredient tables with named quantity columns, per-portion nutrition tables, numbered instructions and numbered major-step headings. Nested step content remains with its major step. Unmapped text/tables, cost/calculation columns and code blocks stay in the retained source and produce relevant warnings. Contradictory recognized macro values are left blank for an explicit choice. Batch-only nutrition tables are not used as per-portion values. This is conservative extraction, not a universal Notion or Google Keep parser: review the fields against the original, especially rough notes and unsupported layouts. Acknowledging warnings is explicit and retained warnings remain visible to phase extraction where applicable.

Legacy Markdown recipes remain readable/editable with the existing template editor and extraction semantics. Converting one to guided fields is explicit and reviewable. Existing shopping/cooking snapshots are not re-parsed by the new importer, preserving saved step indices. The legacy template recognizes a `#` title, `Portions:`, `Macros per portion:`, `## Quick glance`, Ingredients/Pantry bullets and numbered Instructions. Unsupported legacy content remains in the full recipe with extraction warnings. Recipe changes do not recalculate nutrition; review shows a compact reminder when portions/ingredients changed without macro edits.

## Shopping and cooking

Shopping keeps items separate by recipe, in a stable order, with distinct Have/Bought buttons and an accessible Need reset. It can append recipes and edit/remove/add checklist items without changing source recipes or clearing existing statuses. Plan handoff markers survive ordinary recipe additions. End shopping is confirmed, including remaining Need items and any unadded text.

Cooking starts directly from its picker, a recipe or a planned snapshot. A planned side is retained with the cooking copy. Steps render Markdown; quick glance stays nearby. View full recipe opens a separate independently scrollable dialog; ×/Escape returns to the same step. Confirmed finish records today's local preparation date, while confirmed cancellation discards only cooking progress. Restart with saved recipe is deliberate and preserves the cooking side. Shopping and cooking show source-change/deletion notices and retain independent snapshots. Older shopping lists without source identities explicitly say changes cannot be checked.

The library remains behind detail/editor dialogs without resizing. App actions use styled touch-sized buttons, × close controls and action-specific confirmations; no accordion or native select/popup is added. Markdown supports tables without executing raw HTML or loading remote images. Actual external references remain links because they navigate to external content.

Recipe detail gives cooking and planning the two prominent action buttons. A pencil in the header edits the recipe; the adjacent options icon opens a separate styled window for rotation, readiness, archive, guided conversion and deletion. These controls retain their existing confirmation and snapshot behavior. Small “i” controls explain recipe status, macros, plan snapshots, rotation suggestions, combined nutrition and editor nutrition/quick glance. They open on hover, keyboard focus or phone tap, dismiss with another tap, outside interaction or Escape, and Escape closes help before its containing recipe window. The small icon retains a 44-pixel touch target.

Help is brief and specific to the adjacent label: status explains only the current state, and combined-nutrition help explains either the total or the missing fields. An open info control paints above neighboring info icons so they cannot overlap the tip text.

## Data, drafts and compatibility

Workspace version 3 adds structured content, metadata, sides and plan snapshots. Version 1 and 2 load into version 3 without rewriting recipes or phase snapshots. Recipe-only backups and full three-app format-2 backups retain all saved recipe workspace fields. Workout/habit format 1 remains compatible. Full restore validates first but saves each app separately and can partially complete.

Account saves keep the existing owner-scoped revision and retry protocol. Editor, side and shopping drafts are protected from unintended dismissal/sign-out/reload; they are not crash-durable or included in app backups until saved. Save failure recovery opens above dialogs and offers separate JSON text-draft export for manual recovery, alongside workspace export and retry. The recovery JSON is not a restorable app backup.

Migration `202611220008_recipe_format_guard.sql` rejects older-format writes over versions 2/3, checks numeric supported versions and the main workspace containers, and refreshes the API schema cache. It does not fully validate recipe domain data. The owner confirmed successful installation of 007/008 on 2026-11-22; do not rerun them. Older clients reject version 3 during normal load. Do not use older clients to overwrite newer data.

Automated checks use demo data, a fake Supabase endpoint and PGlite, including the actual Supabase client/store calling the real migration SQL through a simulated PostgREST transport. They do not establish live Supabase isolation/recovery, physical-device behavior or offline support. See the agent log for the completed verification run.
