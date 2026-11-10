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
  fieldConfig?: FieldConfig;
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
          m.name.trim().length > 0 &&
          typeof m.description === "string" &&
          typeof m.icon === "string" &&
          colors.includes(m.color) &&
          views.some((v) => v.id === m.view) &&
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

export type LearningPreset = {
  id: string;
  name: string;
  english: string;
  description: string;
  icon: string;
  color: string;
  view: View;
  fields: string[];
  examples: {
    title: string;
    description: string;
    values: Record<string, string>;
    status?: Entry["status"];
    dayOffset?: number;
  }[];
};

export const learningPresets: LearningPreset[] = [
  {
    id: "vocabulary",
    name: "我的单词本",
    english: "WORDS IN CONTEXT",
    description: "把工作和生活中遇到的词，变成自己会用的表达。",
    icon: "book",
    color: "green",
    view: "list",
    fields: ["中文释义", "例句", "熟悉程度", "复习计划"],
    examples: [
      {
        title: "clarify",
        description: "用自己的话写一个例句，再试着在真实沟通中使用。",
        values: {
          中文释义: "澄清；讲清楚",
          例句: "Could you clarify the deadline?",
          熟悉程度: "见过，正在练习",
          复习计划: "明天用这个词造一个新句子",
        },
        status: "doing",
      },
      {
        title: "prioritize",
        description: "记录一个你今天需要优先处理的事项。",
        values: {
          中文释义: "按优先顺序处理",
          例句: "We need to prioritize the most important tasks.",
          熟悉程度: "新词",
          复习计划: "下次复习时遮住释义回想",
        },
      },
      {
        title: "consistent",
        description: "把词汇和一个熟悉的情境联系起来。",
        values: {
          中文释义: "持续一致的；一贯的",
          例句: "Small, consistent efforts can make a difference.",
          熟悉程度: "新词",
          复习计划: "本周复习并补充自己的例句",
        },
      },
    ],
  },
  {
    id: "daily-english",
    name: "英语每日打卡",
    english: "A LITTLE, EVERY DAY",
    description: "给英语留一小段时间，让每次练习都看得见。",
    icon: "calendar",
    color: "blue",
    view: "calendar",
    fields: ["学习时长（分钟）", "学习内容", "今日收获"],
    examples: [
      {
        title: "15 分钟，开启今天的英语",
        description:
          "选一小段材料，听一遍、读一遍，记下一个有用的表达。完成后填写实际学习时长。",
        values: {
          "学习时长（分钟）": "",
          学习内容: "听读一段短材料",
          今日收获: "",
        },
      },
      {
        title: "复习昨天记下的表达",
        description: "先回忆，再对照笔记检查。选一个表达造句。",
        values: {
          "学习时长（分钟）": "",
          学习内容: "词汇与表达复习",
          今日收获: "",
        },
        dayOffset: 1,
      },
      {
        title: "一周学习小回顾",
        description: "哪些内容能主动用出来？下周准备继续练什么？",
        values: { "学习时长（分钟）": "", 学习内容: "学习复盘", 今日收获: "" },
        dayOffset: 6,
      },
    ],
  },
  {
    id: "listening-reading",
    name: "听力与精读",
    english: "LISTEN. NOTICE. REPEAT.",
    description: "留住材料、关键表达和理解过程，反复练得更扎实。",
    icon: "headphones",
    color: "orange",
    view: "notes",
    fields: ["材料链接", "关键表达", "理解程度", "下一步"],
    examples: [
      {
        title: "一段材料，分三次听",
        description:
          "第一次：不看文本，抓住主题和大意。\n\n第二次：对照文本，标出没听清的地方和想学的表达。\n\n第三次：再听一遍，用两三句话概括内容。\n\n把自己的材料链接与笔记补充在下方字段中。",
        values: {
          材料链接: "",
          关键表达: "",
          理解程度: "待练习",
          下一步: "选一段长度适合自己的材料",
        },
      },
      {
        title: "精读笔记：从理解到运用",
        description:
          "主题：这段内容主要讲什么？\n\n表达：有哪些值得记住的词组或句式？\n\n复述：合上原文，用自己的话写一小段总结。\n\n应用：这个表达可以用在什么工作或生活场景？",
        values: {
          材料链接: "",
          关键表达: "",
          理解程度: "待练习",
          下一步: "填入自己的第一篇精读笔记",
        },
      },
    ],
  },
  {
    id: "speaking",
    name: "口语练习计划",
    english: "FIND YOUR OWN VOICE",
    description: "按场景准备、开口练习、记录回顾，让想法说得出来。",
    icon: "mic",
    color: "purple",
    view: "board",
    fields: ["练习场景", "目标表达", "录音链接", "自评与改进"],
    examples: [
      {
        title: "用一分钟介绍今天的工作",
        description:
          "先列三个关键词，再脱稿说一分钟。回听时记录一个说得顺的地方和一个想改进的地方。",
        values: {
          练习场景: "工作介绍",
          目标表达: "Today I am working on…",
          录音链接: "",
          自评与改进: "",
        },
        status: "doing",
      },
      {
        title: "向同事确认需求",
        description:
          "练习礼貌地确认目标、范围和截止时间，尝试换一种说法表达同一意思。",
        values: {
          练习场景: "需求沟通",
          目标表达: "Could you clarify what you need by Friday?",
          录音链接: "",
          自评与改进: "",
        },
      },
      {
        title: "复述一段学习内容",
        description: "看完一段材料后，离开原文，用自己的话讲出主题和两个要点。",
        values: {
          练习场景: "内容复述",
          目标表达: "The main idea is…",
          录音链接: "",
          自评与改进: "",
        },
      },
    ],
  },
];

