import React from "react";
import { it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, within, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App";
import {
  initialWorkspace,
  blankEntry,
  dateKey,
  createModuleFromLearningPreset,
} from "../../src/workspace";
import { agentSessionPath } from "../../src/agent/links";
import { useToday } from "../../src/hooks/useToday";
const saved = () => JSON.parse(localStorage.getItem("yiyu-workspace-v1")!);
const json = (data: unknown, status = 200) =>
  Promise.resolve(
    new Response(JSON.stringify(data), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
function fixture() {
  const d = initialWorkspace();
  d.modules.forEach((m) => (m.entries = []));
  localStorage.setItem("yiyu-workspace-v1", JSON.stringify(d));
  vi.stubGlobal(
    "fetch",
    vi.fn(() => json({ sessions: [], devices: [], hasMore: false })),
  );
  return d;
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it("首页只聚焦待办，快速记录一句话可保存；随手记不混入任务", async () => {
  const d = fixture();
  const words = createModuleFromLearningPreset("vocabulary");
  words.entries = [{ ...blankEntry(), title: "单词不是任务", sample: false }];
  d.modules.push(words);
  localStorage.setItem("yiyu-workspace-v1", JSON.stringify(d));
  const user = userEvent.setup();
  render(<App />);
  const focus = await screen.findByRole("region", { name: "今日聚焦" });
  expect(focus).not.toHaveTextContent("单词不是任务");
  await user.click(
    screen.getByRole("button", { name: "快速记录", exact: true }),
  );
  await user.type(
    screen.getByRole("textbox", { name: "记下什么？" }),
    "核对发布结果",
  );
  await user.click(screen.getByRole("button", { name: "保存记录" }));
  await waitFor(() =>
    expect(saved().modules[0].entries[0].title).toBe("核对发布结果"),
  );
  expect(focus).toHaveTextContent("核对发布结果");
  await user.click(screen.getByRole("button", { name: "打开快速记录" }));
  await user.click(
    within(screen.getByRole("dialog")).getByRole("button", { name: "随手记" }),
  );
  await user.type(
    screen.getByRole("textbox", { name: "记下什么？" }),
    "记录一个想法",
  );
  await user.click(screen.getByRole("button", { name: "保存记录" }));
  await waitFor(() =>
    expect(
      saved().modules.find((m: { id: string }) => m.id === "notes").entries[0]
        .title,
    ).toBe("记录一个想法"),
  );
  expect(focus).not.toHaveTextContent("记录一个想法");
});

it("快速记录草稿有放弃保护，未安排的事项可单独查看并完成", async () => {
  fixture();
  const user = userEvent.setup();
  render(<App />);
  await user.click(
    await screen.findByRole("button", { name: "快速记录", exact: true }),
  );
  await user.type(
    screen.getByRole("textbox", { name: "记下什么？" }),
    "未定时间的任务",
  );
  await user.click(screen.getByText("更多选项", { exact: true }));
  const date = screen.getByLabelText("计划日期");
  await user.clear(date);
  await user.click(screen.getByRole("button", { name: "关闭弹窗" }));
  expect(window.confirm).toHaveBeenCalled();
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "保存记录" }));
  const focus = screen.getByRole("region", { name: "今日聚焦" });
  expect(focus).not.toHaveTextContent("未定时间的任务");
  await user.click(within(focus).getByRole("button", { name: /未安排/ }));
  await user.click(
    within(focus).getByRole("button", { name: "完成 未定时间的任务" }),
  );
  expect(focus).not.toHaveTextContent("未定时间的任务");
  await waitFor(() =>
    expect(saved().modules[0].entries[0].status).toBe("done"),
  );
});

it("用途与视图独立，修改用途后才加入今日聚焦，已有记录保留", async () => {
  const d = fixture();
  const words = createModuleFromLearningPreset("vocabulary");
  words.entries = [{ ...blankEntry(), title: "转为待办的记录", sample: false }];
  d.modules.push(words);
  localStorage.setItem("yiyu-workspace-v1", JSON.stringify(d));
  history.replaceState(null, "", `/#modules/${words.id}`);
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByRole("button", { name: "模块设置" }));
  await user.selectOptions(
    screen.getByRole("combobox", { name: /模块用途/ }),
    "tasks",
  );
  await user.click(screen.getByRole("button", { name: "保存更改" }));
  await waitFor(() => expect(saved().modules.at(-1).purpose).toBe("tasks"));
  expect(saved().modules.at(-1).entries[0].title).toBe("转为待办的记录");
  await user.click(
    within(screen.getByRole("navigation")).getByRole("button", {
      name: "我的工作台",
      exact: true,
    }),
  );
  expect(
    await screen.findByRole("region", { name: "今日聚焦" }),
  ).toHaveTextContent("转为待办的记录");
});

