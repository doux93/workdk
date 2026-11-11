import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return {
    plugins: [react()],
    base: "./",
    server: {
      proxy: {
        "/api/agent": {
          target: "http://127.0.0.1:8788",
          changeOrigin: true,
          headers: env.WORKDK_INGEST_TOKEN
            ? { Authorization: `Bearer ${env.WORKDK_INGEST_TOKEN}` }
            : {},
        },
      },
    },
    build: { outDir: "dist" },
  };
});
