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
    baseURL: "http://127.0.0.1:4173",
    locale: "zh-CN",
    timezoneId: "Asia/Tokyo",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command:
      "npm run build && node tests/browser/live-server.mjs --production --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
  },
});
