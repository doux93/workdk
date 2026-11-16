import { validateWorkspace } from "../shared/workspace-schema.mjs";
export const MAX_WORKSPACE_BYTES = 1_500_000;
export const workspaceSchemaSql = `CREATE TABLE IF NOT EXISTS workspace_snapshots (
 revision INTEGER PRIMARY KEY NOT NULL, payload TEXT NOT NULL, updated_at TEXT NOT NULL
);`;
const json = (value, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
/** A private, single-owner snapshot store. Conditional INSERT is the write lock. */
export async function handleWorkspaceRequest(request, db, access = {}) {
  if (!access.authorized)
    return json({ error: "请登录工作台后查看云端快照。" }, 401);
  if (access.role !== "owner")
    return json({ error: "设备上传凭据不能访问工作台快照。" }, 403);
  try {
    if (request.method === "GET") {
      const version = new URL(request.url).searchParams.get("revision");
      if (
        version !== null &&
        (!/^[1-9]\d*$/.test(version) || !Number.isSafeInteger(Number(version)))
      )
        return json({ error: "快照版本无效。" }, 400);
      const rows = await db.all(
        version === null
          ? "SELECT * FROM workspace_snapshots ORDER BY revision DESC LIMIT 1"
          : "SELECT * FROM workspace_snapshots WHERE revision=?",
        version === null ? [] : [Number(version)],
      );
      if (version !== null && !rows.length)
        return json({ error: "该历史快照已不存在。" }, 404);
      const history = await db.all(
        "SELECT revision,updated_at AS updatedAt FROM workspace_snapshots ORDER BY revision DESC LIMIT 10",
        [],
      );
      const row = rows[0];
      const workspace = row ? JSON.parse(row.payload) : null;
      if (row && !validateWorkspace(workspace))
        throw new Error("invalid stored snapshot");
      return json({
        revision: row?.revision || 0,
        updatedAt: row?.updated_at || null,
        workspace,
        history,
      });
    }
    if (request.method !== "PUT") return json({ error: "不支持此操作。" }, 405);
    if (!request.headers.get("content-type")?.includes("application/json"))
      return json({ error: "请提交 JSON 快照。" }, 415);
    if (
      Number(request.headers.get("content-length") || 0) >
      MAX_WORKSPACE_BYTES + 1024
    )
      return json(
        { error: "云端快照上限为 1.5 MB，请使用文件备份迁移。" },
        413,
      );
    const text = await request.text();
    if (new TextEncoder().encode(text).length > MAX_WORKSPACE_BYTES + 1024)
      return json(
        { error: "云端快照上限为 1.5 MB，请使用文件备份迁移。" },
        413,
      );
    const body = JSON.parse(text);
    if (
      !body ||
      !Number.isSafeInteger(body.baseRevision) ||
      body.baseRevision < 0
    )
      return json({ error: "请先查看云端版本，再保存快照。" }, 428);
    if (!validateWorkspace(body.workspace))
      return json({ error: "工作台快照格式无效。" }, 400);
    const payload = JSON.stringify(body.workspace);
    if (new TextEncoder().encode(payload).length > MAX_WORKSPACE_BYTES)
      return json(
        { error: "云端快照上限为 1.5 MB，请使用文件备份迁移。" },
        413,
      );
    // The comparison and insert execute in one SQLite/D1 statement, including the empty-store race.
    const saved = await db.all(
      `INSERT INTO workspace_snapshots(revision,payload,updated_at)
   SELECT COALESCE(MAX(revision),0)+1,?,? FROM workspace_snapshots
   HAVING COALESCE(MAX(revision),0)=? RETURNING revision,updated_at AS updatedAt`,
      [payload, new Date().toISOString(), body.baseRevision],
    );
    if (!saved.length)
      return json(
        { error: "云端已有更新，未覆盖任何内容。请重新查看并比较。" },
        409,
      );
    // Retention is housekeeping: a failure here must never report a committed write as failed.
    try {
      await db.batch([
        {
          sql: "DELETE FROM workspace_snapshots WHERE revision < ?",
          args: [saved[0].revision - 9],
        },
      ]);
    } catch {}
    return json(saved[0]);
  } catch (error) {
    return error instanceof SyntaxError
      ? json({ error: "快照不是有效的 JSON。" }, 400)
      : json(
          { error: "云端快照服务未就绪或读取失败，请检查部署与数据库迁移。" },
          503,
        );
  }
}
