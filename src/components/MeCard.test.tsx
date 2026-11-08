import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BOARD_ME_KEY } from "@/lib/board-prefs";
import { boardFixture } from "./__fixtures__/board";

/** 나에게 걸리려면 2개 나라 이상이 보도해야 한다 (ME_RULES.minCountries) */
function board() {
  const b = boardFixture();
  for (const e of b.events) if (e.reporting.length < 2) e.reporting = [...e.reporting, "US"];
  return b;
}
import { WorldBoardView } from "./WorldBoardView";

const fetchMock = vi.fn();
const json = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } }));

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
  fetchMock.mockImplementation(() => json(board()));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const card = () => screen.findByRole("region", { name: "나에게 한 문장" });

describe("나에게 한 문장", () => {
  it("처음엔 내 상황을 물어보고, 고르면 바로 한 문장과 저장", async () => {
    renderBoard();
    const region = await card();
    await userEvent.click(within(region).getByRole("button", { name: "내 상황 정하기" }));
    await userEvent.click(within(region).getByRole("checkbox", { name: /IT 업무/ }));
    await userEvent.click(within(region).getByRole("button", { name: "완료" }));
    expect(within(region).getByText(/^사이버 보안: 대한항공 예약시스템 해킹 소식이 있어요\(\d+개 나라 보도\)\. 연계 시스템의 접속 기록과 인증서를 점검해 보세요\.$/)).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(BOARD_ME_KEY)!)).toEqual({ situations: ["it-work"], trips: [] });
  });

  it("해외 일정 나라에 위험한 일이 있으면 안전 문장이 먼저, 근거를 펼치면 규칙과 사건", async () => {
    window.localStorage.setItem(BOARD_ME_KEY, JSON.stringify({ situations: ["it-work", "travel"], trips: [{ country: "UA" }] }));
    renderBoard();
    const region = await card();
    const main = await within(region).findByText(/^가시는 우크라이나에서 흑해에서 화물선 침몰 소식이 있어요/);
    expect(main).toHaveTextContent("외교부 해외안전여행 경보를 확인하고 일정을 다시 보세요.");
    expect(within(region).getByText(/^사이버 보안: 대한항공/)).toBeInTheDocument();
    await userEvent.click(within(region).getAllByRole("button", { name: "근거 보기" })[0]);
    expect(within(region).getByText(/왜 이 문장: 해외 일정\(우크라이나\) × 무력 충돌 → 규칙 travel-conflict/)).toBeInTheDocument();
    expect(within(region).getByRole("button", { name: /흑해에서 화물선 침몰/ })).toBeInTheDocument();
  });

  it("해외 일정을 편집기에서 추가한다", async () => {
    renderBoard();
    const region = await card();
    await userEvent.click(within(region).getByRole("button", { name: "내 상황 정하기" }));
    await userEvent.click(within(region).getByRole("checkbox", { name: /해외 일정/ }));
    await userEvent.selectOptions(within(region).getByRole("combobox", { name: "가는 나라" }), "UA");
    await userEvent.click(within(region).getByRole("button", { name: "일정 추가" }));
    expect(within(region).getByRole("list", { name: "해외 일정" })).toHaveTextContent("우크라이나");
    await userEvent.click(within(region).getByRole("button", { name: "완료" }));
    expect(within(region).getByText(/^가시는 우크라이나에서/)).toBeInTheDocument();
  });

  it("걸리는 일이 없으면 그렇다고 말한다", async () => {
    window.localStorage.setItem(BOARD_ME_KEY, JSON.stringify({ situations: ["travel"], trips: [{ country: "BR" }] }));
    renderBoard();
    const region = await card();
    expect(await within(region).findByText("지금 내 상황에 걸리는 큰 일은 없어요.")).toBeInTheDocument();
  });
});
