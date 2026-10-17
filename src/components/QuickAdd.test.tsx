import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { QuickAdd } from "./QuickAdd";

function setup() {
  const handlers = { onAdd: vi.fn(), onClose: vi.fn(), onAdvanced: vi.fn() };
  render(<QuickAdd {...handlers} />);
  return handlers;
}

describe("QuickAdd", () => {
  it("adds a panel in two clicks: country then category", async () => {
    const { onAdd } = setup();
    await userEvent.click(screen.getByRole("button", { name: /미국/ }));
    expect(screen.getByRole("heading", { name: /미국 — 분야를 고르세요/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "IT" }));
    expect(onAdd).toHaveBeenCalledWith({ country: "US", category: "tech" });
  });

  it("only offers categories the country has, plus all outlets", async () => {
    const { onAdd } = setup();
    await userEvent.click(screen.getByRole("button", { name: /브라질/ }));
    expect(screen.queryByRole("button", { name: "경제" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "전체 매체" }));
    expect(onAdd).toHaveBeenCalledWith({ country: "BR" });
  });

  it("goes back, opens the advanced editor and closes on Escape", async () => {
    const { onAdvanced, onClose } = setup();
    await userEvent.click(screen.getByRole("button", { name: /일본/ }));
    await userEvent.click(screen.getByRole("button", { name: "나라 다시 고르기" }));
    expect(screen.getByRole("heading", { name: "어느 나라 소식을 볼까요?" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /매체 직접 고르기/ }));
    expect(onAdvanced).toHaveBeenCalled();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});
