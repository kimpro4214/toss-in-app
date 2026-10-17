import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './tests/browser', workers: 1,
  use: { baseURL: 'http://127.0.0.1:5178', viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Seoul', launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' }, trace: 'retain-on-failure' },
  webServer: { command: 'npm run dev', url: 'http://127.0.0.1:5178', reuseExistingServer: !process.env.CI },
});
