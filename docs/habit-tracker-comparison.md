# Habit Tracker: previous app and current direction

On 2026-11-08 the owner provided screenshots and, later, a local reference copy of the previous tracker. The reference was inspected read-only; its files are not part of this repository or deployment. Online research included Loop, HabitKit, Streaks and Everyday. Product descriptions were not independently tested. This is an analysis, not an instruction to copy the previous interface or implementation.

## Previous app

The old daily view combined a date strip, unlogged-day reminders, fixed-habit logging/performance, flexible weekly progress, personal outcome labels, notes and recent per-habit markers. A week grid allowed catch-up, while management included schedules, criteria, icons, ordering and pauses. Its richer insights were used less often by the owner. Strengths are meaningful personal labels, compact context and actionable catch-up; tradeoffs include a dense phone screen and implicit tap-to-cycle correction.

The old scoring engine made deliberate distinctions: Done=1, Partial=0.5, Missed=0; performance divides points by scored outcomes, while coverage counts recorded opportunities; unlogged is not Missed; fixed daily scoring excludes flexible habits. Flexible targets are bounded by eligible days for the period, and the old completed-week streak uses the target capped to available days. The old fixed streak begins yesterday even if today is recorded. The old app has effective-dated criteria but its habit type holds one current schedule rather than the current app's schedule history. Some old aggregate weekly/monthly views combine fixed and flexible results; these are not interchangeable with the current fixed-only percentages.

## Current app and deliberate differences

The current app keeps raw outcomes, exact habit/date identity, local dates, separate performance and coverage, effective-dated schedules and criteria, and the owner's later decision that flexible weeks affected by a pause or explicit skip are excluded from target-completion judgments, not automatically assigned a smaller target. Flexible-week insights exclude current/incomplete weeks and weeks with schedule changes. These rules should not be replaced with old scoring merely to match the old app. Archive dates are not recorded; archived habits are excluded from some derived statistics.

The current daily check-in uses date-effective personal labels in place of defaults, saves selected outcomes immediately and closes the editor. Notes save when the field loses focus or the editor closes. Compact seven-day markers and the week view distinguish outcomes, unlogged fixed days and optional flexible days using symbols and accessible labels; corrections use Week. The daily fixed score makes the existing performance calculation visible alongside the logged count, while flexible weekly progress remains separate. Catch-up lists unlogged fixed days from the last seven days and excludes archived habits. Flexible progress on a selected date includes eligible flexible results only through that date; a whole week with a pause or skip remains excluded from target judgment. An unlogged current day no longer immediately breaks a fixed streak, while past unlogged due days still do. Habit management summarizes the current schedule; contextual help explains outcomes and scores.

Icons are optional and survive backups; the earlier converted backup did not include them. No old-data import, push notifications or offline mode are introduced. The reference copy may contain private information and must not be committed. Phone-width browser checks use fake or demo data; they do not prove real Supabase isolation, conflicts or recovery. The owner continuously reviews their phone experience rather than maintaining a generic phone-review task.

## References

- [Loop Habit Tracker](https://github.com/iSoron/uhabits): flexible schedules, history and gradual scoring.
- [HabitKit: how the grid works](https://habitkit.app/help/getting-started/how-the-grid-works): compact visual history.
- [Streaks](https://streaks.app/): focused daily habits and schedule-aware goals.
- [Everyday](https://everyday.app/features): habit board and skip choices.
- [W3C: use of color](https://www.w3.org/WAI/WCAG21/Understanding/use-of-color.html) and [target sizes](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).
