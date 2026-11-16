import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { MAX_BATCH_BYTES } from "./core.mjs";
import { schemaSql, handleAgentRequest } from "./service.mjs";

// The caller owns the database and server lifecycle (including in integration tests).
export function createAgentServer({ db, token }) {
  if (!token) throw new Error("请设置 WORKDK_INGEST_TOKEN");
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
  const server = createServer(async (req, res) => {
    try {
      const chunks = [];
      let bytes = 0;
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > MAX_BATCH_BYTES) {
          res.writeHead(413).end();
          return;
        }
        chunks.push(chunk);
      }
      // Decode once: a multi-byte character may span any two HTTP chunks.
      const body = Buffer.concat(chunks).toString("utf8");
      const origin = `http://127.0.0.1:${server.address().port}`;
      const request = new Request(origin + req.url, {
        method: req.method,
        headers: req.headers,
        ...(!["GET", "HEAD"].includes(req.method) ? { body } : {}),
      });
      const response = await handleAgentRequest(request, adapter, {
        authorized: req.headers.authorization === `Bearer ${token}`,
        setup: { version: 1, url: origin, token, projects: [] },
      });
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(await response.text());
    } catch {
      res.writeHead(500).end();
    }
  });
  return server;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const token = process.env.WORKDK_INGEST_TOKEN;
  if (!token) throw new Error("请设置 WORKDK_INGEST_TOKEN");
  const db = new DatabaseSync(
    process.env.WORKDK_SERVER_DB || "workdk-agent.sqlite",
  );
  db.exec(schemaSql);
  createAgentServer({ db, token }).listen(8788, "127.0.0.1", () =>
    console.log("Agent API: http://127.0.0.1:8788"),
  );
}
