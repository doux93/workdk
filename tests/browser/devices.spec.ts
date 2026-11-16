import { test, expect } from "@playwright/test";
import { initialWorkspace } from "../../src/workspace";

test("为独立电脑下载配置、停用并重新签发", async ({ page }) => {
  await page.addInitScript(
    (workspace) =>
      localStorage.setItem("yiyu-workspace-v1", JSON.stringify(workspace)),
    initialWorkspace(),
  );
  let registered = false,
    revoked = false;
  const issued: unknown[] = [];
  await page.route(/\/api\/agent-sessions\?/, (route) =>
    route.fulfill({ json: { sessions: [], devices: [], hasMore: false } }),
  );
  await page.route("**/api/agent-devices", async (route) => {
    if (route.request().method() === "PATCH") {
      expect(route.request().postDataJSON()).toEqual({
        device: "fixture-device",
      });
      revoked = true;
      await route.fulfill({ json: { ok: true } });
      return;
    }
    await route.fulfill({
      json: {
        devices: registered
          ? [
              {
                device: "fixture-device",
                label: "办公室电脑",
                created_at: "2026-11-16T00:00:00Z",
                revoked_at: revoked ? "2026-11-16T01:00:00Z" : null,
              },
            ]
          : [],
      },
    });
  });
  await page.route("**/api/agent-setup", async (route) => {
    expect(route.request().method()).toBe("POST");
    issued.push(route.request().postDataJSON());
    registered = true;
    revoked = false;
    await route.fulfill({
      json: {
        version: 2,
        device: "fixture-device",
        token: "synthetic-test-only",
        url: "https://example.com",
        projects: [],
      },
    });
  });
  await page.goto("/#agents");
  await page.getByRole("button", { name: "开始连接" }).click();
  await page.getByRole("textbox", { name: "电脑名称" }).fill("办公室电脑");
  const firstDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载连接配置" }).click();
  expect((await firstDownload).suggestedFilename()).toBe(
    "workdk-agent.config.json",
  );
  await expect(page.getByText("办公室电脑", { exact: true })).toBeVisible();
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "停用设备" }).click();
  expect(revoked).toBe(false);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "停用设备" }).click();
  await expect(page.getByText("已停用", { exact: true })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  const renewedDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "重新签发配置" }).click();
  await renewedDownload;
  await expect(page.getByText("已授权", { exact: true })).toBeVisible();
  expect(issued).toEqual([
    { label: "办公室电脑" },
    { label: "办公室电脑", device: "fixture-device" },
  ]);
});
