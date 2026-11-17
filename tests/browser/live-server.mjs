// Isolated real backend for browser QA: ephemeral DB, no user config or credentials.
import { DatabaseSync } from "node:sqlite";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createAgentServer } from "../../agent/server.mjs";
import { schemaSql } from "../../agent/service.mjs";
const db = new DatabaseSync(":memory:");
db.exec(schemaSql);
const token = randomBytes(32).toString("hex");
const port = process.argv.includes("--port")
  ? process.argv[process.argv.indexOf("--port") + 1]
  : "5173";
if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535)
  throw new Error("Invalid browser QA port");
const server = createAgentServer({
  db,
  token,
  allowedOrigins: [`http://127.0.0.1:${port}`, `http://localhost:${port}`],
});
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(8788, "127.0.0.1", resolve);
});
const vite = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    ...(process.argv.includes("--production") ? ["preview"] : []),
    "--host",
    "127.0.0.1",
    "--port",
    port,
    "--strictPort",
  ],
  {
    stdio: "inherit",
    env: { ...process.env, WORKDK_INGEST_TOKEN: token },
  },
);
let closing = false;
function stop() {
  if (closing) return;
  closing = true;
  vite.kill("SIGTERM");
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
vite.on("exit", (code) => {
  if (!closing) {
    server.close();
    db.close();
    process.exit(code || 1);
  }
});
