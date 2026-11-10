import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    environmentOptions: { jsdom: { url: "http://localhost/" } },
    setupFiles: ["./tests/ui/setup.ts"],
    include: ["tests/ui/**/*.test.tsx"],
    fileParallelism: false,
    testTimeout: 15000,
  },
});