export function createModuleFromLearningPreset(presetId: string): Module {
  const preset = learningPresets.find((p) => p.id === presetId);
  if (!preset) throw new Error("Unknown learning template");
  return {
    id: uid(),
    name: preset.name,
    description: preset.description,
    icon: preset.icon,
    color: preset.color,
    view: preset.view,
    fields: [...preset.fields],
    fieldConfig: Object.fromEntries(
      preset.fields.map((field) => [
        field,
        structuredClone(getFieldDefinition({}, field)),
      ]),
    ),
    hidden: false,
    entries: preset.examples.map((example) => {
      const date = new Date();
      date.setDate(date.getDate() + (example.dayOffset || 0));
      return {
        ...blankEntry(),
        title: example.title,
        description: example.description,
        values: { ...example.values },
        status: example.status || "todo",
        date: dateKey(date),
        sample: true,
      };
    }),
  };
}

export function isValidDateValue(value: string): boolean {
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

export function isValidTimeValue(value: string): boolean {
  return !value || /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export type WorkspaceSaveResult =
  | { status: "saved"; raw: string }
  | { status: "conflict"; raw: string | null }
  | { status: "error" };

/** Preserve another window's version instead of silently overwriting it. */
export function persistWorkspace(
  storage: {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
  },
  key: string,
  workspace: Workspace,
  expectedRaw: string | null,
): WorkspaceSaveResult {
  try {
    const nextRaw = JSON.stringify(workspace);
    const currentRaw = storage.getItem(key);
    if (currentRaw !== expectedRaw && currentRaw !== nextRaw)
      return { status: "conflict", raw: currentRaw };
    if (currentRaw !== nextRaw) storage.setItem(key, nextRaw);
    return { status: "saved", raw: nextRaw };
  } catch {
    return { status: "error" };
  }
}

export type FieldType = "text" | "number" | "select" | "url";
export type FieldDefinition = {
  type: FieldType;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
};
export type FieldConfig = Record<string, FieldDefinition>;
export const fieldTypeLabels: Record<FieldType, string> = {
  text: "文本",
  number: "数字",
  select: "选项",
  url: "链接",
};

/** Old English modules gain suitable controls without rewriting their values. */
export function getFieldDefinition(
  module: Pick<Module, "fieldConfig">,
  field: string,
): FieldDefinition {
  if (module.fieldConfig?.[field]) return module.fieldConfig[field];
  if (field === "学习时长（分钟）")
    return { type: "number", min: 0, max: 1440, step: 1, unit: "分钟" };
  if (field === "熟悉程度")
    return {
      type: "select",
      options: ["新词", "见过，正在练习", "基本掌握", "熟练运用"],
    };
  if (field === "理解程度")
    return {
      type: "select",
      options: ["待练习", "理解大意", "大部分听懂", "能够复述"],
    };
  if (["材料链接", "录音链接"].includes(field)) return { type: "url" };
  return { type: "text" };
}

export function validateFieldConfig(value: unknown): value is FieldConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.entries(value).every(([name, raw]) => {
    if (!name.trim() || !raw || typeof raw !== "object" || Array.isArray(raw))
      return false;
    const def = raw as FieldDefinition;
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

export function fieldValueError(
  def: FieldDefinition,
  value: string,
): string | null {
  if (!value.trim()) return null;
  if (def.type === "url")
    return safeUrl(value)
      ? null
      : "请填写以 http:// 或 https:// 开头的有效链接。";
  if (def.type === "select")
    return def.options?.includes(value) ? null : "请从选项中选择一个值。";
  if (def.type === "number") {
    const number = Number(value);
    if (
      !/^-?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?$/.test(value) ||
      !Number.isFinite(number)
    )
      return "请填写有效数字。";
    if (def.min !== undefined && number < def.min)
      return `不能小于 ${def.min}。`;
    if (def.max !== undefined && number > def.max)
      return `不能大于 ${def.max}。`;
    if (def.step !== undefined) {
      const steps = (number - (def.min || 0)) / def.step;
      if (Math.abs(steps - Math.round(steps)) > 1e-8)
        return def.step === 1
          ? "请填写整数。"
          : `请按 ${def.step} 的步长填写。`;
    }
  }
  return null;
}

/** Unchanged legacy free text is retained; new edits follow the field rules. */
export function validateCustomFieldValues(
  module: Module,
  values: Record<string, string>,
  original: Record<string, string> = {},
): string | null {
  for (const field of module.fields) {
    const value = values[field] || "";
    if (value === original[field]) continue;
    const error = fieldValueError(getFieldDefinition(module, field), value);
    if (error) return `${field}：${error}`;
  }
  return null;
}
