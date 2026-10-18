import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { StoryCluster } from "@/types/insights";
import { HeadlineWall } from "./HeadlineWall";

const now = new Date("2026-10-18T12:00:00Z");
const cluster = (id: string, title: string, publishedAt: string, sources: string[], country = "US"): StoryCluster => ({
  id,
  items: [{ article: { id, title, link: `https://example.com/${id}`, publishedAt, source: sources[0] }, panelId: "p", country }],
  sources,
  countries: [country],
});

describe("HeadlineWall", () => {
  it("lists one row per story, newest first, with flag and other-outlet count", () => {
    render(
      <HeadlineWall
        clusters={[cluster("old", "Older story", "2026-10-18T08:00:00Z", ["BBC"], "GB"), cluster("new", "Newer story", "2026-10-18T11:00:00Z", ["CNN", "NPR", "ABC"])]}
        now={now}
        onSelect={vi.fn()}
      />,
    );
    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual([expect.stringContaining("Newer story"), expect.stringContaining("Older story")]);
    expect(links[0]).toHaveTextContent("🇺🇸");
    expect(links[0]).toHaveTextContent("+2개 매체");
    expect(links[1]).toHaveTextContent("🇬🇧");
    expect(screen.getByText(/헤드라인 2개/)).toBeInTheDocument();
  });

  it("opens the article in the reader on click and highlights keywords", async () => {
    const onSelect = vi.fn();
    const c = cluster("a", "Iran talks", "2026-10-18T11:00:00Z", ["BBC"]);
    render(<HeadlineWall clusters={[c]} now={now} keywords={["iran"]} onSelect={onSelect} />);
    expect(screen.getByText("Iran").tagName).toBe("MARK");
    await userEvent.click(screen.getByRole("link"));
    expect(onSelect).toHaveBeenCalledWith(c.items[0].article);
  });

  it("shows a loading or empty message", () => {
    const { rerender } = render(<HeadlineWall clusters={[]} now={now} loading onSelect={vi.fn()} />);
    expect(screen.getByText("헤드라인을 불러오는 중…")).toBeInTheDocument();
    rerender(<HeadlineWall clusters={[]} now={now} onSelect={vi.fn()} />);
    expect(screen.getByText("표시할 기사가 없습니다")).toBeInTheDocument();
  });
});
