import {
  blankEntry,
  dateKey,
  isValidDateValue,
  modulePurpose,
  uid,
  type Entry,
  type Module,
  type Workspace,
} from "./workspace.ts";

export type WorkItem = { module: Module; entry: Entry };
export function focusItems(modules: Module[], today = dateKey()) {
  const items = modules
    .filter((m) => !m.hidden && modulePurpose(m) === "tasks")
    .flatMap((module) =>
      module.entries
        .filter((e) => !e.sample)
        .map((entry) => ({ module, entry })),
    );
  const rank = { 紧急: 0, 重要: 1, 普通: 2 };
  items.sort(
    (a, b) =>
      rank[a.entry.priority] - rank[b.entry.priority] ||
      a.entry.date.localeCompare(b.entry.date) ||
      b.entry.created.localeCompare(a.entry.created) ||
      a.entry.id.localeCompare(b.entry.id),
  );
  return {
    today: items.filter(
      ({ entry: e }) => e.status !== "done" && e.date === today,
    ),
    overdue: items.filter(
      ({ entry: e }) => e.status !== "done" && !!e.date && e.date < today,
    ),
    unscheduled: items.filter(({ entry: e }) => e.status !== "done" && !e.date),
    done: items.filter(
      ({ entry: e }) => e.status === "done" && e.date === today,
    ),
  };
}
export type CaptureInput = {
  purpose: "tasks" | "notes";
  moduleId: string;
  title: string;
  description: string;
  date: string;
  priority: Entry["priority"];
};
export function captureRecord(workspace: Workspace, input: CaptureInput) {
  if (!input.title.trim() || input.title.trim().length > 140)
    throw new Error("请填写 1–140 字的内容。");
  if (
    !isValidDateValue(input.date) ||
    !["普通", "重要", "紧急"].includes(input.priority) ||
    input.description.length > 20000 ||
    !["tasks", "notes"].includes(input.purpose)
  )
    throw new Error("请检查日期、优先级和正文。");
  let module = workspace.modules.find((m) => m.id === input.moduleId);
  if (
    input.moduleId &&
    (!module || module.hidden || modulePurpose(module) !== input.purpose)
  )
    throw new Error("目标模块已变化，请重新选择保存位置。");
  if (!module)
    module = {
      id: uid(),
      name: input.purpose === "tasks" ? "我的待办" : "随手记",
      description: "从快速记录开始",
      purpose: input.purpose,
      view: input.purpose === "tasks" ? "list" : "notes",
      color: "green",
      icon: input.purpose === "tasks" ? "check" : "note",
      fields: [],
      hidden: false,
      entries: [],
    };
  const entry: Entry = {
    ...blankEntry(),
    title: input.title.trim(),
    description: input.description,
    date: input.date,
    priority: input.priority,
    sample: false,
  };
  const updated = { ...module, entries: [entry, ...module.entries] };
  return {
    moduleId: module.id,
    entryId: entry.id,
    workspace: {
      ...workspace,
      modules: workspace.modules.some((m) => m.id === module.id)
        ? workspace.modules.map((m) => (m.id === module.id ? updated : m))
        : [...workspace.modules, updated],
    },
  };
}
