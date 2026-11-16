import React from "react";
import { it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Modal } from "../../src/components/shared";

it("弹窗只响应完整的背景点击，不因内部留白或从内部拖出而关闭", () => {
  // JSDOM lacks PointerEvent coordinates; browser tests also exercise native input.
  vi.stubGlobal("PointerEvent", MouseEvent);
  try {
    const close = vi.fn();
    render(
      <Modal title="测试弹窗" subtitle="弹窗说明" onClose={close}>
        <p>内容</p>
      </Modal>,
    );
    const dialog = screen.getByRole("dialog", { name: "测试弹窗" });
    vi.spyOn(dialog, "getBoundingClientRect").mockReturnValue({
      left: 100,
      top: 100,
      right: 500,
      bottom: 500,
    } as DOMRect);
    expect(dialog).toHaveAccessibleDescription("弹窗说明");
    fireEvent.pointerDown(dialog, { button: 0, clientX: 200, clientY: 200 });
    fireEvent.click(dialog, { clientX: 200, clientY: 200 });
    expect(close).not.toHaveBeenCalled();
    fireEvent.pointerDown(dialog, { button: 0, clientX: 200, clientY: 200 });
    fireEvent.click(dialog, { clientX: 20, clientY: 20 });
    expect(close).not.toHaveBeenCalled();
    fireEvent.pointerDown(dialog, { button: 0, clientX: 20, clientY: 20 });
    fireEvent.click(dialog, { clientX: 20, clientY: 20 });
    expect(close).toHaveBeenCalledTimes(1);
  } finally {
    vi.unstubAllGlobals();
  }
});
