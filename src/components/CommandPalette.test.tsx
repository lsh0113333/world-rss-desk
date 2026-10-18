import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Layout } from "@/types/layout";
import { CommandPalette } from "./CommandPalette";

const layout: Layout = { version: 1, panels: [] };

describe("CommandPalette", () => {
  it("runs the highlighted result with Enter", async () => {
    const onRun = vi.fn();
    const onClose = vi.fn();
    render(<CommandPalette layout={layout} onRun={onRun} onClose={onClose} />);
    await userEvent.type(screen.getByRole("combobox", { name: "명령 검색" }), "미국 경제{Enter}");
    expect(onRun).toHaveBeenCalledWith(expect.objectContaining({ kind: "add", country: "US", category: "economy" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("moves the selection with arrow keys", async () => {
    const onRun = vi.fn();
    render(<CommandPalette layout={layout} onRun={onRun} onClose={vi.fn()} />);
    const input = screen.getByRole("combobox", { name: "명령 검색" });
    await userEvent.type(input, "일본");
    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(onRun.mock.calls[0][0].label).toBe(options[1].textContent?.replace(/^추가/, ""));
  });

  it("offers only a keyword panel for unmatched text and closes on Escape", async () => {
    const onClose = vi.fn();
    render(<CommandPalette layout={layout} onRun={vi.fn()} onClose={onClose} />);
    await userEvent.type(screen.getByRole("combobox", { name: "명령 검색" }), "zzzzqqq");
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("option")).toHaveTextContent("키워드 패널 추가: 'zzzzqqq'");
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});
