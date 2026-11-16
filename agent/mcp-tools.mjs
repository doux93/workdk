import { readFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { normalizeEvent, safeConfig } from "./core.mjs";
import { writeHookEvent } from "./hook-spool.mjs";

export const recordWorkTool = {
  name: "record_work",
  description:
    "将本轮事实摘要和可核实产物加入个人工作台的本地上传队列，不将任务自动标记为完成。不传完整对话、文件正文或凭据。",
  inputSchema: {
    type: "object",
    properties: {
      project: {
        type: "string",
        minLength: 1,
        maxLength: 200,
        description: "已配置的项目名称，不是本地路径",
      },
      session: {
        type: "string",
        minLength: 1,
        maxLength: 200,
        description: "同一任务使用稳定的会话编号",
      },
      summary: { type: "string", minLength: 1, maxLength: 12000 },
      evidence: { type: "string", maxLength: 8000 },
      kind: { type: "string", enum: ["stop", "error", "tool"] },
    },
    required: ["project", "session", "summary"],
    additionalProperties: false,
  },
};
const result = (text, isError = false) => ({
  isError,
  content: [{ type: "text", text }],
});

export function recordWork(home, args) {
  if (!args || typeof args !== "object" || Array.isArray(args))
    return result("请提供 project、session 和 summary。", true);
  const schema = recordWorkTool.inputSchema;
  if (Object.keys(args).some((key) => !Object.hasOwn(schema.properties, key)))
    return result("仅接受 project、session、summary、evidence 和 kind。", true);
  for (const key of ["project", "session", "summary", "evidence"]) {
    const value = args[key];
    if (key === "evidence" && value === undefined) continue;
    if (
      typeof value !== "string" ||
      value.length > schema.properties[key].maxLength ||
      (key !== "evidence" && !value.trim())
    )
      return result(
        `请检查 ${key}：必须为${key === "evidence" ? "" : "非空"}文本，最多 ${schema.properties[key].maxLength} 个字符。`,
        true,
      );
  }
  if (
    args.kind !== undefined &&
    !schema.properties.kind.enum.includes(args.kind)
  )
    return result("kind 仅支持 stop、error 或 tool。", true);
  let config;
  try {
    config = safeConfig(
      JSON.parse(readFileSync(path.join(home, "config.json"), "utf8")),
    );
    if (!config.device) throw new Error("Missing device");
  } catch {
    return result(
      "采集配置不可用，请先运行 setup-agent.cmd 或 collector.mjs init 初始化，再重新连接 MCP。",
      true,
    );
  }
  if (!config.projects.some((p) => p.name === args.project.trim()))
    return result(
      "项目不在允许列表中。请使用已配置的项目名称，或先运行 collector.mjs add-project 添加该项目。",
      true,
    );
  try {
    const event = normalizeEvent({
      ...args,
      id: randomUUID(),
      device: config.device,
      source: "workbuddy",
      at: new Date().toISOString(),
      kind: args.kind ?? "stop",
    });
    // Reuse the durable hook outbox: the MCP process never imports SQLite.
    writeHookEvent(home, event);
    return result(
      "工作记录已保存到本地上传队列；请保持 start-agent.cmd 或 collector.mjs run 运行。入队不代表服务器已收到，也不代表任务已完成。",
    );
  } catch {
    return result(
      "无法保存本地工作记录，请检查采集器目录的写入权限和可用磁盘空间后重试。",
      true,
    );
  }
}
