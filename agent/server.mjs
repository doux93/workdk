import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { schemaSql, handleAgentRequest } from "./service.mjs";
const db = new DatabaseSync(
  process.env.WORKDK_SERVER_DB || "workdk-agent.sqlite",
);
db.exec(schemaSql);
const adapter = {
  async all(sql, args) {
    return db.prepare(sql).all(...args);
  },
  async batch(statements) {
    db.exec("BEGIN");
    try {
      for (const { sql, args } of statements) db.prepare(sql).run(...args);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  },
};
const token = process.env.WORKDK_INGEST_TOKEN;
if (!token) throw new Error("请设置 WORKDK_INGEST_TOKEN");
createServer(async (req, res) => {
  try {
    let body = "";
    for await (const c of req) {
      body += c;
      if (body.length > 500000) {
        res.writeHead(413).end();
        return;
      }
    }
    const url = "http://127.0.0.1:8788" + req.url;
    const request = new Request(url, {
      method: req.method,
      headers: req.headers,
      ...(!["GET", "HEAD"].includes(req.method) ? { body } : {}),
    });
    const response = await handleAgentRequest(request, adapter, {
      authorized: req.headers.authorization === `Bearer ${token}`,
      setup: { version: 1, url: "http://127.0.0.1:8788", token, projects: [] },
    });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(await response.text());
  } catch {
    res.writeHead(500).end();
  }
}).listen(8788, "127.0.0.1", () =>
  console.log("Agent API: http://127.0.0.1:8788"),
);
