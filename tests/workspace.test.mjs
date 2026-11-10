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

test("旧窗口保存时检测已变化的版本，保留新窗口数据并返回冲突", async () => {
  const { persistWorkspace, blankEntry } = await import("../src/workspace.ts");
  const original = initialWorkspace();
  const expected = JSON.stringify(original);
  const newer = structuredClone(original);
  newer.modules[0].entries.push({ ...blankEntry(), title: "另一窗口的记录" });
  const newerRaw = JSON.stringify(newer);
  let stored = newerRaw;
  const storage = {
    getItem: () => stored,
    setItem: (_, value) => {
      stored = value;
    },
  };
  const stale = structuredClone(original);
  stale.name = "旧窗口仍在编辑";
  assert.deepEqual(persistWorkspace(storage, "workspace", stale, expected), {
    status: "conflict",
    raw: newerRaw,
  });
  assert.equal(stored, newerRaw);
  assert.equal(stale.name, "旧窗口仍在编辑");
});

test("保存失败与无法读取存储时返回错误，不把失败当作已保存", async () => {
  const { persistWorkspace } = await import("../src/workspace.ts");
  const workspace = initialWorkspace();
  let stored = "previous version";
  const full = {
    getItem: () => stored,
    setItem: () => {
      throw new Error("quota exceeded");
    },
  };
  assert.deepEqual(persistWorkspace(full, "workspace", workspace, stored), {
    status: "error",
  });
  assert.equal(stored, "previous version");
  const blocked = {
    getItem: () => {
      throw new Error("blocked storage");
    },
    setItem: () => {
      throw new Error("should not write");
    },
  };
  assert.deepEqual(persistWorkspace(blocked, "workspace", workspace, null), {
    status: "error",
  });
});

test("已保存的相同内容不会重复写入，另一窗口删除数据会触发冲突", async () => {
  const { persistWorkspace } = await import("../src/workspace.ts");
  const workspace = initialWorkspace();
  const raw = JSON.stringify(workspace);
  let writes = 0;
  const storage = {
    getItem: () => raw,
    setItem: () => {
      writes++;
    },
  };
  assert.deepEqual(persistWorkspace(storage, "workspace", workspace, raw), {
    status: "saved",
    raw,
  });
  assert.equal(writes, 0);
  assert.deepEqual(
    persistWorkspace(
      {
        getItem: () => null,
        setItem: () => {
          writes++;
        },
      },
      "workspace",
      workspace,
      raw,
    ),
    { status: "conflict", raw: null },
  );
  assert.equal(writes, 0);
});

test("导入校验拒绝不存在的日期、非法时间、空名称和重复字段", async () => {
  const { isValidDateValue, isValidTimeValue } = await import(
    "../src/workspace.ts"
  );
  for (const value of ["", "2024-02-29", "2000-02-29", "2026-12-31"])
    assert.equal(isValidDateValue(value), true);
  for (const value of [
    "2025-02-29",
    "1900-02-29",
    "2026-13-01",
    "2026-04-31",
    "0000-01-01",
  ])
    assert.equal(isValidDateValue(value), false);
  for (const value of ["", "00:00", "23:59"])
    assert.equal(isValidTimeValue(value), true);
  for (const value of ["24:00", "12:60", "9:00", "12:00:00"])
    assert.equal(isValidTimeValue(value), false);
  const badDate = initialWorkspace();
  badDate.modules[0].entries[0].date = "2026-02-30";
  assert.equal(validateWorkspace(badDate), false);
  const badTime = initialWorkspace();
  badTime.modules[0].entries[0].time = "24:00";
  assert.equal(validateWorkspace(badTime), false);
  const blank = initialWorkspace();
  blank.modules[0].name = "   ";
  assert.equal(validateWorkspace(blank), false);
  const duplicate = initialWorkspace();
  duplicate.modules[0].fields = ["负责人", "负责人"];
  assert.equal(validateWorkspace(duplicate), false);
});

test("字段类型元数据能随备份恢复，旧记录仍按名称保留", async () => {
  const {
    createModuleFromLearningPreset,
    getFieldDefinition,
    loadWorkspace,
    validateCustomFieldValues,
  } = await import("../src/workspace.ts");
  const workspace = initialWorkspace();
  const module = createModuleFromLearningPreset("daily-english");
  assert.equal(getFieldDefinition(module, "学习时长（分钟）").type, "number");
  workspace.modules.push(module);
  const restored = loadWorkspace(JSON.stringify(workspace));
  assert.equal(restored.recoveryRaw, null);
  assert.deepEqual(
    restored.workspace.modules.at(-1).fieldConfig,
    module.fieldConfig,
  );
  delete module.fieldConfig;
  assert.equal(getFieldDefinition(module, "学习时长（分钟）").type, "number");
  const legacy = { "学习时长（分钟）": "十五分钟" };
  assert.equal(validateCustomFieldValues(module, legacy, legacy), null);
  assert.match(
    validateCustomFieldValues(
      module,
      { "学习时长（分钟）": "不是数字" },
      legacy,
    ),
    /数字/,
  );
});

test("数字与选项校验限制新输入，不清空原有自定义等级", async () => {
  const {
    fieldValueError,
    validateCustomFieldValues,
    createModuleFromLearningPreset,
  } = await import("../src/workspace.ts");
  const definition = { type: "number", min: 0, max: 1440, step: 1 };
  assert.equal(fieldValueError(definition, "25"), null);
  for (const value of ["-1", "1441", "1.5", "0x10", "+15", " 15 ", "Infinity"])
    assert.ok(fieldValueError(definition, value));
  const module = createModuleFromLearningPreset("vocabulary");
  const legacy = { 熟悉程度: "我的等级" };
  assert.equal(validateCustomFieldValues(module, legacy, legacy), null);
  assert.match(
    validateCustomFieldValues(module, { 熟悉程度: "未知的新选项" }, legacy),
    /选项/,
  );
  assert.equal(
    validateCustomFieldValues(module, { 熟悉程度: "基本掌握" }, legacy),
    null,
  );
});

test("损坏字段配置被拒绝，类型设置在不同模块间独立", async () => {
  const { createModuleFromLearningPreset } = await import(
    "../src/workspace.ts"
  );
  const workspace = initialWorkspace();
  const first = createModuleFromLearningPreset("vocabulary"),
    second = createModuleFromLearningPreset("vocabulary");
  first.fieldConfig.熟悉程度.options.push("我的选项");
  assert.equal(second.fieldConfig.熟悉程度.options.includes("我的选项"), false);
  workspace.modules.push(first);
  assert.equal(validateWorkspace(workspace), true);
  first.fieldConfig.熟悉程度 = { type: "select", options: [] };
  assert.equal(validateWorkspace(workspace), false);
  first.fieldConfig.熟悉程度 = { type: "number", min: 100, max: 0 };
  assert.equal(validateWorkspace(workspace), false);
});

test("搜索结果有上限，筛选仍可定位数据集末尾的记录", async () => {
  const { searchWorkspace, filterEntries } = await import("../src/search.ts");
  const { createLargeWorkspace } = await import("./fixtures.mjs");
  const data = createLargeWorkspace(10000);
  const results = searchWorkspace(data.modules, "单词");
  assert.equal(results.entries.length, 30);
  assert.equal(results.hasMore, true);
  const last = searchWorkspace(data.modules, "benchmark-value-9999。");
  assert.equal(last.entries[0].entry.id, "entry-9999");
  assert.equal(
    filterEntries(data.modules[0].entries, "benchmark-value-9999。").length,
    1,
  );
});
