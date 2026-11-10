import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, act, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App";
import ModuleContent from "../../src/components/ModuleContent";
import SearchDialog from "../../src/components/SearchDialog";
import { createLargeWorkspace } from "../fixtures.mjs";
import { dateKey } from "../../src/workspace";
const callbacks = () => ({
  open: vi.fn(),
  edit: vi.fn(),
  add: vi.fn(),
  setStatus: vi.fn(),
  setMonth: vi.fn(),
  setSelected: vi.fn(),
  month: new Date(),
  selected: dateKey(),
});
describe("真实页面流程与大数据展示限制", () => {
  it("关闭全局搜索后保留模块内的关键词和结果", async () => {
    const user = userEvent.setup(),
      data = createLargeWorkspace(5);
    localStorage.setItem("yiyu-workspace-v1", JSON.stringify(data));
    history.replaceState(null, "", "/#modules/load-module");
    render(<App />);
    const filter = await screen.findByRole("textbox", { name: "搜索此模块" });
    await user.type(filter, "单词 1");
    await user.click(screen.getByRole("button", { name: "搜索工作空间" }));
    await user.type(
      screen.getByRole("textbox", { name: "全局搜索" }),
      "另一个关键词",
    );
    await user.click(screen.getByRole("button", { name: "关闭弹窗" }));
    expect(filter).toHaveValue("单词 1");
    expect(
      screen.getByRole("button", { name: "单词 1", exact: true }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "单词 2", exact: true }),
    ).not.toBeInTheDocument();
  });
  it("外部窗口更新后暂停保存，载入最新版本后显示最新内容", async () => {
    const user = userEvent.setup(),
      data = createLargeWorkspace(2);
    localStorage.setItem("yiyu-workspace-v1", JSON.stringify(data));
    render(<App />);
    await screen.findByRole("heading", { name: /我的工作台/ });
    const latest = { ...data, name: "另一窗口保存的名称" };
    const raw = JSON.stringify(latest);
    act(() => {
      localStorage.setItem("yiyu-workspace-v1", raw);
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "yiyu-workspace-v1",
          newValue: raw,
          storageArea: localStorage,
        }),
      );
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("暂停保存");
    await user.click(screen.getByRole("button", { name: "载入最新内容" }));
    await user.click(screen.getByRole("button", { name: "确认操作" }));
    expect(
      await screen.findByRole("heading", { name: /另一窗口保存的名称/ }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole("status", { name: "数据保存状态" }),
      ).toHaveTextContent("已保存"),
    );
  });
  it("一千条记录只渲染当前页，翻页和搜索可以找到后面的记录", async () => {
    const user = userEvent.setup(),
      module = createLargeWorkspace(1000).modules[0];
    const props = { ...callbacks(), module, entries: module.entries };
    const { rerender } = render(<ModuleContent {...props} />);
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(
      51,
    );
    expect(screen.getByText("共 1000 条 · 每页 50 条")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "下一页" }));
    expect(
      screen.getByRole("button", { name: "单词 50", exact: true }),
    ).toBeInTheDocument();
    rerender(<ModuleContent {...props} query="benchmark-value-999。" />);
    await waitFor(() =>
      expect(
        within(screen.getByRole("table")).getAllByRole("row"),
      ).toHaveLength(2),
    );
    expect(
      screen.getByRole("button", { name: "单词 999", exact: true }),
    ).toBeInTheDocument();
  });
  it("看板分批显示，不会一次创建全部卡片", async () => {
    const user = userEvent.setup(),
      module = createLargeWorkspace(200).modules[0];
    module.view = "board";
    const { container } = render(
      <ModuleContent
        {...callbacks()}
        module={module}
        entries={module.entries}
      />,
    );
    expect(container.querySelectorAll(".board-card")).toHaveLength(30);
    await user.click(
      screen.getByRole("button", { name: "再显示 30 条待开始内容" }),
    );
    expect(container.querySelectorAll(".board-card")).toHaveLength(60);
  });
  it("全局搜索结果有上限，同时仍能定位到最后一条匹配记录", async () => {
    const user = userEvent.setup(),
      modules = createLargeWorkspace(1000).modules;
    const { container } = render(
      <SearchDialog modules={modules} onClose={vi.fn()} navigate={vi.fn()} />,
    );
    await user.type(screen.getByRole("textbox", { name: "全局搜索" }), "单词");
    expect(container.querySelectorAll(".search-results button")).toHaveLength(
      31,
    );
    expect(screen.getByText(/先显示 30 条/)).toBeInTheDocument();
    await user.clear(screen.getByRole("textbox", { name: "全局搜索" }));
    await user.type(
      screen.getByRole("textbox", { name: "全局搜索" }),
      "benchmark-value-999。",
    );
    expect(container.querySelectorAll(".search-results button")).toHaveLength(
      1,
    );
    expect(screen.getByText("单词 999")).toBeInTheDocument();
  });
});

it("同一天安排很多记录时也分批显示", async () => {
  const user = userEvent.setup(),
    module = createLargeWorkspace(200).modules[0];
  module.view = "calendar";
  const { container } = render(
    <ModuleContent {...callbacks()} module={module} entries={module.entries} />,
  );
  expect(container.querySelectorAll(".day-event")).toHaveLength(50);
  await user.click(screen.getByRole("button", { name: "再显示 50 条安排" }));
  expect(container.querySelectorAll(".day-event")).toHaveLength(100);
});
