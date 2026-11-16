import { test, expect } from "@playwright/test";
import { initialWorkspace } from "../../src/workspace";

test("真实 HTTP/SQLite：两个浏览器接续、旧版本冲突与来源关联", async ({
  browser,
}) => {
  const a = await browser.newContext({ baseURL: "http://127.0.0.1:5173" });
  const b = await browser.newContext({ baseURL: "http://127.0.0.1:5173" });
  try {
    const seed = initialWorkspace();
    seed.modules.forEach((m) => (m.entries = []));
    seed.example = false;
    for (const context of [a, b])
      await context.addInitScript((workspace) => {
        if (!localStorage.getItem("yiyu-workspace-v1"))
          localStorage.setItem("yiyu-workspace-v1", JSON.stringify(workspace));
      }, seed);
    const first = await a.newPage();
    const second = await b.newPage();
    const event = {
      id: "browser-live-event",
      device: "browser-qa",
      source: "codex",
      project: "隔离验收项目",
      session: "browser-live-session",
      kind: "stop",
      at: new Date().toISOString(),
      summary: "真实服务链路验收",
      evidence: "合成 Hook；真实数据库、HTTP 与浏览器",
    };
    const inserted = await first.request.post("/api/agent-events", {
      data: { events: [event] },
    });
    expect(inserted.status()).toBe(200);
    await first.goto("/#agents");
    await first.getByRole("button", { name: /真实服务链路验收/ }).click();
    await expect(
      first.getByText("合成 Hook；真实数据库、HTTP 与浏览器", { exact: true }),
    ).toBeVisible();
    await first.getByLabel("添加到待办模块").selectOption("tasks");
    await first.getByRole("button", { name: "添加待办", exact: true }).click();
    await first
      .getByRole("region", { name: "关联待办" })
      .getByRole("button", { name: "真实服务链路验收" })
      .click();
    await first.goto("/#settings");
    const panelA = first.getByRole("region", { name: "跨设备接续" });
    await panelA.getByRole("button", { name: "查看云端版本" }).click();
    await expect(panelA).toContainText("云端尚无快照");
    await panelA.getByRole("button", { name: "将本机保存到云端" }).click();
    await first.getByRole("button", { name: "确认保存快照" }).click();
    await expect(panelA).toContainText("云端快照 v1 已保存");
    await second.goto("/#settings");
    const panelB = second.getByRole("region", { name: "跨设备接续" });
    await panelB.getByRole("button", { name: "查看云端版本" }).click();
    await panelB.getByRole("button", { name: "将此快照载入本机" }).click();
    await second.getByRole("button", { name: "确认载入快照" }).click();
    await expect(
      second.getByRole("status", { name: "数据保存状态" }),
    ).toContainText("已保存");
    await expect(
      second.getByRole("button", { name: "下载替换前副本" }),
    ).toBeVisible();
    await second.goto("/#home");
    await second
      .getByRole("region", { name: "今日聚焦" })
      .getByRole("button", { name: /^真实服务链路验收/ })
      .click();
    await second.getByRole("button", { name: "查看来源会话" }).click();
    await expect(
      second.getByText("合成 Hook；真实数据库、HTTP 与浏览器", { exact: true }),
    ).toBeVisible();
    await second.goto("/#settings");
    await panelB.getByRole("button", { name: "查看云端版本" }).click();
    await second
      .getByRole("textbox", { name: "空间名称" })
      .fill("第二台的更新");
    await second.getByRole("button", { name: "保存", exact: true }).click();
    await panelB.getByRole("button", { name: "将本机保存到云端" }).click();
    await second.getByRole("button", { name: "确认保存快照" }).click();
    await expect(panelB).toContainText("云端快照 v2 已保存");
    await first
      .getByRole("textbox", { name: "空间名称" })
      .fill("第一台尚未上传");
    await first.getByRole("button", { name: "保存", exact: true }).click();
    await panelA.getByRole("button", { name: "将本机保存到云端" }).click();
    await first.getByRole("button", { name: "确认保存快照" }).click();
    await expect(panelA.getByRole("alert")).toContainText("云端已有更新");
    await expect(first.getByRole("textbox", { name: "空间名称" })).toHaveValue(
      "第一台尚未上传",
    );
    const remote = await (
      await first.request.get("/api/workspace-snapshot")
    ).json();
    expect(remote.workspace.name).toBe("第二台的更新");
    await first.reload();
    await expect(first.getByRole("textbox", { name: "空间名称" })).toHaveValue(
      "第一台尚未上传",
    );
  } finally {
    await a.close();
    await b.close();
  }
});

test("新用户首页保持紧凑，可展开全部模块并在刷新后保留偏好", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#home");
  await expect(
    page.getByText("从今天的一件事开始", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".dashboard-secondary")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "记下今天的一件事" }),
  ).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("focused-onboarding.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: /展开全部模块与辅助卡片/ }).click();
  await expect(page.locator(".dashboard-secondary")).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "收起辅助卡片" }),
  ).toBeVisible();
});
