import { test, expect } from "@playwright/test";
import {
  initialWorkspace,
  blankEntry,
  createModuleFromLearningPreset,
} from "../../src/workspace";

for (const theme of ["light", "sand", "dark"] as const) {
  for (const width of [1440, 390]) {
    test(`${theme} ${width}px: today focus and quick capture`, async ({
      page,
    }, info) => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await page.addInitScript(
        ({ workspace }) => {
          if (localStorage.getItem("yiyu-workspace-v1")) return;
          const now = new Date();
          const date = (d: Date) =>
            `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          workspace.modules.forEach((m) =>
            m.entries.forEach((e) => (e.date = date(now))),
          );
          const yesterday = new Date(now);
          yesterday.setDate(yesterday.getDate() - 1);
          workspace.modules[0].entries[1].date = date(yesterday);
          localStorage.setItem("yiyu-workspace-v1", JSON.stringify(workspace));
        },
        {
          workspace: (() => {
            const d = initialWorkspace();
            d.theme = theme;
            d.modules.forEach((m) => (m.entries = []));
            d.modules[0].entries = [
              {
                ...blankEntry(),
                title: "核对发布结果",
                priority: "重要",
                sample: false,
              },
              { ...blankEntry(), title: "补充昨天的验收记录", sample: false },
            ];
            d.modules[1].entries = [
              { ...blankEntry(), title: "整理下一个迭代计划", sample: false },
            ];
            const words = createModuleFromLearningPreset("vocabulary");
            words.entries[0].sample = false;
            words.entries[0].title = "学习内容不混入任务";
            d.modules.push(words);
            return d;
          })(),
        },
      );
      await page.route(/\/api\/agent-sessions\?/, (route) =>
        route.fulfill({ json: { sessions: [], devices: [], hasMore: false } }),
      );
      await page.goto("/#home");
      const focus = page.getByRole("region", { name: "今日聚焦" });
      await expect(focus).toContainText("核对发布结果");
      await expect(focus).toContainText("整理下一个迭代计划");
      await expect(focus).not.toContainText("补充昨天的验收记录");
      await expect(focus).not.toContainText("学习内容不混入任务");
      await expect(
        page.getByRole("button", { name: "快速记录", exact: true }),
      ).toBeInViewport();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: info.outputPath("today.png"),
        fullPage: true,
      });
      await focus.getByRole("button", { name: /逾期/ }).click();
      await expect(focus).toContainText("补充昨天的验收记录");
      await page.getByRole("button", { name: "快速记录", exact: true }).click();
      await page
        .getByRole("textbox", { name: "记下什么？" })
        .fill("开始一件新的事");
      await page.screenshot({
        path: info.outputPath("capture.png"),
        fullPage: true,
      });
      await page.getByRole("button", { name: "保存记录" }).click();
      await focus.getByRole("button", { name: /^今天/ }).click();
      await expect(focus).toContainText("开始一件新的事");
      await expect(
        page.getByRole("status", { name: "数据保存状态" }),
      ).toContainText("已保存");
      await page.reload();
      await expect(
        page.getByRole("region", { name: "今日聚焦" }),
      ).toContainText("开始一件新的事");
    });
  }
}

test("任务与来源双向定位，刷新直达及浏览器返回均保留关联", async ({ page }) => {
  const session = {
    id: '["d","codex","研发/100%+?","p"]',
    device: "d",
    source: "codex",
    project: "项目",
    session: "s",
    started: "2026-11-16T01:00:00Z",
    updated: "2026-11-16T02:00:00Z",
    state: "stop",
    count: 1,
    summary: "检查这轮工作成果",
  };
  await page.addInitScript((workspace) => {
    if (!localStorage.getItem("yiyu-workspace-v1"))
      localStorage.setItem("yiyu-workspace-v1", JSON.stringify(workspace));
  }, initialWorkspace());
  await page.route(/\/api\/agent-sessions\?/, (route) =>
    route.fulfill({
      json: { sessions: [session], devices: [], hasMore: false },
    }),
  );
  await page.route(/\/api\/agent-session\?/, (route) => {
    expect(new URL(route.request().url()).searchParams.get("id")).toBe(
      session.id,
    );
    return route.fulfill({
      json: {
        session,
        events: [
          {
            id: "e",
            kind: "stop",
            summary: "原始依据",
            evidence: "",
            at: session.updated,
            received_at: session.updated,
          },
        ],
        next: null,
        hasMore: false,
      },
    });
  });
  await page.goto("/#agents");
  await page.getByRole("button", { name: /检查这轮工作成果/ }).click();
  await expect(page).toHaveURL(new RegExp("#agents\\?session="));
  await expect(page.getByText("原始依据", { exact: true })).toBeVisible();
  await page.getByLabel("添加到待办模块").selectOption("tasks");
  await page.getByRole("button", { name: "添加待办", exact: true }).click();
  await page
    .getByRole("region", { name: "关联待办" })
    .getByRole("button", { name: "检查这轮工作成果" })
    .click();
  const taskUrl = page.url();
  await page.getByRole("button", { name: "查看来源会话" }).click();
  await expect(page.getByRole("region", { name: "关联待办" })).toContainText(
    "检查这轮工作成果",
  );
  await expect(
    page.getByRole("button", { name: "添加待办", exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("region", { name: "关联待办" })).toContainText(
    "检查这轮工作成果",
  );
  await page.goBack();
  await expect(page).toHaveURL(taskUrl);
  await expect(
    page.getByRole("button", { name: "查看来源会话" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      (id) =>
        JSON.parse(localStorage.getItem("yiyu-workspace-v1")!)
          .modules.flatMap(
            (m: { entries: Array<{ agentSessionId?: string }> }) => m.entries,
          )
          .filter((e: { agentSessionId?: string }) => e.agentSessionId === id)
          .length,
      session.id,
    ),
  ).toBe(1);
});
