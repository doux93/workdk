import type { Entry, Module } from "./workspace";

export function entryMatches(entry: Entry, query: string): boolean {
  return (
    entry.title.toLowerCase().includes(query) ||
    entry.description.toLowerCase().includes(query) ||
    Object.values(entry.values).some((value) =>
      value.toLowerCase().includes(query),
    )
  );
}
export function filterEntries(
  entries: Entry[],
  query: string,
  status = "all",
): Entry[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized && status === "all") return entries;
  return entries.filter(
    (entry) =>
      (status === "all" || entry.status === status) &&
      (!normalized || entryMatches(entry, normalized)),
  );
}
export function searchWorkspace(modules: Module[], query: string, limit = 30) {
  const normalized = query.trim().toLowerCase();
  const matchedModules = modules.filter(
    (module) => !normalized || module.name.toLowerCase().includes(normalized),
  );
  const entries: { module: Module; entry: Entry }[] = [];
  if (normalized) {
    for (const module of modules) {
      for (const entry of module.entries) {
        if (entryMatches(entry, normalized)) {
          if (entries.length === limit)
            return { modules: matchedModules, entries, hasMore: true };
          entries.push({ module, entry });
        }
      }
    }
  }
  return { modules: matchedModules, entries, hasMore: false };
}
