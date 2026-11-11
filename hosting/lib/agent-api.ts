import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../app/chatgpt-auth";
import { handleAgentRequest } from "../agent/service.mjs";
type AgentEnv = {
  DB: D1Database;
  AGENT_INGEST_TOKEN?: string;
  AGENT_SERVICE_ACCESS_TOKEN?: string;
  AGENT_OWNER_EMAIL?: string;
};
async function equalSecret(a: string, b: string) {
  const encode = new TextEncoder();
  const [x, y] = await Promise.all([
    crypto.subtle.digest("SHA-256", encode.encode(a)),
    crypto.subtle.digest("SHA-256", encode.encode(b)),
  ]);
  const left = new Uint8Array(x),
    right = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
  return diff === 0;
}
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
  const service = !!(
    supplied &&
    config.AGENT_INGEST_TOKEN &&
    (await equalSecret(supplied, config.AGENT_INGEST_TOKEN))
  );
  // Browser writes must come from this origin. Machine callers use explicit credentials.
  const origin = request.headers.get("origin");
  const sameOrigin = !origin || origin === new URL(request.url).origin;
  const authorized = service || (owner && sameOrigin);
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
  const setup =
    owner &&
    sameOrigin &&
    config.AGENT_SERVICE_ACCESS_TOKEN &&
    config.AGENT_INGEST_TOKEN
      ? {
          version: 1,
          url: new URL(request.url).origin,
          token: config.AGENT_INGEST_TOKEN,
          serviceToken: config.AGENT_SERVICE_ACCESS_TOKEN,
          projects: [],
        }
      : null;
  return handleAgentRequest(request, adapter, { authorized, setup });
}
