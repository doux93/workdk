// Web Crypto + parameterized SQL only: shared by SQLite and Cloudflare D1.
export const credentialSchemaSql = `CREATE TABLE IF NOT EXISTS agent_devices (
  device TEXT PRIMARY KEY NOT NULL, label TEXT NOT NULL, token_hash TEXT NOT NULL,
  created_at TEXT NOT NULL, revoked_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS agent_device_token ON agent_devices(token_hash);`;

export async function hashToken(token) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return [...new Uint8Array(digest)]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}

export async function equalSecret(a, b) {
  const [x, y] = await Promise.all([hashToken(a), hashToken(b)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

/** Owner identity must be established by the trusted hosting/local adapter. */
export async function authorizeAgent(
  request,
  db,
  {
    owner = false,
    adminToken = "",
    legacyToken = "",
    allowedOrigins = [],
  } = {},
) {
  const origin = request.headers.get("origin");
  if (
    origin &&
    origin !== new URL(request.url).origin &&
    !allowedOrigins.includes(origin)
  )
    return { authorized: false };
  if (owner) return { authorized: true, role: "owner" };
  const token =
    request.headers.get("authorization")?.match(/^Bearer (\S+)$/)?.[1] || "";
  if (!token || token.length > 512) return { authorized: false };
  if (adminToken && (await equalSecret(token, adminToken)))
    return { authorized: true, role: "owner" };
  if (legacyToken && (await equalSecret(token, legacyToken)))
    return { authorized: true, role: "uploader" };
  if (!/^wkdev_[a-f0-9]{64}$/.test(token)) return { authorized: false };
  const tokenHash = await hashToken(token);
  const rows = await db.all(
    "SELECT device FROM agent_devices WHERE token_hash=? AND revoked_at IS NULL",
    [tokenHash],
  );
  return rows.length
    ? { authorized: true, role: "uploader", device: rows[0].device, tokenHash }
    : { authorized: false };
}

export async function issueCredential(db, { device, label }) {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token =
    "wkdev_" + [...bytes].map((n) => n.toString(16).padStart(2, "0")).join("");
  const now = new Date().toISOString();
  await db.batch([
    {
      sql: "INSERT INTO agent_devices(device,label,token_hash,created_at,revoked_at) VALUES (?,?,?,?,NULL) ON CONFLICT(device) DO UPDATE SET label=excluded.label,token_hash=excluded.token_hash,created_at=excluded.created_at,revoked_at=NULL",
      args: [device, label, await hashToken(token), now],
    },
  ]);
  return { device, token };
}
