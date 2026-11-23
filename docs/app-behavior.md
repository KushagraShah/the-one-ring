# App behavior

This describes current workflows and domain rules. [Architecture](architecture.md) covers storage, recovery and backups; [setup](setup.md#preview-limitations) records verification limits.

## Workouts

### Library, routines and session scope

A library entry represents an exact exercise/machine variant. Stable identity owns its history; renaming does not create a new exercise, and similar names do not justify comparing raw weights across machines. Entries have setup, instructions/reference links, optional tags and reversible archive. Archive hides an entry from the default library view without removing it from routines, history or other pickers. Setup saves separately from workout results.

Routine building is separate from training. Day selection uses tabs; exercise ordering uses explicit controls. Edits remain a draft until **Save changes**. An active workout blocks saving or switching routines; cancelling it from the builder preserves the routine draft. A session can start from a suggested remaining day, another selected day or a free workout. Today-only substitutions and extras do not modify the routine.

Exercise cycles belong to a routine and can link multiple days. Linked days share progress. Only completing a member chosen through the dedicated **Exercise cycle** selector counts toward it. Performing A then C leaves B as the next suggestion; completing all members starts another pass. Skips, ordinary replacements, extras and repeating an already-accounted member do not advance it. Cycle progress commits when the workout explicitly finishes; cancelling leaves it unchanged.

### Logging and completion

The focused exercise shows setup and up to three recent results. Previous/next controls and a bounded overview select exercises without reordering; there is no exercise swipe navigation or session move-earlier/later action. Strength entry saves three sets and the result note together in one action, with shared or individual set weights. Cardio keeps duration, speed and incline in **degrees**, without inventing distance or converting to percentage grade. Blank weight is not zero. Legacy two-set results remain readable and editable without inventing a third set.

Confirmed results are locked until edited. Unconfirmed result/note edits remain drafts while navigating the session and warn before discard. Leaving can retain confirmed in-progress work for resumption; cancelling explicitly discards the session after confirmation. Completing or skipping every exercise still leaves the workout open for notes/extras until **Finish**. Finishing commits history and routine/cycle progress together within the workout workspace.

New sessions retain original plan snapshots and performed order, including cycle selections, substitutions and extras. New history captures routine/day context and cycle events; old history cannot recover facts it never stored. One workout date applies to all results, defaults from finishing, and can be corrected later without changing original start or cycle-event timestamps.

### Activity and corrections

Activity filters workouts by exercise and inclusive local dates, initially showing ten workouts with controls for more. Unfiltered previews show up to three exercises. Exact-exercise details offer setup, paginated performance history, notes and links back to workouts. Legacy name-only results remain accessible in history filters, while exact-ID details do not guess a variant; session quick history retains best-effort name matching.

Workout details allow completed result/note, date and confirmed exercise-identity corrections. Identity correction preserves the original recorded identity and plan snapshot. Historical corrections do not recalculate routine or exercise cycles.

Insights show counts over local-calendar periods and comparisons with the preceding equal-length period. Counted training excludes future and all-skipped/empty workouts; legacy two-set results count as recorded results. Day distributions use saved labels, including inferred labels in converted history. Optional strength trends show recorded top weights with reps; cardio shows a selected recorded metric. Rep comparisons require three sets with matching corresponding weights and numeric reps. These are descriptive measurements, without cross-machine scores or inferred training advice.

## Habits

### Dates, schedules and entry

Each habit has an active date range, fixed or flexible schedules, optional personal criteria/labels, pauses and one outcome per local calendar date. Weeks run Monday–Sunday. Schedule and criteria edits take a chosen effective date, retaining earlier versions; historical corrections use the rules effective on the selected date. A timed pause includes its end date. Future dates cannot be logged.

Daily cards offer Done, Partial, Missed and a separate intentional skip. Personal labels do not change the stored outcome: calling a Missed label “Skipped” does not make it an intentional skip. Outcomes save immediately; tapping the selected outcome again unlogs it while retaining its note. Notes save on blur/close. Older backups without retained `unloggedNotes` remain valid.

Today/date-picker navigation, seven-day markers, Week corrections and catch-up provide historical entry. Catch-up lists unlogged fixed opportunities in the preceding seven days, excluding archived habits. Flexible eligible days are opportunities rather than fixed obligations. Confirmed bulk Done covers remaining eligible unlogged fixed and flexible habits; bulk Missed covers fixed habits only. Existing outcomes and notes are preserved.

### Scores, coverage and streaks

Fixed performance is `(Done + 0.5 × Partial) / (Done + Partial + Missed)`. No scored outcomes displays an em dash. Unlogged is not Missed. Coverage measures scored outcomes against fixed opportunities after excluding intentional skips. A skip is a one-day pause: it contributes neither score, coverage nor fixed streak length and does not break a streak. This applies to historical skips too.

Fixed success streaks require Done; Partial preserves engagement but breaks success. Missed or a past unlogged due day breaks both. An unlogged current day is pending. Flexible activity and targets remain separate from fixed scores; Done contributes one weekly point, Partial half and Missed zero. Selected-date progress includes only eligible flexible results through that date.

Flexible weekly target judgment requires a completed full active week with one unchanged flexible schedule and no pause or skip. Excluded weeks do not break weekly streaks. Monthly flexible activity counts outcomes rather than allocating weekly targets across months. Archived habits are excluded from summary denominators/streaks because archive dates were not recorded; their history remains accessible. Changing active dates or effective schedules can change derived statistics.

Management supports editing/reordering, pause/resume, extension, archive and confirmed permanent deletion. Insights separate fixed performance/coverage from flexible activity, include notes, monthly history and eight-week results, and preserve return context after date corrections. Rankings require at least three scored fixed outcomes; the workload prompt is a labeled heuristic.

## Recipes

### Plans, rotation and sides

Plan, Recipes, Shopping and Cooking are independent views. Two recipes per prep is a suggestion, not a limit. Chosen recipes and sides are snapshots: later edits/deletions produce notices without silently rewriting them. Applying a newer source is deliberate. Shopping and cooking retain independent copies, including when the plan is cleared.

Rotation membership is manual. Suggestions prefer never-prepared recipes, then the oldest recorded preparation date, excluding recipes already planned. Confirmed **Finish and record** records today's local date; cancellation does not. Ideas are saved incomplete library records. Ideas and archived recipes are excluded from new selection pickers; marking an idea or archiving removes rotation membership. Restoring does not silently rejoin rotation, and existing snapshots remain usable.

Sides are reusable presets with an authored portion, nutrition and exact shopping text. Editing/deleting a preset does not alter an existing chosen copy. Combined per-meal nutrition requires both portion descriptions and all four usable macro values. Numeric values, decimals, approximations and ranges are supported. Missing/ambiguous values are not zero; nutrition is authored, never calculated from ingredients. Check whether a recipe's values already include its side. Side shopping text is copied once per planned meal without yield scaling.

Repeated plan handoff adds only new meals; editing an already handed-off meal does not rewrite shopping. **Start next prep** confirms before clearing only the plan.

### Editing and importing

Recipe detail, Add/Edit and the full recipe during cooking use separate styled dialogs, full-screen on phones. The guided editor separates Basics, Nutrition, Ingredients, Steps, Notes and Review. Major steps preserve paragraphs/nested lists. Structured fields generate displayed/exported Markdown; mismatched stored copies fail validation. Quick glance is authored, never generated.

Markdown/Notion-text and structured JSON import create a reviewable draft and retain the original source for comparison. Normal edits keep that source; reimport confirms replacement when the draft has content. The JSON object accepts text `title`, `description`, `portions`, `quickGlance`, `notes`; text arrays `fresh`, `pantry`, `steps`; and text-valued `nutrition` fields `scope`, `calories`, `protein`, `carbs`, `fat`.

Import recognizes common headings, portions/yield, ingredient tables, per-portion nutrition and numbered instructions. Unsupported structures remain in the source with contextual warnings; conflicting recognized macros are left blank for author review. Batch-only nutrition is not adopted as per-portion data. Compare extracted fields with the original before saving.

Legacy Markdown retains its template/extraction semantics until explicit guided conversion. It recognizes a `#` title, `Portions:`, `Macros per portion:`, `## Quick glance`, Ingredients/Pantry bullets and numbered Instructions. Existing phase snapshots are not re-parsed, preserving step indices. Recipe edits do not recalculate nutrition. Workspace compatibility is documented in [architecture](architecture.md#backups-and-compatibility).

### Shopping and cooking

Shopping keeps stable item order, distinct Have/Bought buttons, a Need reset and counts. Recipes/items can be appended, edited or removed without changing sources or clearing existing statuses. Ending shopping confirms remaining Need items and unadded text.

Cooking starts directly from its picker, a recipe or a planned snapshot, retaining any chosen side. Steps and the full recipe render Markdown. Closing the independently scrollable full-recipe dialog returns to the same step. Confirmed cancellation discards cooking progress; restarting with a saved recipe is explicit and preserves the cooking side. Older shopping snapshots without source identities explain that changes cannot be checked.

Markdown supports formatting/tables without executing raw HTML or loading external images. There is no ingredient-derived nutrition, automatic scaling, pantry inventory, AI service, scraping or photo support.

## Shared interaction

Actions use labeled touch-sized controls, styled choices/details and in-app confirmations rather than native selects, expanding sections or JavaScript alert/confirm popups. Close controls use ×. Workout backdrop/Escape closing follows the same guarded close action; dragging from inside does not dismiss. Habit details use inline panels. Browser date/month/file pickers and leave-page warnings remain browser-controlled.

Settings holds profile, backups and artwork credits. Avatar selection is a draft until **Save profile**; new/default profiles use Sauron. Retired avatar IDs still render without migration. Artwork provenance remains in [the assets README](../src/assets/README.md).

Home presents three available app rings and six unassigned placeholders. The separate Dwarf-ring interaction randomly chooses four of seven rings for a dragon result; reduced motion skips animation. It resets on leaving, persists nothing and represents no background service. Elven rings are decorative.
