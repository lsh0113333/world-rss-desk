import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BOARD_PREFS_KEY } from "@/lib/board-prefs";
import { boardFixture } from "./__fixtures__/board";
import { WorldBoardView } from "./WorldBoardView";

const fetchMock = vi.fn();
const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));

function renderBoard() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}>
      <WorldBoardView />
    </SWRConfig>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  fetchMock.mockReset();
  fetchMock.mockImplementation(() => json(boardFixture()));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("WorldBoardView", () => {
  it("답 먼저: 큰 흐름, 세계 5, IT 5, 대륙별", async () => {
    renderBoard();
    const flows = await screen.findByRole("region", { name: "지금 흐름" });
    expect(within(flows).getByRole("button", { name: /우크라이나 전쟁/ })).toBeInTheDocument();
    expect(within(flows).getByRole("button", { name: /AI 경쟁/ })).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "세계 5" })).getByRole("button", { name: /흑해에서 화물선 침몰/ })).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "IT 5" })).getByRole("button", { name: /대한항공 예약시스템 해킹/ })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "유럽" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/world");
  });

  it("스포츠·연예는 세계 5에 없고 대륙별에는 있다", async () => {
    renderBoard();
    const world = await screen.findByRole("region", { name: "세계 5" });
    expect(within(world).queryByRole("button", { name: /뮌헨 감독/ })).not.toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "유럽" })).getAllByRole("button", { name: /뮌헨 감독/ }).length).toBeGreaterThan(0);
  });

  it("처음에는 제목만, 누르면 요약·왜 이 순위·관계·근거가 펼쳐진다", async () => {
    renderBoard();
    const world = await screen.findByRole("region", { name: "세계 5" });
    expect(within(world).queryByText(/흑해에서 화물선 침몰 요약/)).not.toBeInTheDocument();
    const row = within(world).getByRole("button", { name: /흑해에서 화물선 침몰/ });
    expect(row).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(row);
    expect(row).toHaveAttribute("aria-expanded", "true");

    expect(within(world).getByText("흑해에서 화물선 침몰 요약 문장.")).toBeInTheDocument();
    // 왜 이 순위?
    expect(within(world).getByText(/보도 규모/)).toHaveTextContent("× 무력 충돌 1.75");
    // 관계로 보기
    expect(within(world).getByText("러시아 ─무력 충돌→ 우크라이나")).toBeInTheDocument();
    // 행위자 페이지 링크
    expect(within(world).getByRole("link", { name: "러시아" })).toHaveAttribute("href", `/actors/${encodeURIComponent("country:RU")}`);
    // 근거 기사는 원문을 새 탭으로
    const evidence = within(world).getByRole("link", { name: /원문 제목 1/ });
    expect(evidence).toHaveAttribute("target", "_blank");
    expect(evidence).toHaveAttribute("rel", "noopener noreferrer");
    expect(evidence).toHaveAttribute("href", "https://news.example/1");
    // 연관 사건
    expect(within(world).getByRole("button", { name: /올레슈키 국지 휴전 합의.*우크라이나 전쟁/ })).toBeInTheDocument();

    await userEvent.click(row);
    expect(within(world).queryByText("흑해에서 화물선 침몰 요약 문장.")).not.toBeInTheDocument();
  });

  it("연관 사건을 누르면 그 자리에서 펼친다", async () => {
    renderBoard();
    const world = await screen.findByRole("region", { name: "세계 5" });
    await userEvent.click(within(world).getByRole("button", { name: /흑해에서 화물선 침몰/ }));
    await userEvent.click(within(world).getByRole("button", { name: /올레슈키 국지 휴전 합의.*우크라이나 전쟁/ }));
    expect(within(world).getByText("올레슈키 국지 휴전 합의 요약 문장.")).toBeInTheDocument();
  });

  it("큰 흐름을 누르면 그 흐름의 사건을 보여 주고, 조용한 흐름은 조용하다고 한다", async () => {
    renderBoard();
    const flows = await screen.findByRole("region", { name: "지금 흐름" });
    expect(within(flows).getByRole("button", { name: /한반도/ })).toHaveTextContent("조용");
    await userEvent.click(within(flows).getByRole("button", { name: /우크라이나 전쟁/ }));
    expect(within(flows).getByRole("button", { name: /올레슈키 국지 휴전 합의/ })).toBeInTheDocument();
  });

  it("갱신 시각을 보여 주고, 지난 방문 이후 새 사건을 표시한다", async () => {
    const lastVisit = new Date(Date.now() - 60 * 60_000).toISOString();
    window.localStorage.setItem(BOARD_PREFS_KEY, JSON.stringify({ lastVisitAt: lastVisit, previousVisitAt: null }));
    renderBoard();
    expect(await screen.findByText(/전 갱신|방금 전 갱신/)).toBeInTheDocument();
    expect(await screen.findByText("지난 방문 이후 새 사건 1개")).toBeInTheDocument();
    const world = screen.getByRole("region", { name: "세계 5" });
    expect(within(within(world).getByRole("button", { name: /흑해에서 화물선 침몰/ })).getByText("새")).toBeInTheDocument();
    await waitFor(() => expect(JSON.parse(window.localStorage.getItem(BOARD_PREFS_KEY)!).previousVisitAt).toBe(lastVisit));
  });

  it("첫 방문에는 새 사건 표시가 없다", async () => {
    renderBoard();
    await screen.findByRole("region", { name: "세계 5" });
    expect(screen.queryByText(/지난 방문 이후/)).not.toBeInTheDocument();
  });

  it("상황판이 오래되면 알린다", async () => {
    const old = boardFixture();
    old.generatedAt = new Date(Date.now() - 3 * 3_600_000).toISOString();
    fetchMock.mockImplementation(() => json(old));
    renderBoard();
    expect(await screen.findByText(/갱신이 늦어지고 있어요/)).toBeInTheDocument();
  });

  it("온톨로지 페이지로 가는 링크", async () => {
    renderBoard();
    expect(await screen.findByRole("link", { name: "온톨로지" })).toHaveAttribute("href", "/ontology");
  });

  it("아직 없으면 준비 중, 실패하면 다시 시도", async () => {
    fetchMock.mockImplementation(() => json({ error: "x" }, 503));
    const { unmount } = renderBoard();
    expect(await screen.findByText("첫 상황판을 만드는 중이에요")).toBeInTheDocument();
    unmount();

    fetchMock.mockImplementation(() => json({ error: "x" }, 502));
    renderBoard();
    expect(await screen.findByText("세계 상황을 불러오지 못했습니다")).toBeInTheDocument();
    fetchMock.mockImplementation(() => json(boardFixture()));
    await userEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(await screen.findByRole("region", { name: "세계 5" })).toBeInTheDocument();
  });
});
