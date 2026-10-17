import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LAYOUT_KEY } from "@/lib/layout-repository";
import type { FeedsResponse } from "@/types/article";
import type { Layout } from "@/types/layout";
import { Dashboard } from "./Dashboard";

const fetchMock = vi.fn();

function respond(body: FeedsResponse) {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } }));
}

function feedsFor(url: string): FeedsResponse {
  const ids = new URL(url, "http://localhost").searchParams.get("ids") ?? "custom";
  return {
    articles: [{ id: ids, title: `기사 ${ids}`, link: `https://news.example.com/${ids}`, publishedAt: new Date().toISOString(), source: "매체" }],
    errors: [],
    fetchedAt: new Date().toISOString(),
  };
}

function renderDashboard() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <Dashboard />
    </SWRConfig>,
  );
}

const twoPanels: Layout = {
  version: 1,
  panels: [
    { id: "a", country: "KR", category: "top", feedIds: ["kr-yonhap-top"], customUrls: [], limit: 10 },
    { id: "b", country: "US", category: "top", feedIds: ["us-nyt-top"], customUrls: [], limit: 10 },
  ],
};

beforeEach(() => {
  window.localStorage.clear();
  fetchMock.mockReset();
  fetchMock.mockImplementation((url: string) => respond(feedsFor(url)));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const savedLayout = () => JSON.parse(window.localStorage.getItem(LAYOUT_KEY) ?? "null") as Layout | null;

describe("Dashboard", () => {
  it("shows the eight preset panels on first visit and saves them", async () => {
    renderDashboard();
    expect(await screen.findAllByRole("article")).toHaveLength(8);
    expect(screen.getByRole("heading", { name: "🇰🇷 한국 · 종합" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "🌐 국제" })).toBeInTheDocument();
    await waitFor(() => expect(savedLayout()?.panels).toHaveLength(8));
  });

  it("loads the saved layout and renders articles from the API", async () => {
    window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(twoPanels));
    renderDashboard();
    expect(await screen.findByRole("link", { name: /기사 kr-yonhap-top/ })).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(fetchMock.mock.calls.map(([u]) => u)).toEqual(
      expect.arrayContaining(["/api/feeds?ids=kr-yonhap-top&limit=10", "/api/feeds?ids=us-nyt-top&limit=10"]),
    );
  });

  it("panel refresh bypasses the cache with fresh=1", async () => {
    window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(twoPanels));
    renderDashboard();
    const first = (await screen.findAllByRole("article"))[0];
    await screen.findByRole("link", { name: /기사 kr-yonhap-top/ });
    await userEvent.click(within(first).getByRole("button", { name: "새로고침" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/feeds?ids=kr-yonhap-top&limit=10&fresh=1"));
  });

  it("refresh-all refreshes every panel", async () => {
    window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(twoPanels));
    renderDashboard();
    await screen.findByRole("link", { name: /기사 us-nyt-top/ });
    await userEvent.click(screen.getByRole("button", { name: "전체 새로고침" }));
    await waitFor(() => {
      const urls = fetchMock.mock.calls.map(([u]) => u as string);
      expect(urls).toContain("/api/feeds?ids=kr-yonhap-top&limit=10&fresh=1");
      expect(urls).toContain("/api/feeds?ids=us-nyt-top&limit=10&fresh=1");
    });
    expect(screen.getByRole("button", { name: "전체 새로고침" })).toBeDisabled();
  });

  it("adds a panel through the editor", async () => {
    window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(twoPanels));
    renderDashboard();
    await screen.findAllByRole("article");
    await userEvent.click(screen.getByRole("button", { name: "+ 패널" }));
    await userEvent.click(screen.getByRole("radio", { name: "경제" }));
    await userEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(3);
    expect(screen.getByRole("heading", { name: "🇰🇷 한국 · 경제" })).toBeInTheDocument();
    await waitFor(() => expect(savedLayout()?.panels).toHaveLength(3));
  });

  it("edits a panel title", async () => {
    window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(twoPanels));
    renderDashboard();
    const first = (await screen.findAllByRole("article"))[0];
    await userEvent.click(within(first).getByRole("button", { name: "패널 편집" }));
    await userEvent.type(screen.getByLabelText("제목"), "아침 브리핑");
    await userEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(screen.getByRole("heading", { name: "아침 브리핑" })).toBeInTheDocument();
  });

  it("deletes a panel and undoes it from the toast", async () => {
    window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(twoPanels));
    renderDashboard();
    const first = (await screen.findAllByRole("article"))[0];
    await userEvent.click(within(first).getByRole("button", { name: "패널 편집" }));
    await userEvent.click(screen.getByRole("button", { name: "패널 삭제" }));
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent('"🇰🇷 한국 · 종합" 패널 삭제됨');
    await userEvent.click(screen.getByRole("button", { name: "되돌리기" }));
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(screen.getAllByRole("heading", { level: 2 })[0]).toHaveTextContent("🇰🇷 한국 · 종합");
  });

  it("moves panels", async () => {
    window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(twoPanels));
    renderDashboard();
    const first = (await screen.findAllByRole("article"))[0];
    await userEvent.click(within(first).getByRole("button", { name: "뒤로 이동" }));
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["🇺🇸 미국 · 종합", "🇰🇷 한국 · 종합"]);
  });

  it("shows the empty state and restores the preset", async () => {
    window.localStorage.setItem(LAYOUT_KEY, JSON.stringify({ version: 1, panels: [] }));
    renderDashboard();
    expect(await screen.findByText("패널을 추가하세요")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "기본 구성 불러오기" }));
    expect(screen.getAllByRole("article")).toHaveLength(8);
  });

  it("shows 오프라인 when the browser goes offline", async () => {
    renderDashboard();
    await screen.findAllByRole("article");
    const spy = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(screen.getByText("오프라인")).toBeInTheDocument();
    spy.mockReturnValue(true);
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(screen.queryByText("오프라인")).not.toBeInTheDocument();
  });
});
