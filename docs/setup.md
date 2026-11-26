# Setup

## Local development

Use Node.js **24 or newer**; `.nvmrc`, package engines and CI select that runtime. Check `node --version` in the actual shell before installing dependencies.

```sh
npm ci
# Only if .env.local is missing:
cp .env.example .env.local
npm run dev
```

Before starting Vite, fill in `.env.local` with the Supabase project URL and publishable key. The file is ignored by Git. Open the URL Vite prints; restart Vite after changing environment values. `npm run build` checks TypeScript and creates `dist/`; `npm run preview` serves that production bundle. There is no separate lint or formatter task. Settings displays the version from `package.json`.

## Public configuration and authentication

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Only `sb_publishable_…` keys are supported; legacy JWT and secret/service-role keys are rejected. Missing or invalid configuration disables sign-in while leaving demo mode available.

Every `VITE_` value is public in the downloadable bundle, including values supplied through GitHub Secrets. Never place database passwords, secret/service-role keys or access tokens there. Server permissions protect account data.

Supabase uses email/password authentication. Its Site URL and redirect allow list must cover the deployed site and intended local URLs, such as `http://localhost:5173/`. Signup remains open during development, with email confirmation enabled according to the reported dashboard configuration. Availability, confirmation and delivery settings belong to the target project; check them when investigating authentication failures. Database prerequisites and reported installation state are in the [migration runbook](supabase-migrations.md).

## Checks

| Command | Coverage |
| --- | --- |
| `npm run test:config` | Public configuration, UI conventions and generated avatar previews |
| `npm run test:schema` | Migration behavior in embedded PGlite |
| `npm run test:history` | Domain rules, backups and stores |
| `npm run test:browser` | Playwright interactions using demo/fake services |
| `npm run build` | TypeScript and production bundle |
| `npm run test:pwa` | Production service-worker/update behavior; build first |

Focus a domain file with `node --import tsx --test tests/recipes.test.ts`, or a browser case with `npm run test:browser -- tests/browser/recipes.spec.ts -g 'pattern'`. Browser tests start their own Vite server at `127.0.1.1:4179` without reusing an existing server. Install the browser with `npx playwright install --only-shell chromium`, or set `CHROMIUM_PATH` to an installed executable. Linux may also need `npx playwright install-deps chromium` for system libraries.

## GitHub Pages and updates

[The Pages workflow](../.github/workflows/deploy.yml) deploys `main` to `https://kushagrashah.github.io/the-one-ring/`. Select GitHub Actions as the repository's Pages source. Supply the two public configuration values as Actions variables or secrets; secrets take precedence. CI validates them before dependency installation. Changing configuration requires rebuilding the site. Keep Vite's relative `base: './'` for the Pages subpath. Pages deploys the frontend; database installation is separate.

The production service worker caches the shell. It checks for updates on open and return to the foreground; Settings also offers **Check for updates**. **Update app** activates a waiting worker and reloads automatically after a fresh safety check. Profile and app edits and pending saves block the update; leave workout editing screens and exit demo first. If work becomes unsaved while activation is pending, save or cancel it and click **Update app** again. Another tab can activate the worker, but this tab still waits for its own guarded click. These guards do not protect edits in other tabs. The first installation has no update prompt.

## Preview limitations

Account work requires connectivity. In-memory drafts and unconfirmed changes can be lost on close or crash; demo resets on refresh. Keep exports of important records. See [architecture](architecture.md) for save recovery and backup guarantees.

Automated tests use PGlite, simulated transport and browsers with fake services. They do not establish live Supabase isolation, real network recovery or physical-device behavior. Reported SQL installation is distinct from signed-in persistence verification. Live signup/email/redirect and profile persistence, broad restore recovery, signed-in update guards and Android updates remain incompletely verified. Recovery accessibility and visual/device checks are outstanding. Whole-workspace performance near storage limits has not been measured. PWA test server cleanup on browser launch failure remains unresolved.
