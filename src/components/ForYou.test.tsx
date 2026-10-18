import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Recommendation } from "@/lib/recommend";
import { ForYou } from "./ForYou";

const now = new Date("2026-10-18T12:00:00Z");
const rec: Recommendation = {
  item: { article: { id: "1", title: "Iran Hormuz standoff", link: "https://example.com/1", publishedAt: "2026-10-18T11:00:00Z", source: "Al Jazeera" }, panelId: "p" },
  score: 0.6,
  reason: "관심 키워드: Iran",
};

function setup(props: Partial<Parameters<typeof ForYou>[0]> = {}) {
  const handlers = { onSelect: vi.fn(), onAddPanel: vi.fn() };
  const { container } = render(<ForYou recommendations={[]} suggestions={[]} readCount={0} now={now} {...handlers} {...props} />);
  return { ...handlers, container };
}

describe("ForYou", () => {
  it("renders nothing for a brand-new reader", () => {
    expect(setup().container).toBeEmptyDOMElement();
  });

  it("tells how many more reads are needed before recommendations start", () => {
    setup({ readCount: 2 });
    expect(screen.getByText(/3개 더 읽으면/)).toBeInTheDocument();
  });

  it("shows recommendations with their reason and opens one", async () => {
    const { onSelect } = setup({ recommendations: [rec], readCount: 10 });
    const card = screen.getByRole("button", { name: /Iran Hormuz standoff/ });
    expect(card).toHaveTextContent("관심 키워드: Iran");
    await userEvent.click(card);
    expect(onSelect).toHaveBeenCalledWith(rec.item.article);
  });

  it("offers panel suggestions", async () => {
    const suggestion = { country: "SA", category: "top" as const, reason: "최근 중동 기사를 많이 읽었어요" };
    const { onAddPanel } = setup({ suggestions: [suggestion], readCount: 10 });
    expect(screen.getByText(/최근 중동 기사를 많이 읽었어요/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "+ 🇸🇦 사우디아라비아 패널" }));
    expect(onAddPanel).toHaveBeenCalledWith(suggestion);
  });
});
