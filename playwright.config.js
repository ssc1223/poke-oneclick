import { defineConfig, devices } from '@playwright/test';

/** 用 Chromium 模擬 Pixel 7 / iPhone 13 尺寸與觸控（驗證 Android Brave 同類問題） */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  projects: [
    {
      name: 'Pixel 7',
      use: {
        ...devices['Pixel 7'],
        browserName: 'chromium',
        hasTouch: true,
      },
    },
    {
      name: 'iPhone 13',
      use: {
        ...devices['iPhone 13'],
        browserName: 'chromium',
        hasTouch: true,
      },
    },
  ],
});
