import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Onboarding } from "./Onboarding";

describe("Onboarding", () => {
  it("starts with sensible picks and returns the chosen countries and categories", async () => {
    const onDone = vi.fn();
    render(<Onboarding onDone={onDone} onSkip={vi.fn()} />);
    expect(screen.getByRole("button", { name: /한국/ })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: /일본/ }));
    await userEvent.click(screen.getByRole("button", { name: /🇺🇸 미국/ }));
    await userEvent.click(screen.getByRole("button", { name: "IT" }));
    await userEvent.click(screen.getByRole("button", { name: "내 화면 만들기" }));
    expect(onDone).toHaveBeenCalledWith(["KR", "WORLD", "JP"], ["top", "economy", "tech"]);
  });

  it("requires at least one country and category", async () => {
    render(<Onboarding onDone={vi.fn()} onSkip={vi.fn()} />);
    for (const name of ["종합", "경제"]) await userEvent.click(screen.getByRole("button", { name }));
    expect(screen.getByRole("button", { name: "내 화면 만들기" })).toBeDisabled();
  });

  it("can keep the default layout", async () => {
    const onSkip = vi.fn();
    render(<Onboarding onDone={vi.fn()} onSkip={onSkip} />);
    await userEvent.click(screen.getByRole("button", { name: "기본 구성으로 시작" }));
    expect(onSkip).toHaveBeenCalled();
  });
});
