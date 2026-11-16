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
