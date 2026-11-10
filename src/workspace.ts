export type View = "list" | "board" | "calendar" | "notes" | "links";
export type Entry = {
  id: string;
  title: string;
  description: string;
  status: "todo" | "doing" | "done";
  priority: "普通" | "重要" | "紧急";
  date: string;
  time: string;
  url: string;
  values: Record<string, string>;
  created: string;
  sample?: boolean;
};
export type Module = {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  view: View;
  fields: string[];
  hidden: boolean;
  entries: Entry[];
};
export type Workspace = {
  version: 1;
  name: string;
  theme: "light" | "sand" | "dark";
  layout: "balanced" | "focus" | "compact";
  modules: Module[];
  example: boolean;
};
export const views: {
  id: View;
  name: string;
  description: string;
  icon: string;
}[] = [
  {
    id: "list",
    name: "清晰列表",
    description: "让每条事项井然有序",
    icon: "list",
  },
  {
    id: "board",
    name: "进度看板",
    description: "一眼掌握工作的流转",
    icon: "board",
  },
  {
    id: "calendar",
    name: "时间日历",
    description: "为每件重要的事留出时间",
    icon: "calendar",
  },
  {
    id: "notes",
    name: "灵感笔记",
    description: "给想法一个自由的空间",
    icon: "note",
  },
  {
    id: "links",
    name: "快捷入口",
    description: "常用工具，一步直达",
    icon: "link",
  },
];
export const statusName = { todo: "待开始", doing: "进行中", done: "已完成" };
export const colors = ["green", "blue", "orange", "purple", "pink"];
export const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now();
export const dateKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export function blankEntry(): Entry {
  return {
    id: uid(),
    title: "",
    description: "",
    status: "todo",
    priority: "普通",
    date: dateKey(),
    time: "",
    url: "",
    values: {},
    created: new Date().toISOString(),
  };
}
export function initialWorkspace(): Workspace {
  const today = dateKey();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const entry = (title: string, rest: Partial<Entry> = {}): Entry => ({
    ...blankEntry(),
    title,
    sample: true,
    ...rest,
  });
  return {
    version: 1,
    name: "我的工作台",
    theme: "light",
    layout: "balanced",
    example: true,
    modules: [
      {
        id: "tasks",
        name: "我的待办",
        description: "把想做的事，变成做完的事",
        icon: "check",
        color: "green",
        view: "list",
        fields: [],
        hidden: false,
        entries: [
          entry("梳理本周工作优先级", {
            priority: "重要",
            status: "doing",
            description: "选出本周最重要的三件事，为它们安排完整的时间。",
          }),
          entry("准备项目沟通材料", {
            priority: "重要",
            description: "整理背景、当前进展与需要确认的问题。",
          }),
          entry("整理工作文件与常用链接", { date: dateKey(tomorrow) }),
          entry("回顾昨日工作记录", { status: "done" }),
          entry("安排今天的专注时间", { status: "done" }),
        ],
      },
      {
        id: "projects",
        name: "项目空间",
        description: "从想法到落地，每一步都看得见",
        icon: "folder",
        color: "blue",
        view: "board",
        fields: ["负责人"],
        hidden: false,
        entries: [
          entry("个人工作流优化", {
            status: "doing",
            description: "梳理日常重复动作，让工作节奏更从容。",
            values: { 负责人: "我" },
            priority: "重要",
          }),
          entry("季度计划整理", {
            description: "确定本季度的目标、里程碑与下一步。",
            date: dateKey(tomorrow),
          }),
          entry("资料归档规范", {
            status: "done",
            description: "建立统一命名规则，减少寻找文件的时间。",
          }),
        ],
      },
      {
        id: "notes",
        name: "工作笔记",
        description: "留住每个值得记录的想法",
        icon: "note",
        color: "orange",
        view: "notes",
        fields: [],
        hidden: false,
        entries: [
          entry("给工作留一点余白", {
            description:
              "每天只选择三件真正重要的事。\n\n留出不被打扰的时间，把注意力交给眼前的工作。\n\n结束一天时，记录一个收获和明天的第一步。",
          }),
          entry("我的工作台使用指南", {
            description:
              "点击「新增模块」，为自己的工作创建专属空间。\n\n在模块右上角切换列表、看板、日历或笔记模板，已有内容会完整保留。\n\n通过「模板中心」切换首页布局；通过「偏好设置」更换主题和导出备份。",
          }),
          entry("周复盘的三个问题", {
            description:
              "这周完成了什么？\n\n什么事情可以做得更好？\n\n下周最值得投入时间的是什么？",
          }),
        ],
      },
      {
        id: "links",
        name: "常用链接",
        description: "每天要去的地方，都在这里",
        icon: "link",
        color: "purple",
        view: "links",
        fields: [],
        hidden: false,
        entries: [
          entry("ChatGPT", {
            url: "https://chatgpt.com",
            description: "思考与创作助手",
          }),
          entry("GitHub", {
            url: "https://github.com",
            description: "代码与项目协作",
          }),
          entry("Notion", {
            url: "https://www.notion.so",
            description: "文档与知识管理",
          }),
          entry("Figma", {
            url: "https://www.figma.com",
            description: "设计与创意协作",
          }),
        ],
      },
      {
        id: "schedule",
        name: "日程安排",
        description: "让重要的时间，各就其位",
        icon: "calendar",
        color: "pink",
        view: "calendar",
        fields: [],
        hidden: false,
        entries: [
          entry("每日工作规划", {
            time: "09:00",
            description: "确认当天目标与优先级。",
            status: "done",
          }),
          entry("项目进度沟通", {
            time: "14:00",
            description: "对齐当前进度与后续安排。",
          }),
          entry("一天的小结", {
            time: "17:30",
            description: "记下今天的进展，准备明天的第一步。",
          }),
        ],
      },
    ],
  };
}
export function validateWorkspace(x: unknown): x is Workspace {
  if (!x || typeof x !== "object") return false;
  const a = x as Workspace;
  try {
    return (
      a.version === 1 &&
      typeof a.name === "string" &&
      a.name.length < 100 &&
      ["light", "sand", "dark"].includes(a.theme) &&
      ["balanced", "focus", "compact"].includes(a.layout) &&
      typeof a.example === "boolean" &&
      Array.isArray(a.modules) &&
      new Set(a.modules.map((m) => m.id)).size === a.modules.length &&
      a.modules.every(
        (m) =>
          m &&
          typeof m.id === "string" &&
          /^[\w-]+$/.test(m.id) &&
          typeof m.name === "string" &&
          typeof m.description === "string" &&
          typeof m.icon === "string" &&
          colors.includes(m.color) &&
          views.some((v) => v.id === m.view) &&
          typeof m.hidden === "boolean" &&
          Array.isArray(m.fields) &&
          m.fields.every((f) => typeof f === "string") &&
          Array.isArray(m.entries) &&
          new Set(m.entries.map((e) => e.id)).size === m.entries.length &&
          m.entries.every(
            (e) =>
              e &&
              typeof e.id === "string" &&
              /^[\w-]+$/.test(e.id) &&
              typeof e.title === "string" &&
              typeof e.description === "string" &&
              ["todo", "doing", "done"].includes(e.status) &&
              ["普通", "重要", "紧急"].includes(e.priority) &&
              typeof e.date === "string" &&
              (!e.date || /^\d{4}-\d{2}-\d{2}$/.test(e.date)) &&
              typeof e.time === "string" &&
              typeof e.url === "string" &&
              typeof e.created === "string" &&
              (e.sample === undefined || typeof e.sample === "boolean") &&
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
export function safeUrl(value: string) {
  try {
    const u = new URL(value);
    return ["http:", "https:"].includes(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
}

/** Parse without mutating storage. Invalid input must remain recoverable. */
export function loadWorkspace(raw: string | null): {
  workspace: Workspace;
  recoveryRaw: string | null;
} {
  if (raw === null) return { workspace: initialWorkspace(), recoveryRaw: null };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (validateWorkspace(parsed))
      return { workspace: parsed, recoveryRaw: null };
  } catch {}
  return { workspace: initialWorkspace(), recoveryRaw: raw };
}
/** Only untouched seeded entries can be cleared; user records are preserved. */
export function removeExampleEntries(workspace: Workspace): Workspace {
  return {
    ...workspace,
    example: false,
    modules: workspace.modules.map((m) => ({
      ...m,
      entries: m.entries.filter((e) => e.sample !== true),
    })),
  };
}
