import {
  workspaceSchemaSql,
  handleWorkspaceRequest,
} from "../server/workspace-service.mjs";
import {
  normalizeEvent,
  sessionKey,
  MAX_BATCH_BYTES,
  MAX_BATCH_EVENTS,
} from "./core.mjs";
import { credentialSchemaSql, issueCredential } from "./credentials.mjs";
export const schemaSql =
  workspaceSchemaSql +
  credentialSchemaSql +
  `CREATE TABLE IF NOT EXISTS agent_events (id TEXT PRIMARY KEY NOT NULL, session_key TEXT NOT NULL, device TEXT NOT NULL, source TEXT NOT NULL, project TEXT NOT NULL, session TEXT NOT NULL, kind TEXT NOT NULL, at TEXT NOT NULL, summary TEXT NOT NULL, evidence TEXT NOT NULL, received_at TEXT NOT NULL);
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
// Keep direct session links and filtered lists on the same summary rules.
const sessionSelect = (
  rangeSql = "",
) => `SELECT e.session_key AS id,e.device,e.source,e.project,e.session,MIN(e.at) AS started,MAX(e.at) AS updated,COUNT(*) AS count,
      (SELECT kind FROM agent_events WHERE session_key=e.session_key AND kind!='tool' ${rangeSql} ORDER BY at DESC,id DESC LIMIT 1) AS state,
      COALESCE((SELECT summary FROM agent_events WHERE session_key=e.session_key AND summary!='' AND kind IN ('stop','prompt','error','interrupt') ${rangeSql} ORDER BY at DESC,id DESC LIMIT 1),'等待工作摘要') AS summary,
      a.title AS title_override,a.summary AS summary_override,a.project AS project_override
      FROM agent_events e LEFT JOIN agent_annotations a ON a.session_key=e.session_key`;
/** @param {Request} request @param {any} db @param {{authorized?:boolean,role?:string,device?:string,tokenHash?:string,setup?:any}} options */
export async function handleAgentRequest(
  request,
  db,
  { authorized = false, role = "owner", device, tokenHash, setup = null } = {},
) {
  if (!authorized) return json({ error: "请登录工作台或检查采集凭据。" }, 401);
  const url = new URL(request.url),
    path = url.pathname;
  if (
    role !== "owner" &&
    !(request.method === "POST" && path === "/api/agent-events")
  )
    return json({ error: "设备凭据仅允许上传记录。" }, 403);
  if (path === "/api/workspace-snapshot")
    return handleWorkspaceRequest(request, db, { authorized, role });
  try {
    if (request.method === "GET" && path === "/api/agent-devices") {
      const devices = await db.all(
        "SELECT device,label,created_at,revoked_at FROM agent_devices ORDER BY created_at DESC",
        [],
      );
      return json({ devices });
    }
    if (request.method === "PATCH" && path === "/api/agent-devices") {
      const text = await request.text();
      if (text.length > 1000) return json({ error: "内容过大" }, 413);
      const body = JSON.parse(text);
      if (
        !body ||
        typeof body.device !== "string" ||
        !body.device.trim() ||
        body.device.length > 200
      )
        return json({ error: "设备编号无效" }, 400);
      const rows = await db.all(
        "SELECT device FROM agent_devices WHERE device=?",
        [body.device],
      );
      if (!rows.length) return json({ error: "设备不存在" }, 404);
      await db.batch([
        {
          sql: "UPDATE agent_devices SET revoked_at=COALESCE(revoked_at,?) WHERE device=?",
          args: [new Date().toISOString(), body.device],
        },
      ]);
      return json({ ok: true });
    }
    if (request.method === "GET" && path === "/api/agent-setup") {
      // A GET never creates credentials. The fallback page requires an explicit POST.
      return new Response(
        `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>连接电脑</title><body><main><h1>连接你的电脑</h1><p>每台电脑使用独立配置。请为电脑命名后下载，勿与其他电脑共用。</p><form method="post"><label>电脑名称 <input name="label" maxlength="80" required></label><button type="submit">生成并下载配置</button></form><p>已有设备请返回工作台的设备列表重新签发，以保留原设备编号和队列。</p><a href="/#agents">返回工作日志</a></main></body></html>`,
        {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
            "Content-Security-Policy":
              "default-src 'none'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
            "X-Content-Type-Options": "nosniff",
          },
        },
      );
    }
    if (request.method === "POST" && path === "/api/agent-setup") {
      if (!setup)
        return json({ error: "仅工作台所有者登录后可下载配置。" }, 403);
      const text = await request.text();
      if (text.length > 2000) return json({ error: "内容过大" }, 413);
      const body = request.headers
        .get("content-type")
        ?.includes("application/x-www-form-urlencoded")
        ? Object.fromEntries(new URLSearchParams(text))
        : JSON.parse(text || "{}");
      if (
        !body ||
        typeof body.label !== "string" ||
        !body.label.trim() ||
        body.label.length > 80
      )
        return json({ error: "请填写 1–80 字的电脑名称。" }, 400);
      let device = body.device;
      if (device !== undefined) {
        if (typeof device !== "string" || !device.trim() || device.length > 200)
          return json({ error: "设备编号无效" }, 400);
        const known = await db.all(
          "SELECT device FROM agent_devices WHERE device=? UNION SELECT device FROM agent_events WHERE device=? LIMIT 1",
          [device, device],
        );
        if (!known.length) return json({ error: "设备不存在" }, 404);
      } else device = crypto.randomUUID();
      const credential = await issueCredential(db, {
        device,
        label: body.label.trim(),
      });
      return new Response(
        JSON.stringify(
          {
            version: 2,
            url: setup.url,
            ...credential,
            ...(setup.serviceToken ? { serviceToken: setup.serviceToken } : {}),
            projects: [],
          },
          null,
          2,
        ),
        {
          headers: {
            "Content-Type": "application/json",
            "Content-Disposition":
              'attachment; filename="workdk-agent.config.json"',
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
          },
        },
      );
    }
    if (request.method === "POST" && path === "/api/agent-events") {
      if (Number(request.headers.get("content-length") || 0) > MAX_BATCH_BYTES)
        return json({ error: "单批内容过大" }, 413);
      const text = await request.text();
      if (new TextEncoder().encode(text).length > MAX_BATCH_BYTES)
        return json({ error: "单批内容过大" }, 413);
      const { events } = JSON.parse(text);
      if (
        !Array.isArray(events) ||
        !events.length ||
        events.length > MAX_BATCH_EVENTS
      )
        return json({ error: "每批需包含 1–20 个事件" }, 400);
      const normalized = events.map(normalizeEvent),
        received = new Date().toISOString();
      if (device && normalized.some((e) => e.device !== device))
        return json({ error: "事件设备与连接配置不一致。" }, 403);
      await db.batch(
        normalized.map((e) => ({
          sql: tokenHash
            ? "INSERT OR IGNORE INTO agent_events SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM agent_devices WHERE device=? AND token_hash=? AND revoked_at IS NULL)"
            : "INSERT OR IGNORE INTO agent_events VALUES (?,?,?,?,?,?,?,?,?,?,?)",
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
            ...(tokenHash ? [device, tokenHash] : []),
          ],
        })),
      );
      // Revocation/rotation may race the asynchronous write. Never ACK skipped writes.
      if (
        tokenHash &&
        !(
          await db.all(
            "SELECT device FROM agent_devices WHERE device=? AND token_hash=? AND revoked_at IS NULL",
            [device, tokenHash],
          )
        ).length
      )
        return json({ error: "设备凭据已停用，请重新连接。" }, 401);
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
      const sql = `${sessionSelect(rangeSql)} ${where.length ? "WHERE " + where.join(" AND ") : ""} GROUP BY e.session_key ORDER BY MAX(e.at) DESC,e.session_key LIMIT 51 OFFSET ?`;
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
      if (!id || id.length > 5000) return json({ error: "会话编号无效" }, 400);
      const sessions = await db.all(
        sessionSelect() + " WHERE e.session_key=? GROUP BY e.session_key",
        [id],
      );
      if (!sessions.length) return json({ error: "会话不存在" }, 404);
      const before = url.searchParams.get("before") || "9999";
      const rows = await db.all(
        "SELECT * FROM agent_events WHERE session_key=? AND (at || id)<? ORDER BY at DESC,id DESC LIMIT 101",
        [id, before],
      );
      return json({
        session: sessions[0],
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
