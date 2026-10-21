import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NEWSSTAND_PREFS_KEY } from "@/lib/newsstand-prefs";
import { READ_KEY } from "@/lib/read-history";
import type { FrontResponse } from "@/types/front";
import { Newsstand } from "./Newsstand";

const fetchMock = vi.fn();
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

const front: FrontResponse = {
  fetchedAt: minutesAgo(1),
  errors: [],
  continents: [
    {
      id: "asia",
      label: "아시아",
      countries: [
        {
          code: "KR",
          name: "한국",
          timeZone: "Asia/Seoul",
          outlets: [
            {
              name: "연합뉴스",
              homepage: "https://www.yna.co.kr",
              language: "ko",
              items: [
                { id: "y1", title: "반도체 수출 급증", link: "https://yna.example/1", publishedAt: minutesAgo(5) },
                { id: "y2", title: "국회 본회의 개최", link: "https://yna.example/2", publishedAt: minutesAgo(40) },
              ],
            },
            {
              name: "한국경제",
              homepage: "https://www.hankyung.com",
              language: "ko",
              items: [
                { id: "h1", title: "코스피 상승 마감", link: "https://hk.example/1", publishedAt: minutesAgo(90) },
                { id: "h2", title: "환율 하락", link: "https://hk.example/2", publishedAt: minutesAgo(120) },
                { id: "h3", title: "금리 동결", link: "https://hk.example/3", publishedAt: minutesAgo(130) },
                { id: "h4", title: "네 번째 기사", link: "https://hk.example/4", publishedAt: minutesAgo(140) },
              ],
            },
          ],
        },
      ],
    },
    {
      id: "europe",
      label: "유럽",
      countries: [
        {
          code: "GB",
          name: "영국",
          timeZone: "Europe/London",
          outlets: [{ name: "BBC News", homepage: "https://www.bbc.co.uk", language: "en", items: [{ id: "b1", title: "UK budget", link: "https://bbc.example/1", publishedAt: minutesAgo(10) }] }],
        },
      ],
    },
  ],
};

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));

function renderNewsstand() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}>
      <Newsstand />
    </SWRConfig>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  fetchMock.mockReset();
  fetchMock.mockImplementation(() => json(front));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Newsstand", () => {
  it("대륙 바로가기와 대륙 → 나라 → 매체 → 제목을 한 페이지에 보여 준다", async () => {
    renderNewsstand();
    const nav = await screen.findByRole("navigation", { name: "대륙 바로가기" });
    expect(within(nav).getByRole("link", { name: "아시아" })).toHaveAttribute("href", "#asia");
    expect(within(nav).getByRole("link", { name: "유럽" })).toHaveAttribute("href", "#europe");

    const asia = screen.getByRole("region", { name: "아시아" });
    const korea = within(asia).getByRole("article", { name: "한국" });
    expect(within(korea).getByText("연합뉴스", { selector: ".outlet-name" })).toBeInTheDocument();
    expect(within(korea).getByText("한국경제", { selector: ".outlet-name" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "유럽" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/front");
  });

  it("나라마다 가장 최근 기사를 1면으로 크게, 같은 기사는 아래에 다시 나오지 않는다", async () => {
    renderNewsstand();
    const korea = await screen.findByRole("article", { name: "한국" });
    const lead = within(korea).getByRole("link", { name: /반도체 수출 급증/ });
    expect(lead).toHaveAttribute("data-lead", "true");
    expect(within(korea).getAllByRole("link", { name: /반도체 수출 급증/ })).toHaveLength(1);
  });

  it("매체마다 최신 3개까지만 (1면을 낸 매체는 1면 + 2개)", async () => {
    renderNewsstand();
    const korea = await screen.findByRole("article", { name: "한국" });
    expect(within(korea).getByRole("link", { name: /금리 동결/ })).toBeInTheDocument();
    expect(within(korea).queryByRole("link", { name: /네 번째 기사/ })).not.toBeInTheDocument();
  });

  it("제목은 원문을 새 탭으로 열고, 누르면 읽음으로 저장한다", async () => {
    renderNewsstand();
    const korea = await screen.findByRole("article", { name: "한국" });
    const link = within(korea).getByRole("link", { name: /코스피 상승 마감/ });
    expect(link).toHaveAttribute("href", "https://hk.example/1");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    link.addEventListener("click", (e) => e.preventDefault());
    await userEvent.click(link);
    await waitFor(() => expect(link).toHaveAttribute("data-read", "true"));
    expect(JSON.parse(window.localStorage.getItem(READ_KEY) ?? "[]")).toContain("h1");
  });

  it("읽은 기록이 있으면 처음부터 흐리게", async () => {
    window.localStorage.setItem(READ_KEY, JSON.stringify(["h2"]));
    renderNewsstand();
    const korea = await screen.findByRole("article", { name: "한국" });
    await waitFor(() => expect(within(korea).getByRole("link", { name: /환율 하락/ })).toHaveAttribute("data-read", "true"));
  });

  it("대륙을 접으면 저장되고, 다시 열어도 접혀 있다", async () => {
    const { unmount } = renderNewsstand();
    await userEvent.click(await screen.findByRole("button", { name: "유럽 접기" }));
    expect(screen.queryByRole("article", { name: "영국" })).not.toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(NEWSSTAND_PREFS_KEY) ?? "{}")).toEqual({ folded: ["europe"] });
    unmount();

    renderNewsstand();
    expect(await screen.findByRole("button", { name: "유럽 펼치기" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("article", { name: "영국" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "유럽 펼치기" }));
    expect(screen.getByRole("article", { name: "영국" })).toBeInTheDocument();
  });

  it("불러오지 못하면 안내와 다시 시도", async () => {
    fetchMock.mockImplementation(() => json({ error: "뉴스를 불러오지 못했습니다" }, 502));
    renderNewsstand();
    expect(await screen.findByText("뉴스를 불러오지 못했습니다")).toBeInTheDocument();
    fetchMock.mockImplementation(() => json(front));
    await userEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(await screen.findByRole("article", { name: "한국" })).toBeInTheDocument();
  });
});
