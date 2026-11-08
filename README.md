# The One Ring

The One Ring is a personal, mobile-first home for small apps that make everyday life easier. It includes Workout Tracker and Habit Tracker.

This is an early preview. The online-only version uses Supabase storage and still needs live-device and security verification. Demo data is temporary. Export backups and don't rely on the preview as your only copy of important records.

## Run locally

Requires Node.js 24 or newer:

```sh
cp .env.example .env.local
# Add your Supabase project URL and publishable key to .env.local
npm install
npm run dev
```

Open the URL printed in the terminal. Run `npm run build` to check the production build.

See [setup and current limitations](docs/setup.md), [v0.2.0 notes](docs/releases/v0.2.0.md), and [next steps](docs/next-steps.md).

## License

[MIT](LICENSE) · Copyright © 2026 Kushagra Shah.
