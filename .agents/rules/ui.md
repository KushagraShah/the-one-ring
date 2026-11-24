# UI rules

Use mobile-first forest/gold shared surfaces, neutral shared navigation, blue workouts, violet habits and terracotta recipes. Keep the mobile app-ring strip with fixed Home/Settings and the desktop list of available apps. Preserve each app's leave, sign-out and update guards when changing navigation.

Do not introduce expanding/collapsing sections, native select dropdowns or JavaScript alert/confirm popups. Reuse `ChoiceSelect`, `DetailView`, `AppDialog`, `ConfirmDialog`, `CloseButton` and `InfoTip` where appropriate. Date/month/file pickers and before-unload warnings remain browser-controlled.

Use touch-sized buttons with clear labels; close uses × with an accessible name. Preserve discard and destructive confirmations, including workout cancellation. External references can remain links. Keep accessible textual equivalents for charts and status; do not rely on color, hover or animation alone. Respect reduced motion.

Preserve the current workflow of the affected app; consult only its section in `docs/app-behavior.md`.

Edit avatar source `src/assets/avatars/portraits.svg` and regenerate its standalone previews with `npm run avatars:generate`. Preserve `src/assets/README.md` provenance and source/license links when changing artwork.
