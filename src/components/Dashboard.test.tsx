import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

/** 패널(role=article) 안의 기사 링크 — "오늘의 톱" 카드와 구분 */
const panelLink = async (name: RegExp) => {
  await screen.findAllByRole("article");
  return waitFor(() => {
    const links = screen.getAllByRole("article").flatMap((a) => within(a).queryAllByRole("link", { name }));
    if (!links.length) throw new Error(`no panel link ${name}`);
    return links[0];
  });
};
const panelTitles = () => screen.getAllByRole("article").map((a) => within(a).getByRole("heading").textContent);

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
    expect(await panelLink(/기사 kr-yonhap-top/)).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(fetchMock.mock.calls.map(([u]) => u)).toEqual(
      expect.arrayContaining(["/api/feeds?ids=kr-yonhap-top&limit=10", "/api/feeds?ids=us-nyt-top&limit=10"]),
    );
  });

  it("panel refresh bypasses the cache with fresh=1", async () => {
    window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(twoPanels));
    renderDashboard();
    const first = (await screen.findAllByRole("article"))[0];
    await panelLink(/기사 kr-yonhap-top/);
    await userEvent.click(within(first).getByRole("button", { name: "새로고침" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/feeds?ids=kr-yonhap-top&limit=10&fresh=1"));
  });

  it("refresh-all refreshes every panel", async () => {
    window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(twoPanels));
    renderDashboard();
    await panelLink(/기사 us-nyt-top/);
    await userEvent.click(screen.getByRole("button", { name: "전체 새로고침" }));
    await waitFor(() => {
      const urls = fetchMock.mock.calls.map(([u]) => u as string);
      expect(urls).toContain("/api/feeds?ids=kr-yonhap-top&limit=10&fresh=1");
      expect(urls).toContain("/api/feeds?ids=us-nyt-top&limit=10&fresh=1");
    });
    expect(screen.getByRole("button", { name: "전체 새로고침" })).toBeDisabled();
  });

  it("adds a panel in two clicks with quick add", async () => {
    window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(twoPanels));
    renderDashboard();
    await screen.findAllByRole("article");
    await userEvent.click(screen.getByRole("button", { name: "+ 패널" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: /🇰🇷 한국/ }));
    await userEvent.click(within(dialog).getByRole("button", { name: "경제" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(3);
    expect(panelTitles()).toContain("🇰🇷 한국 · 경제");
    await waitFor(() => expect(savedLayout()?.panels).toHaveLength(3));
  });

  it("opens the full editor from quick add for advanced options", async () => {
    window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(twoPanels));
    renderDashboard();
    await screen.findAllByRole("article");
    await userEvent.click(screen.getByRole("button", { name: "+ 패널" }));
    await userEvent.click(screen.getByRole("button", { name: /매체 직접 고르기/ }));
    expect(screen.getByRole("dialog", { name: "패널 추가" })).toBeInTheDocument();
    expect(screen.getByLabelText("RSS 또는 사이트 주소")).toBeInTheDocument();
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
    expect(panelTitles()[0]).toBe("🇰🇷 한국 · 종합");
  });

  it("moves panels", async () => {
    window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(twoPanels));
    renderDashboard();
    const first = (await screen.findAllByRole("article"))[0];
    await userEvent.click(within(first).getByRole("button", { name: "뒤로 이동" }));
    expect(panelTitles()).toEqual(["🇺🇸 미국 · 종합", "🇰🇷 한국 · 종합"]);
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

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({ matches, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
}

function articleViewResponse(url: string) {
  if (url.startsWith("/api/article")) {
    return Promise.resolve(new Response(JSON.stringify({ mode: "frame", url: "https://news.example.com/kr-yonhap-top" }), { headers: { "content-type": "application/json" } }));
  }
  return respond(feedsFor(url));
}

describe("Dashboard — split view and chips", () => {
  it("toggling a chip changes the panel's feeds and request", async () => {
    window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(twoPanels));
    renderDashboard();
    const first = (await screen.findAllByRole("article"))[0];
    await userEvent.click(within(first).getByRole("button", { name: "한국경제" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/feeds?ids=kr-yonhap-top%2Ckr-hankyung-top&limit=10"));
    expect(savedLayout()?.panels[0].feedIds).toEqual(["kr-yonhap-top", "kr-hankyung-top"]);
  });

  it("opens the selected article in a right-side drawer on wide screens", async () => {
    stubMatchMedia(true);
    fetchMock.mockImplementation(articleViewResponse);
    window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(twoPanels));
    renderDashboard();
    expect(screen.queryByRole("region", { name: "기사 원문" })).not.toBeInTheDocument();
    await userEvent.click(await panelLink(/기사 kr-yonhap-top/));
    expect(await screen.findByTitle("기사 kr-yonhap-top")).toHaveAttribute("src", "https://news.example.com/kr-yonhap-top");
    expect(await panelLink(/기사 kr-yonhap-top/)).toHaveAttribute("aria-current", "true");
    await userEvent.click(screen.getByRole("button", { name: "원문 닫기" }));
    expect(screen.queryByTitle("기사 kr-yonhap-top")).not.toBeInTheDocument();
  });

  it("opens the article full screen on narrow screens and goes back to the list", async () => {
    stubMatchMedia(false);
    fetchMock.mockImplementation(articleViewResponse);
    window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(twoPanels));
    renderDashboard();
    await userEvent.click(await panelLink(/기사 kr-yonhap-top/));
    expect(await screen.findByTitle("기사 kr-yonhap-top")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "← 목록" }));
    expect(screen.queryByTitle("기사 kr-yonhap-top")).not.toBeInTheDocument();
  });
});

describe("Dashboard — top stories and sidebar", () => {
  it("shows one top-story card per panel and opens it on click", async () => {
    stubMatchMedia(true);
    fetchMock.mockImplementation(articleViewResponse);
    window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(twoPanels));
    renderDashboard();
    const strip = await screen.findByRole("region", { name: "오늘의 톱" });
    await waitFor(() => expect(within(strip).getAllByRole("link")).toHaveLength(2));
    await userEvent.click(within(strip).getByRole("link", { name: /기사 us-nyt-top/ }));
    expect(await screen.findByTitle("기사 us-nyt-top")).toBeInTheDocument();
  });

  it("lists panels in the sidebar and scrolls to a panel", async () => {
    window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(twoPanels));
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    renderDashboard();
    await screen.findAllByRole("article");
    const nav = screen.getAllByRole("navigation", { name: "내 패널" })[0];
    await userEvent.click(within(nav).getByRole("button", { name: /🇺🇸 미국 · 종합/ }));
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it("changes a panel's view from its view menu and saves it", async () => {
    window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(twoPanels));
    renderDashboard();
    const first = (await screen.findAllByRole("article"))[0];
    await userEvent.click(within(first).getByRole("button", { name: "보기 방식" }));
    await userEvent.click(within(first).getByRole("menuitemradio", { name: "텍스트" }));
    await waitFor(() => expect(savedLayout()?.panels[0].view).toBe("text"));
  });
});

describe("Dashboard — onboarding, command bar, boards, read state, drag", () => {
  it("offers onboarding on the first visit and builds the chosen layout", async () => {
    renderDashboard();
    const dialog = await screen.findByRole("dialog", { name: "세계 소식, 한눈에 보기" });
    await userEvent.click(within(dialog).getByRole("button", { name: /🇺🇸 미국/ }));
    await userEvent.click(within(dialog).getByRole("button", { name: /🌐 국제/ }));
    await userEvent.click(within(dialog).getByRole("button", { name: "내 화면 만들기" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(panelTitles()).toEqual(["🇰🇷 한국 · 종합", "🇰🇷 한국 · 경제"]);
  });

  it("does not show onboarding to returning users", async () => {
    window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(twoPanels));
    renderDashboard();
    await screen.findAllByRole("article");
    expect(screen.queryByRole("dialog", { name: "세계 소식, 한눈에 보기" })).not.toBeInTheDocument();
  });

  it("opens the command bar with Ctrl+K and adds a panel", async () => {
    window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(twoPanels));
    renderDashboard();
    await screen.findAllByRole("article");
    await userEvent.keyboard("{Control>}k{/Control}");
    await userEvent.type(screen.getByRole("combobox", { name: "명령 검색" }), "일본 종합{Enter}");
    expect(panelTitles()).toContain("🇯🇵 일본 · 종합");
  });

  it("creates boards and keeps panels separate per board", async () => {
    window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(twoPanels));
    renderDashboard();
    await screen.findAllByRole("article");
    const nav = screen.getAllByRole("navigation", { name: "내 패널" })[0];
    await userEvent.click(within(nav).getByRole("button", { name: "새 보드" }));
    await userEvent.type(within(nav).getByRole("textbox", { name: "보드 이름" }), "테크{Enter}");
    expect(within(nav).getByRole("button", { name: "테크" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByText("패널을 추가하세요")).toBeInTheDocument();
    await userEvent.click(within(nav).getByRole("button", { name: "내 화면" }));
    expect(screen.getAllByRole("article")).toHaveLength(2);
  });

  it("fades articles after they are opened", async () => {
    stubMatchMedia(true);
    fetchMock.mockImplementation(articleViewResponse);
    window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(twoPanels));
    renderDashboard();
    const link = await panelLink(/기사 kr-yonhap-top/);
    expect(link).not.toHaveAttribute("data-read");
    await userEvent.click(link);
    await userEvent.click(screen.getByRole("button", { name: "원문 닫기" }));
    expect(await panelLink(/기사 kr-yonhap-top/)).toHaveAttribute("data-read", "true");
  });

  it("reorders panels by dragging a header onto another panel", async () => {
    window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(twoPanels));
    renderDashboard();
    const [first, second] = await screen.findAllByRole("article");
    const header = within(first).getByRole("heading").closest("header")!;
    fireEvent.dragStart(header, { dataTransfer: { setData: vi.fn(), effectAllowed: "" } });
    fireEvent.dragEnter(second);
    fireEvent.dragOver(second);
    fireEvent.drop(second);
    expect(panelTitles()).toEqual(["🇺🇸 미국 · 종합", "🇰🇷 한국 · 종합"]);
  });

  it("switches the board to the headline wall and back, saving the choice", async () => {
    window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(twoPanels));
    renderDashboard();
    await panelLink(/기사 kr-yonhap-top/);
    await userEvent.click(screen.getByRole("button", { name: "헤드라인 벽" }));
    const wall = await screen.findByRole("region", { name: "헤드라인 벽" });
    expect(screen.queryAllByRole("article")).toHaveLength(0);
    expect(await within(wall).findByRole("link", { name: /기사 kr-yonhap-top/ })).toBeInTheDocument();
    expect(within(wall).getByRole("link", { name: /기사 us-nyt-top/ })).toBeInTheDocument();
    await waitFor(() => expect(savedLayout()?.boards?.[0].view).toBe("wall"));
    await userEvent.click(screen.getByRole("button", { name: "패널" }));
    expect(await screen.findAllByRole("article")).toHaveLength(2);
  });

  it("watches a keyword: highlights it in panels and counts mentions", async () => {
    window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(twoPanels));
    renderDashboard();
    await panelLink(/기사 kr-yonhap-top/);
    await userEvent.click(screen.getByRole("button", { name: "키워드 워치" }));
    await userEvent.type(screen.getByRole("textbox", { name: "키워드 추가" }), "yonhap{Enter}");
    expect(await panelLink(/기사 kr-yonhap-top/)).toHaveAttribute("data-watched", "true");
    expect(screen.getByRole("button", { name: "키워드 워치, 새 언급 1건" })).toBeInTheDocument();
    await waitFor(() => expect(savedLayout()?.watchKeywords).toEqual(["yonhap"]));
  });

  it("merges the same story from two panels into one row with an outlet count", async () => {
    fetchMock.mockImplementation((url: string) => {
      const ids = new URL(url, "http://localhost").searchParams.get("ids") ?? "";
      const [title, source] = ids.startsWith("kr") ? ["Iran closes Hormuz strait to tankers", "연합뉴스"] : ["Tankers halted as Iran shuts Hormuz strait", "NYT"];
      return respond({
        articles: [{ id: ids, title, link: `https://news.example.com/${ids}`, publishedAt: new Date().toISOString(), source }],
        errors: [],
        fetchedAt: new Date().toISOString(),
      });
    });
    window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(twoPanels));
    renderDashboard();
    expect(await panelLink(/Iran closes Hormuz/)).toHaveTextContent("+1개 매체");
  });
});
