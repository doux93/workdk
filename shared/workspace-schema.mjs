// One schema for browser imports and server snapshots; no framework/runtime dependencies.
export function validateWorkspace(x) {
  if (!x || typeof x !== "object") return false;
  const a = x;
  try {
    return (
      a.version === 1 &&
      typeof a.name === "string" &&
      a.name.length < 100 &&
      ["light", "sand", "dark"].includes(a.theme) &&
      ["balanced", "focus", "compact"].includes(a.layout) &&
      typeof a.example === "boolean" &&
      (a.homeMode === undefined ||
        ["focused", "expanded"].includes(a.homeMode)) &&
      Array.isArray(a.modules) &&
      new Set(a.modules.map((m) => m.id)).size === a.modules.length &&
      a.modules.every(
        (m) =>
          m &&
          typeof m.id === "string" &&
          /^[\w-]+$/.test(m.id) &&
          typeof m.name === "string" &&
          m.name.trim().length > 0 &&
          typeof m.description === "string" &&
          typeof m.icon === "string" &&
          ["green", "blue", "orange", "purple", "pink"].includes(m.color) &&
          ["list", "board", "calendar", "notes", "links"].includes(m.view) &&
          (m.purpose === undefined ||
            (typeof m.purpose === "string" &&
              ["tasks", "notes", "schedule", "links", "collection"].includes(
                m.purpose,
              ))) &&
          typeof m.hidden === "boolean" &&
          Array.isArray(m.fields) &&
          m.fields.every((f) => typeof f === "string" && f.trim().length > 0) &&
          new Set(m.fields).size === m.fields.length &&
          (m.fieldConfig === undefined || validateFieldConfig(m.fieldConfig)) &&
          Array.isArray(m.entries) &&
          new Set(m.entries.map((e) => e.id)).size === m.entries.length &&
          m.entries.every(
            (e) =>
              e &&
              typeof e.id === "string" &&
              /^[\w-]+$/.test(e.id) &&
              typeof e.title === "string" &&
              e.title.trim().length > 0 &&
              typeof e.description === "string" &&
              ["todo", "doing", "done"].includes(e.status) &&
              ["普通", "重要", "紧急"].includes(e.priority) &&
              typeof e.date === "string" &&
              isValidDateValue(e.date) &&
              typeof e.time === "string" &&
              isValidTimeValue(e.time) &&
              typeof e.url === "string" &&
              typeof e.created === "string" &&
              (e.sample === undefined || typeof e.sample === "boolean") &&
              (e.agentSessionId === undefined ||
                (typeof e.agentSessionId === "string" &&
                  e.agentSessionId.trim().length > 0 &&
                  e.agentSessionId.length <= 5000)) &&
              e.values &&
              typeof e.values === "object" &&
              !Array.isArray(e.values) &&
              Object.values(e.values).every((v) => typeof v === "string"),
          ),
      )
    );
  } catch {
    return false;
  }
}
export function isValidDateValue(value) {
  if (!value) return true;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText),
    month = Number(monthText),
    day = Number(dayText);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return (
    day <=
    [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]
  );
}
export function isValidTimeValue(value) {
  return !value || /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}
export function validateFieldConfig(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.entries(value).every(([name, raw]) => {
    if (!name.trim() || !raw || typeof raw !== "object" || Array.isArray(raw))
      return false;
    const def = raw;
    if (!["text", "number", "select", "url"].includes(def.type)) return false;
    if (def.type === "select")
      return (
        Array.isArray(def.options) &&
        def.options.length > 0 &&
        def.options.length <= 50 &&
        def.options.every(
          (option) => typeof option === "string" && !!option.trim(),
        ) &&
        new Set(def.options).size === def.options.length
      );
    if (def.type === "number")
      return (
        [def.min, def.max, def.step].every(
          (n) =>
            n === undefined || (typeof n === "number" && Number.isFinite(n)),
        ) &&
        (def.min === undefined ||
          def.max === undefined ||
          def.min <= def.max) &&
        (def.step === undefined || def.step > 0) &&
        (def.unit === undefined || typeof def.unit === "string")
      );
    return true;
  });
}
