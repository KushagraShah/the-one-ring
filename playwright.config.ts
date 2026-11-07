import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/browser',
  use: { baseURL: 'http://127.0.1.1:4179', viewport: { width: 390, height: 844 }, launchOptions: { executablePath: process.env.CHROMIUM_PATH || undefined } },
  webServer: { command: 'VITE_SUPABASE_URL=https://mock.invalid VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_test npm run dev -- --host 127.0.1.1 --port 4179 --strictPort', url: 'http://127.0.1.1:4179', reuseExistingServer: false },
})
