import test from "node:test";
import assert from "node:assert/strict";
import {
  initialWorkspace,
  validateWorkspace,
  safeUrl,
  dateKey,
} from "../src/workspace.ts";

test("完整备份恢复后保留自定义字段、模块身份和内容", () => {
  const workspace = initialWorkspace();
  const module = workspace.modules[0];
  module.fields = ["负责人", "地点"];
  module.entries[0].values = { 负责人: "张三", 地点: "会议室" };
  module.view = "calendar";
  workspace.layout = "focus";
  workspace.theme = "dark";
  const restored = JSON.parse(JSON.stringify(workspace));
  assert.equal(validateWorkspace(restored), true);
  assert.deepEqual(restored, workspace);
});
test("损坏备份被拒绝，验证器不崩溃", () => {
  const invalid = [
    null,
    {},
    [],
    { ...initialWorkspace(), modules: [null] },
    { ...initialWorkspace(), theme: "unknown" },
    { ...initialWorkspace(), version: 2 },
  ];
  for (const value of invalid) assert.equal(validateWorkspace(value), false);
  const duplicate = initialWorkspace();
  duplicate.modules.push(duplicate.modules[0]);
  assert.equal(validateWorkspace(duplicate), false);
  const badEntry = initialWorkspace();
  badEntry.modules[0].entries[0].values = { x: 42 };
  assert.equal(validateWorkspace(badEntry), false);
});
test("旧版本备份没有示例标记时仍完整保留用户数据", async () => {
  const { loadWorkspace, removeExampleEntries } = await import(
    "../src/workspace.ts"
  );
  const legacy = initialWorkspace();
  for (const module of legacy.modules) {
    for (const entry of module.entries) delete entry.sample;
  }
  const restored = loadWorkspace(JSON.stringify(legacy));
  assert.equal(restored.recoveryRaw, null);
  assert.equal(validateWorkspace(restored.workspace), true);
  const cleaned = removeExampleEntries(restored.workspace);
  assert.deepEqual(cleaned.modules, legacy.modules);
});

test("只允许 HTTP 和 HTTPS 网址", () => {
  assert.equal(
    safeUrl("https://example.com/path?q=1"),
    "https://example.com/path?q=1",
  );
  assert.equal(safeUrl("http://127.0.0.1:8000/"), "http://127.0.0.1:8000/");
  for (const value of [
    "javascript:alert(1)",
    "data:text/html,test",
    "file:///etc/passwd",
    "not a url",
    "",
  ])
    assert.equal(safeUrl(value), null);
});
test("日期在月初及年末保持本地日期和补零格式", () => {
  assert.equal(dateKey(new Date(2026, 0, 1, 23, 30)), "2026-01-01");
  assert.equal(dateKey(new Date(2026, 11, 31, 0, 1)), "2026-12-31");
});

test("损坏和不兼容的存储保留原始文本，供用户恢复", async () => {
  const { loadWorkspace } = await import("../src/workspace.ts");
  for (const raw of [
    "{broken json",
    "",
    JSON.stringify({ version: 99, modules: [] }),
  ]) {
    const result = loadWorkspace(raw);
    assert.equal(result.recoveryRaw, raw);
    assert.equal(validateWorkspace(result.workspace), true);
  }
  const workspace = initialWorkspace();
  const result = loadWorkspace(JSON.stringify(workspace));
  assert.equal(result.recoveryRaw, null);
  assert.deepEqual(result.workspace, workspace);
});

test("清理示例保留新增记录、编辑过的示例、自定义模块及布局", async () => {
  const { removeExampleEntries, blankEntry } = await import(
    "../src/workspace.ts"
  );
  const workspace = initialWorkspace();
  workspace.layout = "compact";
  const custom = {
    ...blankEntry(),
    title: "用户新增的记录",
    values: { 客户: "A" },
  };
  const edited = {
    ...workspace.modules[0].entries[0],
    sample: false,
    title: "已改成我的工作事项",
  };
  workspace.modules[0].entries.push(custom, edited);
  const result = removeExampleEntries(workspace);
  assert.equal(result.example, false);
  assert.equal(result.layout, "compact");
  assert.equal(result.modules.length, workspace.modules.length);
  assert.deepEqual(result.modules[0].entries, [custom, edited]);
  assert.equal(
    result.modules.slice(1).reduce((n, m) => n + m.entries.length, 0),
    0,
  );
  assert.equal(
    workspace.modules[0].entries.length > result.modules[0].entries.length,
    true,
  );
});

test("四款英语模板创建后符合备份格式，字段和学习内容可完整恢复", async () => {
  const { learningPresets, createModuleFromLearningPreset, loadWorkspace } =
    await import("../src/workspace.ts");
  const workspace = initialWorkspace();
  const before = structuredClone(workspace.modules);
  const learning = learningPresets.map((preset) =>
    createModuleFromLearningPreset(preset.id),
  );
  workspace.modules.push(...learning);
  assert.equal(validateWorkspace(workspace), true);
  const restored = loadWorkspace(JSON.stringify(workspace));
  assert.equal(restored.recoveryRaw, null);
  assert.deepEqual(restored.workspace.modules.slice(before.length), learning);
  assert.deepEqual(restored.workspace.modules.slice(0, before.length), before);
  for (const module of learning) {
    assert.equal(module.entries.length > 0, true);
    for (const entry of module.entries)
      assert.deepEqual(
        Object.keys(entry.values).sort(),
        [...module.fields].sort(),
      );
  }
});

test("重复添加英语模板产生独立的模块和记录，不共享或改写预设数据", async () => {
  const { learningPresets, createModuleFromLearningPreset } = await import(
    "../src/workspace.ts"
  );
  const presetsBefore = structuredClone(learningPresets);
  const first = createModuleFromLearningPreset("vocabulary");
  const second = createModuleFromLearningPreset("vocabulary");
  assert.notEqual(first.id, second.id);
  const allIds = [...first.entries, ...second.entries].map((entry) => entry.id);
  assert.equal(new Set(allIds).size, allIds.length);
  first.fields.push("自己的字段");
  first.entries[0].values["中文释义"] = "我的笔记";
  assert.notEqual(second.entries[0].values["中文释义"], "我的笔记");
  assert.deepEqual(learningPresets, presetsBefore);
  assert.throws(() => createModuleFromLearningPreset("unknown"));
});
