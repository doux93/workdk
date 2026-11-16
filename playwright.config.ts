import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  workers: 1,
  timeout: 30000,
  reporter: [["line"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:5173",
    locale: "zh-CN",
    timezoneId: "Asia/Tokyo",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
  },
});
