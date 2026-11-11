import readline from "node:readline";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { normalizeEvent, safeConfig } from "./core.mjs";
import { openQueue } from "./queue.mjs";
const home =
  process.env.WORKDK_AGENT_HOME || path.join(os.homedir(), ".workdk-agent");
const line = readline.createInterface({ input: process.stdin });
for await (const text of line) {
  let request;
  try {
    request = JSON.parse(text);
    if (request.id === undefined) continue;
    let result;
    if (request.method === "initialize")
      result = {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "workdk-journal", version: "1.4.0" },
      };
    else if (request.method === "ping") result = {};
    else if (request.method === "tools/list")
      result = {
        tools: [
          {
            name: "record_work",
            description:
              "将本轮工作摘要加入个人工作台的本地上传队列。仅记录事实和可核实产物，不将任务自动标记为完成。",
            inputSchema: {
              type: "object",
              properties: {
                project: { type: "string" },
                session: { type: "string" },
                summary: { type: "string" },
                evidence: { type: "string" },
                kind: { type: "string", enum: ["stop", "error", "tool"] },
              },
              required: ["project", "session", "summary"],
            },
          },
        ],
      };
    else if (request.method === "tools/call") {
      if (request.params?.name !== "record_work") throw new Error("未知工具");
      const config = safeConfig(
          JSON.parse(readFileSync(path.join(home, "config.json"), "utf8")),
        ),
        args = request.params.arguments || {};
      if (!config.projects.some((p) => p.name === args.project))
        throw new Error("项目不在允许列表中");
      const event = normalizeEvent({
        ...args,
        id: randomUUID(),
        device: config.device,
        source: "workbuddy",
        at: new Date().toISOString(),
        kind: args.kind || "stop",
      });
      const q = openQueue(path.join(home, "events.sqlite"));
      try {
        q.add(event);
      } finally {
        q.close();
      }
      result = {
        content: [
          {
            type: "text",
            text: "工作记录已进入本地上传队列；后台采集器运行后将同步。",
          },
        ],
      };
    } else {
      process.stdout.write(
        JSON.stringify({
          jsonrpc: "2.0",
          id: request.id,
          error: { code: -32601, message: "Method not found" },
        }) + "\n",
      );
      continue;
    }
    process.stdout.write(
      JSON.stringify({ jsonrpc: "2.0", id: request.id, result }) + "\n",
    );
  } catch {
    if (request?.id !== undefined)
      process.stdout.write(
        JSON.stringify({
          jsonrpc: "2.0",
          id: request.id,
          result: {
            isError: true,
            content: [
              {
                type: "text",
                text: "记录失败，请检查项目名称和本地采集配置。",
              },
            ],
          },
        }) + "\n",
      );
  }
}
