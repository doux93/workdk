import React from "react";
import { it, expect, vi, afterEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AgentDevices from "../../src/components/agents/AgentDevices";
import AgentConnection from "../../src/components/agents/AgentConnection";

const device = {
  device: "registered",
  label: "办公室电脑",
  created_at: "2026-11-16T00:00:00Z",
  revoked_at: null as string | null,
};
const response = (body: unknown, status = 200) =>
  Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
afterEach(() => vi.unstubAllGlobals());

it("停用需要确认，失败时保留设备并可重试；成功后呈现已停用", async () => {
  let revoked = false,
    fail = true;
  const fetcher = vi.fn((_url: string, options?: RequestInit) => {
    if (options?.method === "PATCH") {
      if (fail) return response({}, 503);
      revoked = true;
      return response({ ok: true });
    }
    return response({
      devices: [{ ...device, revoked_at: revoked ? "now" : null }],
    });
  });
  vi.stubGlobal("fetch", fetcher);
  const user = userEvent.setup();
  render(
    <AgentDevices devices={[]} revision={0} busy={false} onIssue={vi.fn()} />,
  );
  await user.click(await screen.findByRole("button", { name: "停用设备" }));
  expect(
    fetcher.mock.calls.some(([, options]) => options?.method === "PATCH"),
  ).toBe(false);
  vi.mocked(window.confirm).mockReturnValue(true);
  await user.click(screen.getByRole("button", { name: "停用设备" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("连接失败");
  expect(screen.getByText("办公室电脑")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "重试设备列表" }));
  fail = false;
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "停用设备" })).toBeEnabled(),
  );
  await user.click(screen.getByRole("button", { name: "停用设备" }));
  expect(await screen.findByText("已停用")).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "停用设备" }),
  ).not.toBeInTheDocument();
});

it("升级旧设备和重新签发保留目标编号，取消确认不发起签发", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => response({ devices: [device] })),
  );
  const issue = vi.fn(),
    user = userEvent.setup();
  render(
    <AgentDevices
      devices={[
        { device: "legacy", count: 2, lastSync: "2026-11-16T00:00:00Z" },
      ]}
      revision={0}
      busy={false}
      onIssue={issue}
    />,
  );
  await user.click(await screen.findByRole("button", { name: "重新签发配置" }));
  expect(issue).not.toHaveBeenCalled();
  vi.mocked(window.confirm).mockReturnValue(true);
  await user.click(screen.getByRole("button", { name: "升级连接配置" }));
  expect(issue).toHaveBeenLastCalledWith("legacy", "旧设备 legacy");
  await user.click(screen.getByRole("button", { name: "重新签发配置" }));
  expect(issue).toHaveBeenLastCalledWith(device.device, device.label);
});

it("签发使用 POST 和电脑名称，成功下载后刷新设备列表", async () => {
  const createUrl = vi.fn(() => "blob:synthetic");
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL = createUrl;
      static revokeObjectURL = vi.fn();
    },
  );
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  let issued = false;
  const fetcher = vi.fn((url: string, options?: RequestInit) => {
    if (url === "/api/agent-setup") {
      issued = true;
      return response({
        version: 2,
        device: device.device,
        token: "synthetic",
      });
    }
    return response({ devices: issued ? [device] : [] });
  });
  vi.stubGlobal("fetch", fetcher);
  const user = userEvent.setup();
  render(<AgentConnection devices={[]} onClose={vi.fn()} />);
  const label = screen.getByRole("textbox", { name: "电脑名称" });
  await user.clear(label);
  await user.type(label, device.label);
  await user.click(screen.getByRole("button", { name: "下载连接配置" }));
  expect(await screen.findByText(device.label)).toBeInTheDocument();
  const call = fetcher.mock.calls.find(([url]) => url === "/api/agent-setup")!;
  expect(call[1]?.method).toBe("POST");
  expect(JSON.parse(String(call[1]?.body))).toEqual({ label: device.label });
  expect(createUrl).toHaveBeenCalledTimes(1);
});

it("设备列表卸载时取消请求并忽略迟到响应", async () => {
  let signal!: AbortSignal;
  let resolve!: (value: Response) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn((_url: string, options?: RequestInit) => {
      signal = options?.signal as AbortSignal;
      return new Promise<Response>((complete) => {
        resolve = complete;
      });
    }),
  );
  const view = render(
    <AgentDevices devices={[]} revision={0} busy={false} onIssue={vi.fn()} />,
  );
  view.unmount();
  expect(signal.aborted).toBe(true);
  await act(async () => resolve(await response({ devices: [device] })));
  expect(screen.queryByText(device.label)).not.toBeInTheDocument();
});
