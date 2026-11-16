import React from "react";
import { it, expect, vi, afterEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
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

it.each([
  [401, "下载接口未识别到登录状态"],
  [403, "当前登录账号与所有者不匹配"],
  [404, "当前地址没有采集服务"],
  [503, "连接配置尚未就绪"],
])(
  "下载失败 %i 展示实际错误，并提供正常登录/新窗口入口",
  async (status, message) => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        url === "/api/agent-setup"
          ? response({ error: message }, status)
          : response({ sessions: [], devices: [], hasMore: false }),
      ),
    );
    const user = userEvent.setup();
    render(<AgentJournal {...props()} />);
    await user.click(await screen.findByRole("button", { name: "开始连接" }));
    await user.click(screen.getByRole("button", { name: "下载连接配置" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      `HTTP ${status} · ${message}`,
    );
    expect(screen.getByRole("link", { name: "在新窗口下载" })).toHaveAttribute(
      "href",
      "/api/agent-setup",
    );
    expect(
      screen.getByRole("link", { name: "重新登录工作台" }),
    ).toHaveAttribute("target", "_top");
  },
);

it("切换来源后忽略仍在返回的旧分页，不把旧记录混入新列表", async () => {
  let completeOldPage!: (value: Response) => void;
  const fetcher = vi.fn((url: string) => {
    if (url.includes("offset="))
      return new Promise<Response>((resolve) => {
        completeOldPage = resolve;
      });
    return response({
      sessions: [
        {
          ...session,
          id: url.includes("source=claude") ? "new" : "old",
          summary: url.includes("source=claude") ? "新来源记录" : "原来源记录",
        },
      ],
      devices: [],
      hasMore: !url.includes("source=claude"),
    });
  });
  vi.stubGlobal("fetch", fetcher);
  const user = userEvent.setup();
  render(<AgentJournal {...props()} />);
  await user.click(await screen.findByRole("button", { name: "加载更多会话" }));
  await user.selectOptions(
    screen.getByRole("combobox", { name: "来源" }),
    "claude",
  );
  await screen.findByRole("heading", { name: "新来源记录" });
  await act(async () =>
    completeOldPage(
      new Response(
        JSON.stringify({
          sessions: [{ ...session, id: "late", summary: "迟到的旧记录" }],
          devices: [],
          hasMore: false,
        }),
        { headers: { "content-type": "application/json" } },
      ),
    ),
  );
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "导出当前记录" })).toBeEnabled(),
  );
  expect(
    screen.queryByRole("heading", { name: "迟到的旧记录" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("heading", { name: "原来源记录" }),
  ).not.toBeInTheDocument();
});

it("分页去重后仍按服务端返回条数推进 offset", async () => {
  const fetcher = vi.fn((url: string) => {
    const offset = new URL(url, "http://localhost").searchParams.get("offset");
    const ids =
      offset === "4" ? ["d"] : offset === "2" ? ["b", "c"] : ["a", "b"];
    return response({
      sessions: ids.map((id) => ({ ...session, id, summary: `会话 ${id}` })),
      devices: [],
      hasMore: offset !== "4",
    });
  });
  vi.stubGlobal("fetch", fetcher);
  const user = userEvent.setup();
  render(<AgentJournal {...props()} />);
  await user.click(await screen.findByRole("button", { name: "加载更多会话" }));
  await screen.findByRole("heading", { name: "会话 c" });
  expect(screen.getAllByRole("heading", { name: "会话 b" })).toHaveLength(1);
  await user.click(screen.getByRole("button", { name: "加载更多会话" }));
  await screen.findByRole("heading", { name: "会话 d" });
  expect(fetcher.mock.calls.at(-1)?.[0]).toContain("offset=4");
});

it("刷新失败保留已读取内容并禁用导出，重试成功后恢复", async () => {
  let fail = false;
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      fail
        ? response({}, 503)
        : response({ sessions: [session], devices: [], hasMore: false }),
    ),
  );
  const user = userEvent.setup();
  render(<AgentJournal {...props()} />);
  await screen.findByRole("heading", { name: "修复保存逻辑" });
  fail = true;
  await user.click(screen.getByRole("button", { name: "刷新", exact: true }));
  expect(await screen.findByRole("alert")).toHaveTextContent("保留上次读取");
  expect(
    screen.getByRole("heading", { name: "修复保存逻辑" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "导出当前记录" })).toBeDisabled();
  fail = false;
  await user.click(screen.getByRole("button", { name: "重试", exact: true }));
  await waitFor(() =>
    expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
  );
  expect(screen.getByRole("button", { name: "导出当前记录" })).toBeEnabled();
});

it("项目输入在提交后才筛选；无匹配结果提供查看全部记录入口", async () => {
  const fetcher = vi.fn(() =>
    response({ sessions: [], devices: [], hasMore: false }),
  );
  vi.stubGlobal("fetch", fetcher);
  const user = userEvent.setup();
  render(<AgentJournal {...props()} />);
  await screen.findByRole("button", { name: "开始连接" });
  await user.type(screen.getByRole("textbox", { name: "项目" }), "workdk");
  expect(fetcher).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole("button", { name: "筛选", exact: true }));
  await waitFor(() =>
    expect(fetcher.mock.calls.at(-1)?.[0]).toContain("project=workdk"),
  );
  await user.click(await screen.findByRole("button", { name: "查看全部记录" }));
  await waitFor(() =>
    expect(fetcher.mock.calls.at(-1)?.[0]).toContain("day=&source=&project="),
  );
});

it("关闭详情再打开其他会话，不显示迟到的上一会话来源", async () => {
  let completeOldDetail!: (value: Response) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url.startsWith("/api/agent-session?")) {
        if (url.includes("id=old"))
          return new Promise<Response>((resolve) => {
            completeOldDetail = resolve;
          });
        return response({
          events: [
            {
              id: "new-event",
              kind: "stop",
              at: session.updated,
              summary: "新的来源依据",
              evidence: "",
            },
          ],
          next: null,
        });
      }
      return response({
        sessions: [
          { ...session, id: "old", summary: "旧会话" },
          { ...session, id: "new", summary: "新会话" },
        ],
        devices: [],
        hasMore: false,
      });
    }),
  );
  const user = userEvent.setup();
  render(<AgentJournal {...props()} />);
  await user.click(await screen.findByRole("button", { name: /旧会话/ }));
  await user.click(screen.getByRole("button", { name: "关闭弹窗" }));
  await user.click(screen.getByRole("button", { name: /新会话/ }));
  await screen.findByText("新的来源依据");
  await act(async () =>
    completeOldDetail(
      new Response(
        JSON.stringify({
          events: [
            {
              id: "old-event",
              kind: "stop",
              at: session.updated,
              summary: "旧的来源依据",
              evidence: "",
            },
          ],
          next: null,
        }),
        { headers: { "content-type": "application/json" } },
      ),
    ),
  );
  await waitFor(() =>
    expect(screen.getByRole("dialog")).toHaveTextContent("新的来源依据"),
  );
  expect(screen.queryByText("旧的来源依据")).not.toBeInTheDocument();
});
