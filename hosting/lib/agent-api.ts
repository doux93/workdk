import { accessFailure, failureResponse } from "./agent-access-errors.mjs";
import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../app/chatgpt-auth";
import { authorizeAgent } from "../agent/credentials.mjs";
import { handleAgentRequest } from "../agent/service.mjs";
type AgentEnv = {
  DB: D1Database;
  AGENT_INGEST_TOKEN?: string;
  AGENT_SERVICE_ACCESS_TOKEN?: string;
  AGENT_OWNER_EMAIL?: string;
  AGENT_ALLOW_LEGACY_INGEST?: string;
};
export async function agentApi(request: Request) {
  const config = env as unknown as AgentEnv;
  const user = await getChatGPTUser();
  const owner = !!(
    user &&
    config.AGENT_OWNER_EMAIL &&
    user.email.toLowerCase() === config.AGENT_OWNER_EMAIL.toLowerCase()
  );
  const supplied =
    request.headers.get("authorization")?.replace(/^Bearer /, "") || "";
  const adapter = {
    async all(sql: string, args: unknown[]) {
      const result = await config.DB.prepare(sql)
        .bind(...args)
        .all();
      return result.results;
    },
    async batch(statements: { sql: string; args: unknown[] }[]) {
      await config.DB.batch(
        statements.map((s) => config.DB.prepare(s.sql).bind(...s.args)),
      );
    },
  };
  const origin = request.headers.get("origin");
  const sameOrigin = !origin || origin === new URL(request.url).origin;
  let access;
  try {
    access = await authorizeAgent(request, adapter, {
      owner,
      legacyToken:
        config.AGENT_ALLOW_LEGACY_INGEST === "true"
          ? config.AGENT_INGEST_TOKEN || ""
          : "",
    });
  } catch {
    return failureResponse({
      status: 503,
      code: "DEVICE_STORE_UNAVAILABLE",
      error: "设备服务尚未就绪，请检查数据库迁移后重试。",
    });
  }
  const failure = accessFailure({
    userPresent: !!user,
    ownerConfigured: !!config.AGENT_OWNER_EMAIL,
    ownerMatches: owner,
    sameOrigin,
    serviceAuthorized: access.authorized && access.role === "uploader",
    credentialSupplied: !!supplied,
    isSetup: new URL(request.url).pathname === "/api/agent-setup",
    setupReady: !!config.AGENT_SERVICE_ACCESS_TOKEN,
  });
  if (failure) return failureResponse(failure);
  const setup =
    owner && sameOrigin && config.AGENT_SERVICE_ACCESS_TOKEN
      ? {
          url: new URL(request.url).origin,
          serviceToken: config.AGENT_SERVICE_ACCESS_TOKEN,
          projects: [],
        }
      : null;
  return handleAgentRequest(request, adapter, { ...access, setup });
}
