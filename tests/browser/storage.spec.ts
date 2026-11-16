import { test, expect } from "@playwright/test";
import { initialWorkspace } from "../../src/workspace";

test("保存失败阻止离开，恢复存储后可直接重试", async ({ page }) => {
  await page.addInitScript((workspace) => {
    localStorage.setItem("yiyu-workspace-v1", JSON.stringify(workspace));
    Reflect.set(window, "__testStorageBlocked", true);
    const write = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (
        key === "yiyu-workspace-v1" &&
        Reflect.get(window, "__testStorageBlocked")
      ) {
        throw new DOMException("Storage full", "QuotaExceededError");
      }
      return write.call(this, key, value);
    };
  }, initialWorkspace());
  await page.goto("/#settings");
  await page.getByRole("button", { name: "午后暖沙" }).click();
  await expect(page.getByRole("alert")).toContainText("当前内容尚未保存");
  const dialogEvent = page.waitForEvent("dialog");
  // A dismissed reload never commits navigation; do not wait for a load event.
  await page.evaluate(() => {
    setTimeout(() => location.reload(), 0);
  });
  const warning = await dialogEvent;
  expect(warning.type()).toBe("beforeunload");
  await warning.dismiss();
  await expect(page.getByRole("button", { name: "午后暖沙" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.evaluate(() => {
    Reflect.set(window, "__testStorageBlocked", false);
  });
  await page.getByRole("button", { name: "重试保存" }).click();
  await expect(
    page.getByRole("status", { name: "数据保存状态" }),
  ).toContainText("已保存");
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("yiyu-workspace-v1")!).theme,
    ),
  ).toBe("sand");
});

test("两个真实标签页之间的更新保留本页内容，确认后才载入新版本", async ({
  page,
  context,
}) => {
  await page.addInitScript((workspace) => {
    localStorage.setItem("yiyu-workspace-v1", JSON.stringify(workspace));
  }, initialWorkspace());
  await page.goto("/#settings");
  await page.getByRole("button", { name: "午后暖沙" }).click();
  await expect(
    page.getByRole("status", { name: "数据保存状态" }),
  ).toContainText("已保存");
  const other = await context.newPage();
  await other.goto("/#settings");
  await other.getByRole("button", { name: "静谧深夜" }).click();
  await expect(page.getByRole("alert")).toContainText("当前窗口已暂停保存");
  await expect(page.getByRole("button", { name: "午后暖沙" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("yiyu-workspace-v1")!).theme,
    ),
  ).toBe("dark");
  await page.getByRole("button", { name: "载入最新内容" }).click();
  await page.getByRole("button", { name: "确认操作" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(
    page.getByRole("status", { name: "数据保存状态" }),
  ).toContainText("已保存");
});
