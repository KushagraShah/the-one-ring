import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  use: {
    ...devices['Pixel 7'],
    baseURL: 'http://127.0.0.1:5175',
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : undefined,
  },
  webServer: {
    command: 'VITE_SUPABASE_URL=https://mock.invalid VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_test npm run dev -- --host 127.0.0.1 --port 5175 --strictPort',
    url: 'http://127.0.0.1:5175/',
    reuseExistingServer: false,
    timeout: 30000,
  },
})
