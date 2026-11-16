import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  workers: 1,
  timeout: 30000,
  reporter: [["line"], ["html", { open: "never" }]],
  use: {
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
    baseURL: "http://127.0.0.1:5173",
    locale: "zh-CN",
    timezoneId: "Asia/Tokyo",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node tests/browser/live-server.mjs",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: false,
  },
});
