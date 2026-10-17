import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { getFeedById } from "@/lib/catalog";
import { FeedChips } from "./FeedChips";

const options = ["kr-yonhap-economy", "kr-hankyung-economy", "kr-mk-economy"].map((id) => getFeedById(id)!);

describe("FeedChips", () => {
  it("shows a pressed chip for each selected feed", () => {
    render(<FeedChips options={options} selected={["kr-yonhap-economy"]} customUrls={[]} max={12} onToggle={vi.fn()} />);
    expect(screen.getByRole("button", { name: "연합뉴스" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "한국경제" })).toHaveAttribute("aria-pressed", "false");
  });

  it("toggles a feed on click", async () => {
    const onToggle = vi.fn();
    render(<FeedChips options={options} selected={["kr-yonhap-economy"]} customUrls={[]} max={12} onToggle={onToggle} />);
    await userEvent.click(screen.getByRole("button", { name: "매일경제" }));
    expect(onToggle).toHaveBeenCalledWith("kr-mk-economy");
  });

  it("disables unselected chips when the maximum is reached", () => {
    render(<FeedChips options={options} selected={["kr-yonhap-economy"]} customUrls={["https://a.com/rss"]} max={2} onToggle={vi.fn()} />);
    expect(screen.getByRole("button", { name: "한국경제" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "연합뉴스" })).not.toBeDisabled();
  });

  it("shows custom urls as host chips", () => {
    render(<FeedChips options={[]} selected={[]} customUrls={["https://blog.example.com/rss.xml"]} max={12} onToggle={vi.fn()} />);
    expect(screen.getByText("blog.example.com")).toHaveAttribute("title", "직접 추가한 RSS: https://blog.example.com/rss.xml (편집 창에서 관리)");
  });

  it("renders nothing without options or custom urls", () => {
    const { container } = render(<FeedChips options={[]} selected={[]} customUrls={[]} max={12} onToggle={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