it("带特殊字符的会话直达可添加关联待办，修改正文后仍可往返且不会重复添加", async () => {
  fixture();
  const session = {
    id: '["d","codex","研发/100%+?","p"]',
    device: "d",
    source: "codex",
    project: "p",
    session: "s",
    started: "2026-11-16T01:00:00Z",
    updated: "2026-11-16T02:00:00Z",
    count: 1,
    state: "stop",
    summary: "核对来源成果",
  };
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) =>
      url.startsWith("/api/agent-session?")
        ? json({ session, events: [], next: null, hasMore: false })
        : json({ sessions: [], devices: [], hasMore: false }),
    ),
  );
  history.replaceState(null, "", "/#" + agentSessionPath(session.id));
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole("heading", { name: "核对来源成果" });
  await user.selectOptions(screen.getByLabelText("添加到待办模块"), "tasks");
  await user.click(
    screen.getByRole("button", { name: "添加待办", exact: true }),
  );
  await waitFor(() =>
    expect(saved().modules[0].entries[0].agentSessionId).toBe(session.id),
  );
  const related = screen.getByRole("region", { name: "关联待办" });
  await user.click(
    within(related).getByRole("button", { name: "核对来源成果" }),
  );
  await user.click(
    await screen.findByRole("button", { name: "编辑", exact: true }),
  );
  const description = screen.getByRole("textbox", { name: "正文 / 说明" });
  await user.clear(description);
  await user.type(description, "自己的后续计划");
  await user.click(screen.getByRole("button", { name: "保存内容" }));
  await user.click(await screen.findByRole("button", { name: "查看来源会话" }));
  expect(
    await screen.findByRole("region", { name: "关联待办" }),
  ).toHaveTextContent("核对来源成果");
  expect(
    screen.queryByRole("button", { name: "添加待办", exact: true }),
  ).not.toBeInTheDocument();
  expect(saved().modules[0].entries).toHaveLength(1);
});

it("会话不存在时展示错误，可关闭返回日志而不创建空任务", async () => {
  fixture();
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) =>
      url.startsWith("/api/agent-session?")
        ? json({ error: "missing" }, 404)
        : json({ sessions: [], devices: [], hasMore: false }),
    ),
  );
  history.replaceState(null, "", "/#agents?session=missing");
  const user = userEvent.setup();
  render(<App />);
  expect(await screen.findByRole("alert")).toHaveTextContent("无法找到此会话");
  expect(
    screen.queryByRole("button", { name: "添加待办", exact: true }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "关闭弹窗" }));
  await waitFor(() => expect(location.hash).toBe("#agents"));
  expect(saved().modules[0].entries).toHaveLength(0);
});

it("跨过本地午夜并返回页面时重新计算今天", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 16, 23, 59));
  function Today() {
    return <span>{useToday()}</span>;
  }
  render(<Today />);
  expect(screen.getByText("2026-11-16")).toBeInTheDocument();
  act(() => {
    vi.setSystemTime(new Date(2026, 10, 17, 0, 1));
    window.dispatchEvent(new Event("focus"));
  });
  expect(screen.getByText("2026-11-17")).toBeInTheDocument();
});

it("编辑旧版关联待办时把来源保留为独立字段，清空原说明不会断开关联", async () => {
  const d = fixture();
  const old = {
    ...blankEntry(),
    title: "旧版待办",
    description: "原摘要\n\nAgent 来源编号：legacy-session",
    sample: false,
  };
  d.modules[0].entries.push(old);
  localStorage.setItem("yiyu-workspace-v1", JSON.stringify(d));
  history.replaceState(null, "", `/#modules/tasks/items/${old.id}`);
  const user = userEvent.setup();
  render(<App />);
  await user.click(
    await screen.findByRole("button", { name: "编辑", exact: true }),
  );
  await user.clear(screen.getByRole("textbox", { name: "正文 / 说明" }));
  await user.click(screen.getByRole("button", { name: "保存内容" }));
  await waitFor(() =>
    expect(saved().modules[0].entries[0].agentSessionId).toBe("legacy-session"),
  );
  expect(saved().modules[0].entries[0].description).toBe("");
  expect(
    screen.getByRole("button", { name: "查看来源会话" }),
  ).toBeInTheDocument();
});
