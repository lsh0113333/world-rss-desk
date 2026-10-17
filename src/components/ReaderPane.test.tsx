import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Article, ArticleView } from "@/types/article";
import { ReaderPane } from "./ReaderPane";

const article: Article = {
  id: "a1",
  title: "Markets rally",
  link: "https://news.example.com/a?x=1",
  publishedAt: "2026-10-17T08:00:00Z",
  source: "Example News",
};

const fetchMock = vi.fn();

function respondWith(view: ArticleView) {
  fetchMock.mockResolvedValue(new Response(JSON.stringify(view), { headers: { "content-type": "application/json" } }));
}

function renderPane(props: Partial<Parameters<typeof ReaderPane>[0]> = {}) {
  const onClose = vi.fn();
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <ReaderPane article={article} onClose={onClose} {...props} />
    </SWRConfig>,
  );
  return { onClose };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ReaderPane", () => {
  it("shows a hint when no article is selected", () => {
    renderPane({ article: null });
    expect(screen.getByText("왼쪽에서 기사를 선택하세요")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requests the article view and shows a loading state", () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    renderPane();
    expect(fetchMock).toHaveBeenCalledWith(`/api/article?url=${encodeURIComponent(article.link)}`);
    expect(screen.getByLabelText("원문 불러오는 중")).toBeInTheDocument();
  });

  it("embeds the original page in a sandboxed iframe in frame mode", async () => {
    respondWith({ mode: "frame", url: "https://news.example.com/final" });
    renderPane();
    const frame = await screen.findByTitle("Markets rally");
    expect(frame.tagName).toBe("IFRAME");
    expect(frame).toHaveAttribute("src", "https://news.example.com/final");
    expect(frame).toHaveAttribute("sandbox", expect.stringContaining("allow-scripts"));
    expect(frame).toHaveAttribute("referrerpolicy", "no-referrer");
    expect(screen.getByText("원문")).toBeInTheDocument();
  });

  it("renders reader blocks as plain elements in reader mode", async () => {
    respondWith({
      mode: "reader",
      url: article.link,
      title: "Markets rally as rates fall",
      siteName: "Example News",
      byline: "By Jane Doe",
      blocks: [
        { type: "p", text: "Stocks rose <b>sharply</b>." },
        { type: "h2", text: "Investors react" },
        { type: "blockquote", text: "This changes the outlook" },
        { type: "li", text: "Tech up 4%" },
        { type: "img", src: "https://news.example.com/chart.png", alt: "chart" },
      ],
    });
    renderPane();
    expect(await screen.findByRole("heading", { level: 1, name: "Markets rally as rates fall" })).toBeInTheDocument();
    expect(screen.getByText("읽기 모드")).toBeInTheDocument();
    expect(screen.getByText("Stocks rose <b>sharply</b>.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Investors react" })).toBeInTheDocument();
    expect(screen.getByRole("listitem")).toHaveTextContent("Tech up 4%");
    expect(screen.getByRole("img", { name: "chart" })).toHaveAttribute("src", "https://news.example.com/chart.png");
    expect(screen.getByText(/Example News · By Jane Doe/)).toBeInTheDocument();
  });

  it("explains why and offers a new tab in link mode", async () => {
    respondWith({ mode: "link", url: article.link, reason: "사이트가 접근을 막았습니다 (HTTP 403)" });
    renderPane();
    expect(await screen.findByText("사이트가 접근을 막았습니다 (HTTP 403)")).toBeInTheDocument();
    const button = screen.getByRole("link", { name: "새 탭에서 열기" });
    expect(button).toHaveAttribute("href", article.link);
    expect(button).toHaveAttribute("target", "_blank");
  });

  it("shows an error with a new-tab link when the API fails", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "차단된 주소입니다" }), { status: 400 }));
    renderPane();
    expect(await screen.findByText("차단된 주소입니다")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "새 탭에서 열기" })).toBeInTheDocument();
  });

  it("always offers the original site link and a close button", async () => {
    respondWith({ mode: "frame", url: article.link });
    const { onClose } = renderPane();
    expect(screen.getByRole("link", { name: /원문 사이트에서 열기/ })).toHaveAttribute("href", article.link);
    await userEvent.click(screen.getByRole("button", { name: "원문 닫기" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows a back-to-list button in mobile mode", async () => {
    respondWith({ mode: "frame", url: article.link });
    const { onClose } = renderPane({ mobile: true });
    await userEvent.click(screen.getByRole("button", { name: "← 목록" }));
    expect(onClose).toHaveBeenCalled();
  });
});
