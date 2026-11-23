# The One Ring

A personal, mobile-first home for Workout Tracker, Habit Tracker and Recipe Book. Account data lives in Supabase; demo mode uses temporary examples.

## Run locally

Use Node.js 24 or newer, then run `npm ci`. Copy `.env.example` to `.env.local` if it is missing, set the public Supabase configuration, and run `npm run dev`.

See [setup and verification limits](docs/setup.md) before relying on the preview for important data.

## Documentation

- [Architecture and persistence](docs/architecture.md)
- [Current app behavior](docs/app-behavior.md)
- [Product vision](docs/product-vision.md) and [next steps](docs/next-steps.md)
- [Supabase migrations](docs/supabase-migrations.md) and [Recipe Book installation](docs/recipe-book-supabase.md)

## License

[MIT](LICENSE) · Copyright © 2026 Kushagra Shah. Artwork has [separate provenance and licensing notes](src/assets/README.md).
