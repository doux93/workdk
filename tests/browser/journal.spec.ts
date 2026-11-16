import { test, expect } from "@playwright/test";
import { initialWorkspace } from "../../src/workspace";

// Synthetic fixtures only; screenshots never depend on a private service or account.
const at = "2026-11-16T01:20:00.000Z";
const sessions = [
  {
    id: "one",
    device: "test-device",
    session: "one",
    source: "codex",
    project: "workdk",
    started: at,
    updated: at,
    state: "stop",
    count: 12,
    summary: "修复保存流程与上传队列\n已完成本地验证，下一步检查在线环境。",
  },
  {
    id: "two",
    device: "test-device",
    session: "two",
    source: "claude",
    project: "个人工作台",
    started: at,
    updated: at,
    state: "error",
    count: 8,
    summary: "完善移动端导航体验\n构建遇到错误，需要继续检查依赖配置。",
  },
];
for (const theme of ["light", "sand", "dark"] as const) {
  for (const width of [1440, 390]) {
    test(`${theme} theme at ${width}px: journal, detail and connection`, async ({
      page,
    }, info) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await page.addInitScript(
        (workspace) => {
          localStorage.setItem("yiyu-workspace-v1", JSON.stringify(workspace));
        },
        { ...initialWorkspace(), theme },
      );
      await page.route(/\/api\/agent-sessions\?/, (route) =>
        route.fulfill({
          json: {
            sessions,
            devices: [{ device: "test-device", count: 20, lastSync: at }],
            hasMore: false,
          },
        }),
      );
      await page.route(/\/api\/agent-session\?/, (route) =>
        route.fulfill({
          json: {
            events: [
              {
                id: "e1",
                kind: "stop",
                at,
                received_at: at,
                summary: "已修复上传分批并通过回归测试。",
                evidence: "",
              },
              {
                id: "e2",
                kind: "tool",
                at,
                received_at: at,
                summary: "",
                evidence: "Bash · exit 0",
              },
            ],
            next: null,
            hasMore: false,
          },
        }),
      );
      await page.goto("/#agents");
      await expect(
        page.getByRole("heading", { name: "修复保存流程与上传队列" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "导出当前记录" }),
      ).toBeEnabled();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: info.outputPath("journal.png"),
        fullPage: true,
      });
      await page
        .getByRole("button", { name: /修复保存流程与上传队列/ })
        .click();
      await expect(page.getByText("Bash · exit 0")).toBeVisible();
      await expect(page.getByRole("dialog")).toContainText("本轮结束 · 待验证");
      const bounds = await page.getByRole("dialog").boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
      await page.screenshot({
        path: info.outputPath("detail.png"),
        fullPage: true,
      });
      // Padding belongs to the dialog, not to its backdrop. Also protect text drags.
      await page.getByRole("dialog").evaluate((el) => {
        el.style.padding = "12px";
      });
      const padded = (await page.getByRole("dialog").boundingBox())!;
      const inside = { x: padded.x + padded.width / 2, y: padded.y + 4 };
      await page.mouse.click(inside.x, inside.y);
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.mouse.move(inside.x, inside.y);
      await page.mouse.down();
      await page.mouse.move(4, 4);
      await page.mouse.up();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: /修复保存流程与上传队列/ }),
      ).toBeFocused();
      await page.getByRole("button", { name: "连接电脑", exact: true }).click();
      await expect(page.getByRole("dialog")).toContainText("允许采集的项目");
      await expect(
        page.getByRole("link", { name: "下载采集器" }),
      ).toBeVisible();
      await page.mouse.click(4, 4);
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "连接电脑", exact: true }),
      ).toBeFocused();
      expect(errors).toEqual([]);
    });
  }
}
