import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RecordEditor from "../../src/components/RecordEditor";
import ModuleEditor from "../../src/components/ModuleEditor";
import { FieldValue } from "../../src/components/Fields";
import {
  blankEntry,
  createModuleFromLearningPreset,
  type Module,
} from "../../src/workspace";

function mixedModule(): Module {
  const module = createModuleFromLearningPreset("vocabulary");
  module.fields = ["学习时长（分钟）", "熟悉程度", "材料链接"];
  delete module.fieldConfig;
  return module;
}
describe("学习字段输入与旧内容保留", () => {
  it("数字、选项、链接分别使用正确控件，提交后仍兼容原有字符串数据", async () => {
    const user = userEvent.setup(),
      onSave = vi.fn(),
      module = mixedModule();
    render(
      <RecordEditor
        module={module}
        entry={blankEntry()}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    );
    await user.type(
      screen.getByRole("textbox", { name: /标题/ }),
      "今天的英语",
    );
    const duration = screen.getByRole("spinbutton", { name: /学习时长/ });
    expect(duration).toHaveAttribute("min", "0");
    expect(duration).toHaveAttribute("max", "1440");
    await user.type(duration, "25");
    await user.selectOptions(
      screen.getByRole("combobox", { name: "熟悉程度" }),
      "基本掌握",
    );
    const url = screen.getByRole("textbox", { name: "材料链接" });
    expect(url).toHaveAttribute("type", "url");
    await user.type(url, "https://example.com/lesson");
    await user.click(screen.getByRole("button", { name: "保存内容" }));
    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave.mock.calls[0][0].values).toEqual({
      "学习时长（分钟）": "25",
      熟悉程度: "基本掌握",
      材料链接: "https://example.com/lesson",
    });
  });
  it("旧备份中的自由文本不会因编辑其他内容而被清空", async () => {
    const user = userEvent.setup(),
      onSave = vi.fn(),
      module = mixedModule();
    const entry = {
      ...blankEntry(),
      title: "旧记录",
      values: {
        "学习时长（分钟）": "二十分钟",
        熟悉程度: "自己定义的等级",
        材料链接: "原来的材料地址",
      },
    };
    render(
      <RecordEditor
        module={module}
        entry={entry}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    );
    expect(screen.getByRole("textbox", { name: /学习时长/ })).toHaveValue(
      "二十分钟",
    );
    expect(screen.getByRole("combobox", { name: /熟悉程度/ })).toHaveValue(
      "自己定义的等级",
    );
    await user.type(screen.getByRole("textbox", { name: /标题/ }), "（补充）");
    await user.click(screen.getByRole("button", { name: "保存内容" }));
    expect(onSave.mock.calls[0][0].values).toEqual(entry.values);
  });
  it("改填非法链接时阻止保存并解释原因", () => {
    const onSave = vi.fn(),
      module = mixedModule();
    const { container } = render(
      <RecordEditor
        module={module}
        entry={{ ...blankEntry(), title: "测试" }}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    );
    fireEvent.change(screen.getByRole("textbox", { name: "材料链接" }), {
      target: { value: "javascript:alert(1)" },
    });
    fireEvent.submit(container.querySelector("form")!);
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("材料链接");
  });
  it("可以修改字段类型和分号分隔的选项，并正确保存配置", async () => {
    const user = userEvent.setup(),
      onSave = vi.fn(),
      module = mixedModule();
    render(<ModuleEditor module={module} onClose={vi.fn()} onSave={onSave} />);
    await user.selectOptions(
      screen.getByRole("combobox", { name: "熟悉程度的字段类型" }),
      "select",
    );
    const options = screen.getByRole("textbox", { name: "熟悉程度的选项" });
    await user.clear(options);
    await user.type(options, "待学；复习中；已掌握");
    await user.click(screen.getByRole("button", { name: "保存更改" }));
    expect(onSave.mock.calls[0][0].fieldConfig.熟悉程度).toEqual({
      type: "select",
      options: ["待学", "复习中", "已掌握"],
    });
    expect(onSave.mock.calls[0][0].entries).toEqual(module.entries);
  });
  it("链接字段能直接打开材料，并拒绝把脚本地址变成链接", () => {
    const module = mixedModule();
    const { rerender } = render(
      <FieldValue
        module={module}
        field="材料链接"
        value="https://example.com/lesson"
      />,
    );
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "https://example.com/lesson",
    );
    expect(screen.getByRole("link")).toHaveAttribute(
      "rel",
      "noopener noreferrer",
    );
    rerender(
      <FieldValue
        module={module}
        field="材料链接"
        value="javascript:alert(1)"
      />,
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
  it("误关闭时保留草稿，确认放弃后才关闭", async () => {
    const user = userEvent.setup(),
      onClose = vi.fn();
    render(
      <RecordEditor
        module={mixedModule()}
        entry={blankEntry()}
        onClose={onClose}
        onSave={vi.fn()}
      />,
    );
    await user.type(
      screen.getByRole("textbox", { name: /标题/ }),
      "未保存的学习记录",
    );
    await user.click(screen.getByRole("button", { name: "关闭弹窗" }));
    expect(window.confirm).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    vi.mocked(window.confirm).mockReturnValue(true);
    await user.click(screen.getByRole("button", { name: "关闭弹窗" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
