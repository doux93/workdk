import React from "react";
import { it, expect, vi } from "vitest";
import {
  act,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App";
import { initialWorkspace } from "../../src/workspace";
import { useWorkspaceStorage } from "../../src/hooks/useWorkspaceStorage";

const key = "yiyu-workspace-v1";
const leavingIsBlocked = () => {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
};

it("保存失败保留内容并保护离开页面，直接重试成功后解除保护", async () => {
  const user = userEvent.setup();
  const write = vi
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(() => {
      throw new DOMException("Storage full", "QuotaExceededError");
    });
  render(<App />);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "当前内容尚未保存",
  );
  expect(leavingIsBlocked()).toBe(true);
  const title = screen.getByRole("heading", { level: 1 }).textContent;
  write.mockRestore();
  await user.click(screen.getByRole("button", { name: "重试保存" }));
  await waitFor(() =>
    expect(
      screen.getByRole("status", { name: "数据保存状态" }),
    ).toHaveTextContent("已保存"),
  );
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(title!);
  expect(JSON.parse(localStorage.getItem(key)!).modules.length).toBeGreaterThan(
    0,
  );
  expect(leavingIsBlocked()).toBe(false);
});

it("保存重试重新比较磁盘版本，不覆盖重试前其他窗口写入的内容", async () => {
  localStorage.setItem(key, JSON.stringify(initialWorkspace()));
  const { result } = renderHook(() => useWorkspaceStorage());
  await waitFor(() => expect(result.current.saveState).toBe("已保存"));
  const write = vi
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(() => {
      throw new Error("full");
    });
  act(() =>
    result.current.setData((old) => ({ ...old!, name: "本页尚未保存" })),
  );
  await waitFor(() => expect(result.current.saveError).not.toBe(""));
  write.mockRestore();
  const external = JSON.stringify({
    ...initialWorkspace(),
    name: "其他窗口内容",
  });
  // No storage event: the retry itself must perform the comparison.
  localStorage.setItem(key, external);
  act(() => result.current.retry());
  expect(result.current.storageConflict).not.toBeNull();
  expect(result.current.data?.name).toBe("本页尚未保存");
  expect(localStorage.getItem(key)).toBe(external);
  expect(leavingIsBlocked()).toBe(true);
  act(() => {
    result.current.reload();
  });
  await waitFor(() => expect(result.current.saveState).toBe("已保存"));
  expect(result.current.data?.name).toBe("其他窗口内容");
  expect(leavingIsBlocked()).toBe(false);
});

it("无法读取的备份在重试时仍原样保留，明确恢复有效备份后才解除保护", async () => {
  const invalid = '{"interrupted":';
  localStorage.setItem(key, invalid);
  const { result } = renderHook(() => useWorkspaceStorage());
  expect(result.current.recoveryRaw).toBe(invalid);
  act(() => result.current.retry());
  expect(localStorage.getItem(key)).toBe(invalid);
  expect(leavingIsBlocked()).toBe(true);
  const recovered = { ...initialWorkspace(), name: "从备份恢复" };
  act(() => result.current.restore(recovered));
  await waitFor(() => expect(result.current.saveState).toBe("已保存"));
  expect(JSON.parse(localStorage.getItem(key)!)).toEqual(recovered);
  expect(result.current.recoveryRaw).toBeNull();
  expect(leavingIsBlocked()).toBe(false);
});

it("存储读取被拒绝时不会崩溃，权限恢复后重试仍保护原有内容", async () => {
  const external = JSON.stringify({
    ...initialWorkspace(),
    name: "浏览器原有内容",
  });
  localStorage.setItem(key, external);
  const read = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new DOMException("Denied", "SecurityError");
  });
  const { result } = renderHook(() => useWorkspaceStorage());
  expect(result.current.saveState).toBe("未保存");
  expect(leavingIsBlocked()).toBe(true);
  read.mockRestore();
  act(() => result.current.retry());
  expect(result.current.storageConflict).not.toBeNull();
  expect(localStorage.getItem(key)).toBe(external);
});

it("恢复备份前保留被替换的内容，容量不足时拒绝替换", async () => {
  const before = { ...initialWorkspace(), name: "本机原稿" };
  localStorage.setItem(key, JSON.stringify(before));
  const { result } = renderHook(() => useWorkspaceStorage());
  await waitFor(() => expect(result.current.saveState).toBe("已保存"));
  const write = vi
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
  expect(() =>
    act(() => {
      result.current.restore({ ...before, name: "远端稿" });
    }),
  ).toThrow("无法保留替换前");
  expect(result.current.data?.name).toBe("本机原稿");
  write.mockRestore();
  act(() => {
    expect(result.current.restore({ ...before, name: "远端稿" })).toBe(true);
  });
  await waitFor(() => expect(result.current.saveState).toBe("已保存"));
  const recovery = JSON.parse(
    localStorage.getItem("yiyu-workspace-recovery-v1")!,
  );
  expect(JSON.parse(recovery.raw).name).toBe("本机原稿");
  expect(result.current.data?.name).toBe("远端稿");
});
it("确认导入前其他窗口修改数据时，不覆盖对方也不替换本页", async () => {
  const before = initialWorkspace();
  localStorage.setItem(key, JSON.stringify(before));
  const { result } = renderHook(() => useWorkspaceStorage());
  await waitFor(() => expect(result.current.saveState).toBe("已保存"));
  const external = { ...before, name: "另一窗口" };
  localStorage.setItem(key, JSON.stringify(external));
  act(() => {
    expect(result.current.restore({ ...before, name: "导入稿" })).toBe(false);
  });
  expect(result.current.data?.name).toBe(before.name);
  expect(result.current.storageConflict).not.toBeNull();
  expect(JSON.parse(localStorage.getItem(key)!).name).toBe("另一窗口");
});
