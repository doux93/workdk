import React from "react";
import { it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AgentJournal from "../../src/components/AgentJournal";
import { initialWorkspace } from "../../src/workspace";
const session = {
  id: "session-key",
  device: "device",
  source: "codex",
  project: "workdk",
  session: "s",
  started: "2026-11-10T01:00:00Z",
  updated: "2026-11-10T02:00:00Z",
  count: 2,
  state: "stop",
  summary: "修复保存逻辑\n仍需验收",
};
const response = (data: unknown, status = 200) =>
  Promise.resolve(
    new Response(JSON.stringify(data), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
const props = () => ({
  modules: initialWorkspace().modules,
  onAddTask: vi.fn(),
  navigate: vi.fn(),
});
afterEach(() => vi.unstubAllGlobals());
it("空记录页面提供连接入口，连接说明包含允许项目和后台上传", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => response({ sessions: [], devices: [], hasMore: false })),
  );
  const user = userEvent.setup();
  render(<AgentJournal {...props()} />);
  await user.click(await screen.findByRole("button", { name: "开始连接" }));
  expect(screen.getByRole("dialog")).toHaveTextContent("允许采集的项目");
  expect(screen.getByRole("link", { name: "下载采集器" })).toHaveAttribute(
    "href",
    "/workdk-agent.zip",
  );
});
it("服务失败明确提示，不展示伪造的工作记录", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => response({}, 503)),
  );
  render(<AgentJournal {...props()} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("连接失败");
  expect(
    screen.queryByRole("heading", { name: "修复保存逻辑" }),
  ).not.toBeInTheDocument();
});
it("本轮结束显示待验证，详情呈现工具依据，可添加待办", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) =>
      response(
        url.startsWith("/api/agent-session?")
          ? {
              events: [
                {
                  id: "e",
                  kind: "tool",
                  at: session.updated,
                  evidence: "Bash · exit 0",
                  summary: "",
                },
              ],
              next: null,
            }
          : { sessions: [session], devices: [], hasMore: false },
      ),
    ),
  );
  const user = userEvent.setup(),
    p = props();
  render(<AgentJournal {...p} />);
  await user.click(await screen.findByRole("button", { name: /修复保存逻辑/ }));
  expect(screen.getByRole("dialog")).toHaveTextContent("本轮结束 · 待验证");
  expect(await screen.findByText("Bash · exit 0")).toBeInTheDocument();
  const options = p.modules.filter(
    (m) => !m.hidden && ["list", "board"].includes(m.view),
  );
  await user.selectOptions(
    screen.getByRole("combobox", { name: "添加到待办模块" }),
    options[0].id,
  );
  await user.click(
    screen.getByRole("button", { name: "添加待办", exact: true }),
  );
  expect(p.onAddTask).toHaveBeenCalledWith(options[0].id, session);
});
it("修正摘要调用保存接口，保留来源事件展示", async () => {
  const fetcher = vi.fn((url: string, o?: RequestInit) =>
    response(
      o?.method === "PATCH"
        ? { ok: true }
        : url.startsWith("/api/agent-session?")
          ? {
              events: [
                {
                  id: "e",
                  kind: "stop",
                  at: session.updated,
                  summary: "原始摘要",
                  evidence: "",
                },
              ],
              next: null,
            }
          : { sessions: [session], devices: [], hasMore: false },
    ),
  );
  vi.stubGlobal("fetch", fetcher);
  const user = userEvent.setup();
  render(<AgentJournal {...props()} />);
  await user.click(await screen.findByRole("button", { name: /修复保存逻辑/ }));
  await screen.findByText("原始摘要");
  await user.click(screen.getByRole("button", { name: "修正摘要" }));
  const summary = screen.getByRole("textbox", { name: "工作摘要" });
  await user.clear(summary);
  await user.type(summary, "补充验收结论");
  await user.click(screen.getByRole("button", { name: "保存修正" }));
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: "保存修正" }),
    ).not.toBeInTheDocument(),
  );
  expect(screen.getByRole("dialog")).toHaveTextContent("补充验收结论");
  expect(screen.getByRole("dialog")).toHaveTextContent("原始摘要");
  expect(fetcher.mock.calls.some(([, o]) => o?.method === "PATCH")).toBe(true);
});
it("筛选来源发到服务端，列表分页追加会话", async () => {
  const fetcher = vi.fn((url: string) =>
    response({
      sessions: [{ ...session, id: url.includes("offset=") ? "s2" : "s1" }],
      devices: [],
      hasMore: !url.includes("offset="),
    }),
  );
  vi.stubGlobal("fetch", fetcher);
  const user = userEvent.setup();
  render(<AgentJournal {...props()} />);
  await screen.findByRole("button", { name: "加载更多会话" });
  await user.selectOptions(
    screen.getByRole("combobox", { name: "来源" }),
    "claude",
  );
  await waitFor(() =>
    expect(fetcher.mock.calls.at(-1)?.[0]).toContain("source=claude"),
  );
  await user.click(await screen.findByRole("button", { name: "加载更多会话" }));
  await waitFor(() =>
    expect(
      screen.getAllByRole("heading", { name: "修复保存逻辑" }).length,
    ).toBe(2),
  );
});
