import test from "node:test";
import assert from "node:assert/strict";
import {
  initialWorkspace,
  blankEntry,
  createModuleFromLearningPreset,
  modulePurpose,
  validateWorkspace,
  loadWorkspace,
} from "../src/workspace.ts";
import { focusItems, captureRecord } from "../src/workflow.ts";
import {
  addAgentTask,
  linkedTasks,
  linkedSessionId,
  agentSessionPath,
} from "../src/agent/links.ts";
const today = "2026-11-16";
const entry = (title, date = today, extra = {}) => ({
  ...blankEntry(),
  title,
  date,
  sample: false,
  ...extra,
});
const workspace = () => {
  const d = initialWorkspace();
  d.modules.forEach((m) => (m.entries = []));
  return d;
};

test("聚焦跨待办模块，区分今天、逾期、未安排和今天已完成，排除未来/学习/示例/隐藏模块", () => {
  const d = workspace();
  d.modules[0].entries = [
    entry("普通"),
    entry("逾期", "2026-11-15"),
    entry("未来", "2026-11-17"),
    entry("未安排", ""),
    entry("完成", today, { status: "done" }),
    entry("历史完成", "2026-11-15", { status: "done" }),
    entry("示例", today, { sample: true }),
  ];
  d.modules[1].view = "calendar";
  d.modules[1].entries = [entry("紧急", today, { priority: "紧急" })];
  const words = createModuleFromLearningPreset("vocabulary");
  words.entries = [entry("学习词汇")];
  d.modules.push(words);
  d.modules.push({
    ...d.modules[0],
    id: "hidden",
    hidden: true,
    entries: [entry("隐藏任务")],
  });
  const groups = focusItems(d.modules, today);
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(groups).map(([k, v]) => [k, v.map((x) => x.entry.title)]),
    ),
    {
      today: ["紧急", "普通"],
      overdue: ["逾期"],
      unscheduled: ["未安排"],
      done: ["完成"],
    },
  );
  assert.equal(
    focusItems(d.modules, "2026-11-17").today[0].entry.title,
    "未来",
  );
});

test("旧备份只兼容已知模块身份，不从列表视图猜测用途；字段校验保留兼容边界", () => {
  const d = workspace();
  d.modules.forEach((m) => delete m.purpose);
  d.modules.push({
    ...d.modules[0],
    id: "custom-vocabulary",
    name: "单词本",
    view: "list",
  });
  const original = JSON.stringify(d);
  const loaded = loadWorkspace(original);
  assert.equal(loaded.recoveryRaw, null);
  assert.equal(JSON.stringify(loaded.workspace), original);
  assert.equal(modulePurpose(loaded.workspace.modules[0]), "tasks");
  assert.equal(modulePurpose(loaded.workspace.modules.at(-1)), "collection");
  d.modules[0].purpose = "unknown";
  assert.equal(validateWorkspace(d), false);
  d.modules[0].purpose = "collection";
  assert.equal(validateWorkspace(d), true);
});

test("快速记录创建缺少的目的模块，重复记录保留既有数据且不改写自定义字段", () => {
  const d = workspace();
  d.modules = [];
  const input = {
    purpose: "tasks",
    moduleId: "",
    title: "  新待办  ",
    date: today,
    priority: "重要",
    description: "说明",
  };
  const first = captureRecord(d, input);
  assert.equal(validateWorkspace(first.workspace), true);
  assert.equal(d.modules.length, 0);
  assert.equal(first.workspace.modules[0].entries[0].title, "新待办");
  first.workspace.modules[0].fields = ["负责人"];
  const second = captureRecord(first.workspace, {
    ...input,
    moduleId: first.moduleId,
    title: "再记一条",
  });
  assert.equal(second.workspace.modules.length, 1);
  assert.equal(second.workspace.modules[0].entries.length, 2);
  assert.deepEqual(second.workspace.modules[0].fields, ["负责人"]);
  assert.deepEqual(
    second.workspace.modules[0].entries[1],
    first.workspace.modules[0].entries[0],
  );
  const note = captureRecord(second.workspace, {
    ...input,
    purpose: "notes",
    title: "想法",
  });
  assert.equal(modulePurpose(note.workspace.modules[1]), "notes");
  assert.equal(focusItems(note.workspace.modules, today).today.length, 2);
});

test("快速记录拒绝错误用途、已删除/隐藏目的模块和无效日期，不污染原工作台", () => {
  const d = workspace(),
    before = JSON.stringify(d);
  const input = {
    purpose: "tasks",
    moduleId: "tasks",
    title: "记录",
    description: "",
    date: today,
    priority: "普通",
  };
  for (const patch of [
    { title: " " },
    { date: "2026-02-30" },
    { moduleId: "missing" },
    { moduleId: "notes" },
    { priority: "other" },
  ])
    assert.throws(() => captureRecord(d, { ...input, ...patch }));
  assert.equal(JSON.stringify(d), before);
  d.modules[0].hidden = true;
  assert.throws(() => captureRecord(d, input));
});

const session = {
  id: '["device","codex","研发/100%+?","项目"]',
  summary: "原始摘要",
  summary_override: "核对后的摘要",
  title_override: "验证发布结果",
};
test("Agent 关联独立存储，跨模块去重，编辑正文后仍能往返，备份可保留", () => {
  const original = workspace();
  const d = addAgentTask(original, "tasks", session);
  const task = d.modules[0].entries[0];
  assert.equal(task.title, "验证发布结果");
  assert.equal(task.description, "核对后的摘要");
  assert.equal(task.agentSessionId, session.id);
  assert.equal(task.status, "todo");
  assert.equal(task.url, "");
  task.description = "用户补充了下一步";
  assert.equal(linkedTasks(d.modules, session.id).length, 1);
  assert.equal(addAgentTask(d, "projects", session), d);
  assert.equal(validateWorkspace(d), true);
  assert.equal(
    loadWorkspace(JSON.stringify(d)).workspace.modules[0].entries[0]
      .agentSessionId,
    session.id,
  );
  const encoded = agentSessionPath(session.id);
  assert.equal(
    new URLSearchParams(encoded.slice(encoded.indexOf("?") + 1)).get("session"),
    session.id,
  );
  task.agentSessionId = {};
  assert.equal(validateWorkspace(d), false);
});

test("旧版来源标记能反查且防止重复添加；隐藏模块中的关联仍可找回", () => {
  const d = workspace();
  const old = entry("旧待办", today, {
    description: "保留内容\n\nAgent 来源编号：" + session.id,
  });
  d.modules[0].entries.push(old);
  d.modules[0].hidden = true;
  assert.equal(linkedSessionId(old), session.id);
  assert.equal(linkedTasks(d.modules, session.id)[0].module.id, "tasks");
  assert.equal(addAgentTask(d, "projects", session), d);
  assert.equal(
    linkedSessionId(
      entry("普通说明", today, {
        description: "引用 Agent 来源编号：其他文字",
      }),
    ),
    null,
  );
});
