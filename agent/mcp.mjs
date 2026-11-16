import os from "node:os";
import path from "node:path";
import { runMcp } from "./mcp-protocol.mjs";
import { recordWork } from "./mcp-tools.mjs";

const home = path.resolve(
  process.env.WORKDK_AGENT_HOME || path.join(os.homedir(), ".workdk-agent"),
);
// A client closing its pipe is a normal transport shutdown.
process.stdout.on("error", () => {});
try {
  await runMcp(process.stdin, process.stdout, (args) => recordWork(home, args));
} catch (error) {
  if (error.code !== "EPIPE") {
    console.error("Workdk MCP 连接已关闭，请重新连接后重试。");
    process.exitCode = 1;
  }
}
