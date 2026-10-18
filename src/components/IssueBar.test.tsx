import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Issue, StoryItem } from "@/types/insights";
import { IssueBar, IssueDialog } from "./IssueBar";

const now = new Date("2026-10-18T12:00:00Z");
const item = (id: string, title: string, source: string, country: string): StoryItem => ({
  article: { id, title, link: `https://example.com/${id}`, publishedAt: "2026-10-18T11:00:00Z", source },
  panelId: "p",
  country,
});

const issue: Issue = {
  id: "hormuz",
  label: "Hormuz · Iran",
  terms: ["hormuz", "iran"],
  items: [item("1", "Iran shuts Hormuz", "BBC", "GB"), item("2", "Hormuz closure", "CNN", "US"), item("3", "Oil and Hormuz", "NPR", "US")],
  countries: ["GB", "US"],
  sources: ["BBC", "CNN", "NPR"],
  recent: 2,
};

describe("IssueBar", () => {
  it("renders nothing without issues", () => {
    const { container } = render(<IssueBar issues={[]} onOpen={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows rank, label, flags, article count and recent count, and opens on click", async () => {
    const onOpen = vi.fn();
    render(<IssueBar issues={[issue]} onOpen={onOpen} />);
    const button = screen.getByRole("button", { name: /Hormuz · Iran/ });
    expect(button).toHaveTextContent("1");
    expect(button).toHaveTextContent("🇬🇧🇺🇸");
    expect(button).toHaveTextContent("기사 3");
    expect(button).toHaveTextContent("1시간 +2");
    await userEvent.click(button);
    expect(onOpen).toHaveBeenCalledWith(issue);
  });
});

describe("IssueDialog", () => {
  it("groups articles by country, largest first, and opens an article", async () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(<IssueDialog issue={issue} now={now} onSelect={onSelect} onClose={onClose} />);
    const dialog = screen.getByRole("dialog", { name: "이슈: Hormuz · Iran" });
    const regions = within(dialog).getAllByRole("region");
    expect(regions.map((r) => r.getAttribute("aria-label"))).toEqual(["미국", "영국"]);
    await userEvent.click(within(regions[1]).getByRole("button", { name: /Iran shuts Hormuz/ }));
    expect(onSelect).toHaveBeenCalledWith(issue.items[0].article);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});
