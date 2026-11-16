import { recordWorkTool } from "./mcp-tools.mjs";
import { AGENT_VERSION } from "./version.mjs";

export const MAX_MESSAGE_BYTES = 128000;
// Deliberately negotiate the established session-based revisions.
export const PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2024-11-05"];
const object = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const validId = (id) => typeof id === "string" || Number.isSafeInteger(id);
const failure = (id, code, message) => ({
  jsonrpc: "2.0",
  id,
  error: { code, message },
});

// Bound a line before decoding it. Oversized input is discarded through the
// next newline, so a bad message cannot corrupt the next valid request.
export async function* readMessages(input) {
  let parts = [],
    size = 0,
    dropping = false;
  function parse() {
    const bytes = Buffer.concat(parts, size);
    parts = [];
    size = 0;
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      return text.trim() ? { value: JSON.parse(text) } : null;
    } catch {
      return { error: failure(null, -32700, "Parse error") };
    }
  }
  for await (const raw of input) {
    const chunk = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
    let start = 0;
    while (start < chunk.length) {
      const newline = chunk.indexOf(10, start);
      const end = newline === -1 ? chunk.length : newline;
      if (!dropping) {
        size += end - start;
        if (size > MAX_MESSAGE_BYTES) {
          parts = [];
          size = 0;
          dropping = true;
          yield {
            error: failure(null, -32600, "Message exceeds 128000 bytes"),
          };
        } else parts.push(chunk.subarray(start, end));
      }
      if (newline === -1) break;
      if (!dropping) {
        const message = parse();
        if (message) yield message;
      }
      parts = [];
      size = 0;
      dropping = false;
      start = end + 1;
    }
  }
  if (size && !dropping) {
    const message = parse();
    if (message) yield message;
  }
}

export function createMcpHandler(record) {
  let state = "new";
  return async (request) => {
    if (!object(request) || request.jsonrpc !== "2.0")
      return failure(null, -32600, "Invalid Request");
    // We never issue client requests; ignore unsolicited responses to avoid loops.
    if (
      !Object.hasOwn(request, "method") &&
      validId(request.id) &&
      (Object.hasOwn(request, "result") || Object.hasOwn(request, "error"))
    )
      return null;
    if (
      typeof request.method !== "string" ||
      !request.method ||
      (Object.hasOwn(request, "id") && !validId(request.id))
    )
      return failure(null, -32600, "Invalid Request");
    const { id, method, params } = request;
    if (!Object.hasOwn(request, "id")) {
      if (
        method === "notifications/initialized" &&
        state === "initializing" &&
        (params === undefined || object(params))
      )
        state = "ready";
      return null; // Notifications never execute tools or produce responses.
    }
    if (params !== undefined && !object(params))
      return failure(id, -32602, "Params must be an object");
    let result;
    if (method === "ping") result = {};
    else if (method === "initialize") {
      if (state !== "new") return failure(id, -32600, "Already initialized");
      if (
        !params ||
        typeof params.protocolVersion !== "string" ||
        !params.protocolVersion ||
        !object(params.capabilities) ||
        !object(params.clientInfo) ||
        typeof params.clientInfo.name !== "string" ||
        typeof params.clientInfo.version !== "string"
      )
        return failure(
          id,
          -32602,
          "initialize requires protocolVersion, capabilities and clientInfo",
        );
      state = "initializing";
      result = {
        protocolVersion: PROTOCOL_VERSIONS.includes(params.protocolVersion)
          ? params.protocolVersion
          : PROTOCOL_VERSIONS[0],
        capabilities: { tools: {} },
        serverInfo: { name: "workdk-journal", version: AGENT_VERSION },
      };
    } else if (method === "tools/list" || method === "tools/call") {
      if (state !== "ready")
        return failure(
          id,
          -32000,
          "Initialize and send notifications/initialized first",
        );
      if (method === "tools/list") {
        if (params?.cursor !== undefined && params.cursor !== "")
          return failure(id, -32602, "Invalid cursor");
        result = { tools: [recordWorkTool] };
      } else {
        if (!params || params.name !== "record_work")
          return failure(id, -32602, "Unknown tool; use record_work");
        if (params.arguments !== undefined && !object(params.arguments))
          return failure(id, -32602, "Tool arguments must be an object");
        try {
          result = await record(params.arguments);
        } catch {
          return failure(id, -32603, "Internal error");
        }
      }
    } else return failure(id, -32601, "Method not found");
    return { jsonrpc: "2.0", id, result };
  };
}

export async function runMcp(input, output, record) {
  const handle = createMcpHandler(record);
  for await (const message of readMessages(input)) {
    const reply = message.error || (await handle(message.value));
    if (reply)
      await new Promise((resolve, reject) => {
        output.write(JSON.stringify(reply) + "\n", (error) =>
          error ? reject(error) : resolve(),
        );
      });
  }
}
