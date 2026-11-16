// Isolated real backend for browser QA: ephemeral DB, no user config or credentials.
import { DatabaseSync } from "node:sqlite";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createAgentServer } from "../../agent/server.mjs";
import { schemaSql } from "../../agent/service.mjs";
const db = new DatabaseSync(":memory:");
db.exec(schemaSql);
const token = randomBytes(32).toString("hex");
const server = createAgentServer({ db, token });
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(8788, "127.0.0.1", resolve);
});
const vite = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "--host",
    "127.0.0.1",
    "--port",
    "5173",
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
