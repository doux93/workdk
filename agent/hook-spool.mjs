import {
  mkdirSync,
  openSync,
  writeFileSync,
  fsyncSync,
  closeSync,
  renameSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  existsSync,
} from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { normalizeEvent } from "./core.mjs";
export function writeHookEvent(home, event) {
  const folder = path.join(home, "outbox");
  mkdirSync(folder, { recursive: true, mode: 0o700 });
  const name = randomUUID(),
    temporary = path.join(folder, name + ".tmp"),
    target = path.join(folder, name + ".json");
  const fd = openSync(temporary, "wx", 0o600);
  try {
    writeFileSync(fd, JSON.stringify(event));
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(temporary, target);
  try {
    const dir = openSync(folder, "r");
    try {
      fsyncSync(dir);
    } finally {
      closeSync(dir);
    }
  } catch {
    /* Directory fsync is not supported on every Windows filesystem. */
  }
}
export function outboxCount(home) {
  const dir = path.join(home, "outbox");
  return existsSync(dir)
    ? readdirSync(dir).filter((f) => f.endsWith(".json")).length
    : 0;
}
export function drainHookEvents(queue, home, onInvalid = () => {}) {
  const folder = path.join(home, "outbox");
  if (!existsSync(folder)) return 0;
  let count = 0;
  for (const name of readdirSync(folder)
    .filter((f) => f.endsWith(".json"))
    .slice(0, 1000)) {
    const file = path.join(folder, name);
    let event;
    try {
      event = normalizeEvent(JSON.parse(readFileSync(file, "utf8")));
    } catch (error) {
      if (error.code === "ENOENT") continue;
      renameSync(file, file + ".invalid");
      onInvalid(error);
      continue;
    }
    // SQLite commit precedes removal; a crash in between is safe because queue.add is idempotent.
    queue.add(event);
    try {
      unlinkSync(file);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    count++;
  }
  return count;
}
