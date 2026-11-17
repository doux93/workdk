import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("生产构建：文件备份往返、损坏文件拒绝与替换前副本", async ({
  page,
}, info) => {
  await page.goto("/#home");
  await page
    .getByRole("button", { name: "记下今天的一件事", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "记下什么？" })
    .fill("浏览器备份实测 — 中文 ✅");
  await page.getByRole("button", { name: "保存记录", exact: true }).click();
  await expect(
    page.getByRole("status", { name: "数据保存状态" }),
  ).toContainText("已保存");
  await page.getByRole("button", { name: "打开个人偏好", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出完整备份", exact: true }).click();
  const backupPath = info.outputPath("workspace.json");
  await (await download).saveAs(backupPath);
  const original = JSON.parse(await readFile(backupPath, "utf8"));
  expect(
    original.modules
      .flatMap((m: { entries: { title: string }[] }) => m.entries)
      .some((e: { title: string }) => e.title === "浏览器备份实测 — 中文 ✅"),
  ).toBe(true);

  await page
    .getByRole("textbox", { name: "空间名称" })
    .fill("恢复前的本机内容");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(
    page.getByRole("status", { name: "数据保存状态" }),
  ).toContainText("已保存");
  const input = page.locator('input[type="file"]');
  await input.setInputFiles({
    name: "broken.json",
    mimeType: "application/json",
    buffer: Buffer.from("{broken-json"),
  });
  await expect(
    page.getByText("无法读取此备份，请选择一隅工作台导出的 JSON 文件。", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: "空间名称" })).toHaveValue(
    "恢复前的本机内容",
  );
  await input.setInputFiles(backupPath);
  await page.getByRole("button", { name: "确认操作", exact: true }).click();
  await expect(page.getByRole("region", { name: "今日聚焦" })).toContainText(
    "浏览器备份实测 — 中文 ✅",
  );
  await page.getByRole("button", { name: "打开个人偏好", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "空间名称" })).toHaveValue(
    original.name,
  );
  const recovery = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "下载替换前副本", exact: true })
    .click();
  const recoveryPath = info.outputPath("recovery.json");
  await (await recovery).saveAs(recoveryPath);
  expect(JSON.parse(await readFile(recoveryPath, "utf8"))).toEqual({
    ...original,
    name: "恢复前的本机内容",
  });
});
