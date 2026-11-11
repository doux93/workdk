import { normalizeEvent, sessionKey } from "./core.mjs";
export const schemaSql = `CREATE TABLE IF NOT EXISTS agent_events (id TEXT PRIMARY KEY NOT NULL, session_key TEXT NOT NULL, device TEXT NOT NULL, source TEXT NOT NULL, project TEXT NOT NULL, session TEXT NOT NULL, kind TEXT NOT NULL, at TEXT NOT NULL, summary TEXT NOT NULL, evidence TEXT NOT NULL, received_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS agent_session_at ON agent_events(session_key, at);
CREATE INDEX IF NOT EXISTS agent_event_at ON agent_events(at);
CREATE TABLE IF NOT EXISTS agent_annotations (session_key TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL DEFAULT '', summary TEXT NOT NULL DEFAULT '', project TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL);`;
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
/** @param {Request} request @param {any} db @param {{authorized?:boolean,setup?:object|null}} options */
export async function handleAgentRequest(
  request,
  db,
  { authorized = false, setup = null } = {},
) {
  if (!authorized) return json({ error: "请登录工作台或检查采集凭据。" }, 401);
  const url = new URL(request.url),
    path = url.pathname;
  try {
    if (request.method === "GET" && path === "/api/agent-setup") {
      if (!setup)
        return json({ error: "仅工作台所有者登录后可下载配置。" }, 403);
      return new Response(JSON.stringify(setup, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition":
            'attachment; filename="workdk-agent.config.json"',
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    if (request.method === "POST" && path === "/api/agent-events") {
      if (Number(request.headers.get("content-length") || 0) > 500000)
        return json({ error: "单批内容过大" }, 413);
      const text = await request.text();
      if (new TextEncoder().encode(text).length > 500000)
        return json({ error: "单批内容过大" }, 413);
      const { events } = JSON.parse(text);
      if (!Array.isArray(events) || !events.length || events.length > 20)
        return json({ error: "每批需包含 1–20 个事件" }, 400);
      const normalized = events.map(normalizeEvent),
        received = new Date().toISOString();
      await db.batch(
        normalized.map((e) => ({
          sql: "INSERT OR IGNORE INTO agent_events VALUES (?,?,?,?,?,?,?,?,?,?,?)",
          args: [
            e.id,
            sessionKey(e),
            e.device,
            e.source,
            e.project,
            e.session,
            e.kind,
            e.at,
            e.summary,
            e.evidence,
            received,
          ],
        })),
      );
      return json({ acknowledged: normalized.map((e) => e.id) });
    }
    if (request.method === "GET" && path === "/api/agent-sessions") {
      const offset = Math.max(
        0,
        Math.min(100000, Number(url.searchParams.get("offset")) || 0),
      );
      let rangeSql = "";
      const where = [],
        args = [];
      for (const [field, param] of [
        ["source", "source"],
        ["project", "project"],
      ])
        if (url.searchParams.get(param)) {
          where.push(
            field === "project"
              ? "COALESCE(NULLIF(a.project,''),e.project)=?"
              : `e.${field}=?`,
          );
          args.push(url.searchParams.get(param));
        }
      const day = url.searchParams.get("day");
      if (day) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(day))
          return json({ error: "日期格式无效" }, 400);
        const zone = Math.max(
          -840,
          Math.min(840, Number(url.searchParams.get("offsetMinutes")) || 0),
        );
        const from = new Date(`${day}T00:00:00.000Z`).getTime() - zone * 60000;
        if (!Number.isFinite(from)) return json({ error: "无效日期" }, 400);
        rangeSql = ` AND at>='${new Date(from).toISOString()}' AND at<'${new Date(from + 86400000).toISOString()}'`;
        where.push("e.at>=? AND e.at<?");
        args.push(
          new Date(from).toISOString(),
          new Date(from + 86400000).toISOString(),
        );
      }
      const sql = `SELECT e.session_key AS id,e.device,e.source,e.project,e.session,MIN(e.at) AS started,MAX(e.at) AS updated,COUNT(*) AS count,
      (SELECT kind FROM agent_events WHERE session_key=e.session_key AND kind!='tool' ${rangeSql} ORDER BY at DESC,id DESC LIMIT 1) AS state,
      COALESCE((SELECT summary FROM agent_events WHERE session_key=e.session_key AND summary!='' AND kind IN ('stop','prompt','error','interrupt') ${rangeSql} ORDER BY at DESC,id DESC LIMIT 1),'等待工作摘要') AS summary,
      a.title AS title_override,a.summary AS summary_override,a.project AS project_override
      FROM agent_events e LEFT JOIN agent_annotations a ON a.session_key=e.session_key ${where.length ? "WHERE " + where.join(" AND ") : ""} GROUP BY e.session_key ORDER BY MAX(e.at) DESC,e.session_key LIMIT 51 OFFSET ?`;
      const rows = await db.all(sql, [...args, offset]);
      const devices = await db.all(
        "SELECT device,MAX(received_at) AS lastSync,COUNT(*) AS count FROM agent_events GROUP BY device ORDER BY MAX(received_at) DESC LIMIT 30",
        [],
      );
      return json({
        sessions: rows.slice(0, 50),
        hasMore: rows.length > 50,
        devices,
      });
    }
    if (request.method === "GET" && path === "/api/agent-session") {
      const id = url.searchParams.get("id");
      if (!id) return json({ error: "缺少会话编号" }, 400);
      const before = url.searchParams.get("before") || "9999";
      const rows = await db.all(
        "SELECT * FROM agent_events WHERE session_key=? AND (at || id)<? ORDER BY at DESC,id DESC LIMIT 101",
        [id, before],
      );
      return json({
        events: rows.slice(0, 100),
        hasMore: rows.length > 100,
        next: rows.length > 100 ? rows[99].at + rows[99].id : null,
      });
    }
    if (request.method === "PATCH" && path === "/api/agent-session") {
      const text = await request.text();
      if (text.length > 16000) return json({ error: "内容过大" }, 413);
      const body = JSON.parse(text);
      if (typeof body.id !== "string")
        return json({ error: "缺少会话编号" }, 400);
      for (const k of ["title", "summary", "project"])
        if (
          typeof body[k] !== "string" ||
          body[k].length > (k === "summary" ? 12000 : 200)
        )
          return json({ error: "字段内容无效" }, 400);
      const exists = await db.all(
        "SELECT id FROM agent_events WHERE session_key=? LIMIT 1",
        [body.id],
      );
      if (!exists.length) return json({ error: "会话不存在" }, 404);
      await db.batch([
        {
          sql: "INSERT INTO agent_annotations VALUES (?,?,?,?,?) ON CONFLICT(session_key) DO UPDATE SET title=excluded.title,summary=excluded.summary,project=excluded.project,updated_at=excluded.updated_at",
          args: [
            body.id,
            body.title.trim(),
            body.summary.trim(),
            body.project.trim(),
            new Date().toISOString(),
          ],
        },
      ]);
      return json({ ok: true });
    }
    return json({ error: "接口不存在" }, 404);
  } catch (error) {
    if (
      error instanceof SyntaxError ||
      /无效|事件|字段|不支持/.test(error.message)
    )
      return json({ error: error.message }, 400);
    return json({ error: "保存或读取失败，请稍后重试。" }, 503);
  }
}
