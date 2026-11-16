import React from "react";
import { it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SnapshotPanel from "../../src/components/SnapshotPanel";
import { initialWorkspace } from "../../src/workspace";
const empty = { revision: 0, updatedAt: null, workspace: null, history: [] };
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
it("云端接续需主动读取和确认，取消不会上传", async () => {
  const user = userEvent.setup();
  const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(json(empty));
  const data = initialWorkspace();
  render(
    <SnapshotPanel
      workspace={data}
      canTransfer
      onRestore={vi.fn()}
      onExport={vi.fn()}
    />,
  );
  expect(fetcher).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "查看云端版本" }));
  await screen.findByText(/云端尚无快照/);
  await user.click(screen.getByRole("button", { name: "将本机保存到云端" }));
  await user.click(screen.getByRole("button", { name: "取消" }));
  expect(fetcher).toHaveBeenCalledTimes(1);
  fetcher.mockResolvedValueOnce(
    json({ revision: 1, updatedAt: "2026-11-16T00:00:00Z" }),
  );
  await user.click(screen.getByRole("button", { name: "将本机保存到云端" }));
  await user.click(screen.getByRole("button", { name: "确认保存快照" }));
  await screen.findByText(/云端快照 v1 已保存/);
  const request = fetcher.mock.calls[1][1]!;
  expect(request.method).toBe("PUT");
  expect(JSON.parse(request.body as string)).toEqual({
    baseRevision: 0,
    workspace: data,
  });
});
it("云端冲突保留本机数据并要求重新查看版本", async () => {
  const user = userEvent.setup();
  const restore = vi.fn();
  const data = initialWorkspace();
  const fetcher = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(json(empty))
    .mockResolvedValueOnce(
      json({ error: "云端已有更新，未覆盖任何内容。" }, 409),
    );
  render(
    <SnapshotPanel
      workspace={data}
      canTransfer
      onRestore={restore}
      onExport={vi.fn()}
    />,
  );
  await user.click(screen.getByRole("button", { name: "查看云端版本" }));
  await screen.findByText(/云端尚无快照/);
  await user.click(screen.getByRole("button", { name: "将本机保存到云端" }));
  await user.click(screen.getByRole("button", { name: "确认保存快照" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("云端已有更新");
  expect(restore).not.toHaveBeenCalled();
  expect(
    screen.queryByRole("button", { name: "将本机保存到云端" }),
  ).not.toBeInTheDocument();
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it("载入快照需确认；本机在确认前改变时拒绝替换", async () => {
  const user = userEvent.setup();
  const restore = vi.fn().mockReturnValue(true);
  const data = initialWorkspace();
  const remote = { ...data, name: "另一台" };
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    json({
      revision: 2,
      workspace: remote,
      updatedAt: "2026-11-16",
      history: [{ revision: 2, updatedAt: "2026-11-16" }],
    }),
  );
  const view = render(
    <SnapshotPanel
      workspace={data}
      canTransfer
      onRestore={restore}
      onExport={vi.fn()}
    />,
  );
  await user.click(screen.getByRole("button", { name: "查看云端版本" }));
  await screen.findByText(/云端版本已读取/);
  await user.click(screen.getByRole("button", { name: "将此快照载入本机" }));
  expect(restore).not.toHaveBeenCalled();
  view.rerender(
    <SnapshotPanel
      workspace={{ ...data, name: "新编辑" }}
      canTransfer
      onRestore={restore}
      onExport={vi.fn()}
    />,
  );
  await user.click(screen.getByRole("button", { name: "确认载入快照" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "本机内容或保存状态已变化",
  );
  expect(restore).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "将此快照载入本机" }));
  await user.click(screen.getByRole("button", { name: "确认载入快照" }));
  expect(restore).toHaveBeenCalledWith(remote);
});
it("无效响应不能作为快照载入；本机未保存时禁止上传", async () => {
  const user = userEvent.setup();
  vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      json({ revision: 1, workspace: { bad: true }, history: [] }),
    )
    .mockResolvedValueOnce(json(empty));
  render(
    <SnapshotPanel
      workspace={initialWorkspace()}
      canTransfer={false}
      onRestore={vi.fn()}
      onExport={vi.fn()}
    />,
  );
  await user.click(screen.getByRole("button", { name: "查看云端版本" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("格式异常");
  await user.click(screen.getByRole("button", { name: "查看云端版本" }));
  expect(
    await screen.findByRole("button", { name: "将本机保存到云端" }),
  ).toBeDisabled();
});
it("离开设置页终止请求，迟到响应不会应用远端内容", async () => {
  let resolve!: (response: Response) => void;
  const fetcher = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(() => new Promise((r) => (resolve = r)));
  const restore = vi.fn();
  const user = userEvent.setup();
  const view = render(
    <SnapshotPanel
      workspace={initialWorkspace()}
      canTransfer
      onRestore={restore}
      onExport={vi.fn()}
    />,
  );
  await user.click(screen.getByRole("button", { name: "查看云端版本" }));
  const signal = fetcher.mock.calls[0][1]!.signal!;
  view.unmount();
  expect(signal.aborted).toBe(true);
  resolve(json(empty));
  await waitFor(() => expect(restore).not.toHaveBeenCalled());
});
