import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LAYOUT_KEY } from "@/lib/layout-repository";
import type { Layout } from "@/types/layout";
import { Dashboard } from "./Dashboard";

// 세계 흐름 기본 보기·테마 (Dashboard.test.tsx는 패널 화면 전용)

const fetchMock = vi.fn();
const now = new Date().toISOString();

const insights = {
  updatedAt: now,
  countries: { KR: 3, US: 2 },
  stories: [
    {
      id: "s-1",
      leadTitle: "Chip exports surge",
      terms: ["chip"],
      countries: ["KR", "US"],
      sources: ["연합", "CNBC"],
      size: 2,
      firstSeenAt: now,
      lastSeenAt: now,
      trend: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
      rising: false,
      entities: [],
      articles: [
        { id: "w1", title: "반도체 수출 급증", link: "https://yna.example/1", source: "연합", country: "KR", publishedAt: now },
        { id: "w2", title: "Chip exports surge", link: "https://cnbc.example/1", source: "CNBC", country: "US", publishedAt: now },
      ],
    },
  ],
};

const json = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } }));

const layout: Layout = {
  version: 1,
  panels: [{ id: "a", country: "KR", category: "top", feedIds: ["kr-yonhap-top"], customUrls: [], limit: 10 }],
};

const saved = () => JSON.parse(window.localStorage.getItem(LAYOUT_KEY) ?? "null") as Layout | null;

function renderDashboard() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <Dashboard />
    </SWRConfig>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  fetchMock.mockReset();
  fetchMock.mockImplementation((url: string) => {
    if (url.startsWith("/api/insights")) return json(insights);
    if (url.startsWith("/api/article")) return json({ mode: "link", url: "https://yna.example/1", reason: "x" });
    const ids = new URL(url, "http://localhost").searchParams.get("ids") ?? "x";
    return json({ articles: [{ id: ids, title: `기사 ${ids}`, link: `https://news.example.com/${ids}`, publishedAt: now, source: "매체" }], errors: [], fetchedAt: now });
  });
  vi.stubGlobal("fetch", fetchMock);
  document.documentElement.removeAttribute("data-theme");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Dashboard 세계 흐름", () => {
  it("보기를 고른 적이 없으면 세계 흐름이 첫 화면", async () => {
    window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
    renderDashboard();
    expect(await screen.findByRole("region", { name: "지금 세계 지도" })).toBeInTheDocument();
    expect(screen.queryAllByRole("article")).toHaveLength(0);
  });

  it("패널로 바꾸면 저장되고, 세계 흐름으로 돌아오면 기본값이라 저장하지 않는다", async () => {
    window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
    renderDashboard();
    await screen.findByRole("region", { name: "지금 세계 지도" });
    await userEvent.click(screen.getByRole("button", { name: "패널" }));
    expect(await screen.findAllByRole("article")).toHaveLength(1);
    await waitFor(() => expect(saved()?.boards?.[0].view).toBe("panels"));
    await userEvent.click(screen.getByRole("button", { name: "세계 흐름" }));
    await waitFor(() => expect(saved()?.boards?.[0].view).toBeUndefined());
  });

  it("사건 기사를 누르면 같은 사건의 다른 매체와 함께 원문 서랍을 연다", async () => {
    window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
    renderDashboard();
    await userEvent.click(await screen.findByRole("button", { name: /Chip exports surge/ }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /반도체 수출 급증/ }));
    expect(screen.queryByRole("dialog", { name: /Chip exports surge/ })).not.toBeInTheDocument();
    expect(await screen.findByText("같은 소식, 다른 매체")).toBeInTheDocument();
  });

  it("아래 탭 바로 보기를 바꾼다 (폰)", async () => {
    window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
    renderDashboard();
    const tabs = await screen.findByRole("navigation", { name: "앱 탭" });
    expect(within(tabs).getByRole("button", { name: "세계 흐름 탭" })).toHaveAttribute("aria-current", "page");
    await userEvent.click(within(tabs).getByRole("button", { name: "패널 탭" }));
    expect(await screen.findAllByRole("article")).toHaveLength(1);
    expect(within(tabs).getByRole("button", { name: "패널 탭" })).toHaveAttribute("aria-current", "page");
  });
});

describe("Dashboard 테마", () => {
  it("기본은 어둡게, 설정에서 밝게 바꾸면 저장하고 문서에 반영한다", async () => {
    window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
    renderDashboard();
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe("dark"));
    await userEvent.click(screen.getByRole("button", { name: "설정" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "밝은 화면으로" }));
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe("light"));
    expect(saved()?.theme).toBe("light");
  });
});
