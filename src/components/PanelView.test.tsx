import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Article } from "@/types/article";
import { PanelView, type PanelViewProps } from "./PanelView";

const now = new Date("2026-10-17T12:00:00Z");
const art = (n: number, publishedAt: string | null, extra: Partial<Article> = {}): Article => ({
  id: `a${n}`,
  title: `헤드라인 ${n}`,
  link: `https://news.example.com/${n}`,
  publishedAt,
  source: "연합뉴스",
  ...extra,
});

function setup(props: Partial<PanelViewProps> = {}) {
  const handlers = {
    onRefresh: vi.fn(),
    onRetry: vi.fn(),
    onMarkSeen: vi.fn(),
    onEdit: vi.fn(),
    onMove: vi.fn(),
  };
  render(
    <PanelView
      title="🇰🇷 한국 · 종합"
      articles={[art(1, "2026-10-17T11:50:00Z"), art(2, "2026-10-17T09:00:00Z")]}
      errors={[]}
      status="ready"
      refreshing={false}
      coolingDown={false}
      isFirst={false}
      isLast={false}
      now={now}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

describe("PanelView", () => {
  it("renders the title and article links that open in a new tab", () => {
    setup();
    expect(screen.getByRole("heading", { name: "🇰🇷 한국 · 종합" })).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /헤드라인 1/ });
    expect(link).toHaveAttribute("href", "https://news.example.com/1");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveTextContent("연합뉴스 · 10분 전");
  });

  it("shows the outlet note next to the source", () => {
    setup({ articles: [art(1, "2026-10-17T11:50:00Z", { source: "CGTN" })], notes: { CGTN: "중국 정부 시각" } });
    expect(screen.getByRole("link")).toHaveTextContent("CGTN · 중국 정부 시각 · 10분 전");
  });

  it("highlights new articles and shows a +N button that marks the panel seen", async () => {
    const { onMarkSeen } = setup({ lastSeenAt: "2026-10-17T10:00:00Z" });
    expect(screen.getByRole("link", { name: /헤드라인 1/ })).toHaveAttribute("data-new", "true");
    expect(screen.getByRole("link", { name: /헤드라인 2/ })).not.toHaveAttribute("data-new");
    await userEvent.click(screen.getByRole("button", { name: "새 기사 1개 확인" }));
    expect(onMarkSeen).toHaveBeenCalled();
  });

  it("shows no +N button when nothing is new", () => {
    setup({ lastSeenAt: "2026-10-17T11:55:00Z" });
    expect(screen.queryByRole("button", { name: /새 기사/ })).not.toBeInTheDocument();
  });

  it("shows the last fetch time", () => {
    setup({ fetchedAt: new Date(2026, 9, 17, 10, 42).toISOString() });
    expect(screen.getByText("10:42")).toBeInTheDocument();
  });

  it("refresh button calls onRefresh, shows progress and respects the cooldown", async () => {
    const { onRefresh } = setup();
    await userEvent.click(screen.getByRole("button", { name: "새로고침" }));
    expect(onRefresh).toHaveBeenCalled();
  });

  it("shows 갱신 중… while refreshing and disables the button", () => {
    setup({ refreshing: true });
    expect(screen.getByText("갱신 중…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "새로고침" })).toBeDisabled();
  });

  it("disables refresh during the cooldown with a hint", () => {
    setup({ coolingDown: true });
    const button = screen.getByRole("button", { name: "새로고침" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", "30초 후 다시 가능");
  });

  it("calls onEdit and onMove, hiding move buttons at the edges", async () => {
    const { onEdit, onMove } = setup();
    await userEvent.click(screen.getByRole("button", { name: "패널 편집" }));
    await userEvent.click(screen.getByRole("button", { name: "앞으로 이동" }));
    await userEvent.click(screen.getByRole("button", { name: "뒤로 이동" }));
    expect(onEdit).toHaveBeenCalled();
    expect(onMove.mock.calls).toEqual([[-1], [1]]);
  });

  it("disables move buttons at the edges", () => {
    setup({ isFirst: true, isLast: true });
    expect(screen.getByRole("button", { name: "앞으로 이동" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "뒤로 이동" })).toBeDisabled();
  });

  it("shows a skeleton while loading", () => {
    setup({ status: "loading", articles: undefined });
    expect(screen.getByLabelText("불러오는 중")).toBeInTheDocument();
  });

  it("shows a retry button when everything failed", async () => {
    const { onRetry } = setup({ status: "failed", articles: undefined });
    expect(screen.getByText("불러오지 못했습니다")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("shows an empty message when there are no recent articles", () => {
    setup({ articles: [] });
    expect(screen.getByText("최근 기사가 없습니다")).toBeInTheDocument();
  });

  it("explains a panel without feeds", () => {
    setup({ status: "no-feeds", articles: undefined });
    expect(screen.getByText("선택된 매체가 없습니다")).toBeInTheDocument();
  });

  it("lists partial failures in the footer", () => {
    setup({
      errors: [
        { feed: "kr-hankyung-top", message: "HTTP 403" },
        { feed: "https://x.com/rss", message: "시간 초과 (8초)" },
      ],
    });
    const footer = screen.getByText("2개 매체 불러오기 실패");
    expect(footer).toHaveAttribute("title", "한국경제: HTTP 403\nhttps://x.com/rss: 시간 초과 (8초)");
  });

  it("shows a refresh error in the footer", () => {
    setup({ refreshError: "HTTP 500" });
    expect(within(screen.getByRole("article")).getByText("새로고침 실패: HTTP 500")).toBeInTheDocument();
  });
});
