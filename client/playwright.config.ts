import { defineConfig, devices } from '@playwright/test';

// Browser tests run against their own API (port 3100) and database (rehabquest_e2e),
// started fresh with demo seed data. Development data is never touched.
// Prerequisite: the test database container is running (npm --prefix ../server run test:db:up).
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 860 } }, grepInvert: /@mobile/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, grep: /@mobile/ },
  ],
  webServer: [
    {
      command: 'npx tsx scripts/e2e-server.ts',
      cwd: '../server',
      url: 'http://localhost:3100/health',
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: 'pipe',
    },
    {
      command: 'npx vite --port 5174 --strictPort',
      url: 'http://localhost:5174',
      reuseExistingServer: false,
      timeout: 120_000,
      env: { VITE_API_URL: 'http://localhost:3100' },
    },
  ],
});
