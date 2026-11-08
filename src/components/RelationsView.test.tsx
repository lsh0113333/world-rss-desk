import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorldBoard } from "@/types/world";
import { boardFixture } from "./__fixtures__/board";
import { RelationsView } from "./RelationsView";

const fetchMock = vi.fn();
const json = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } }));

const US = { id: "country:US", nameKo: "미국", kind: "country" as const };
const CN = { id: "country:CN", nameKo: "중국", kind: "country" as const };
const KR = { id: "country:KR", nameKo: "한국", kind: "country" as const };

function withRelations(): WorldBoard {
  return {
    ...boardFixture(),
    relations: {
      days: 7,
      pairs: [
        { a: CN, b: US, conflict: 8, cooperation: 1, temperature: -0.8, events: [{ id: "event:x", title: "미국, 중국 반도체 수출 통제 확대", type: "sanction", lastSeenAt: "2026-11-07T00:00:00Z" }] },
        { a: KR, b: US, conflict: 0, cooperation: 3, temperature: 1, events: [] },
      ],
      interest: { reporters: ["KR", "JP"], targets: ["US", "CN"], counts: [[32, 12], [5, 0]] },
    },
  };
}

function renderView() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}>
      <RelationsView />
    </SWRConfig>,
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("RelationsView", () => {
  it("관계 온도: 쌍마다 갈등·협력 수와 기울기, 누르면 근거 사건", async () => {
    fetchMock.mockImplementation(() => json(withRelations()));
    renderView();
    const list = await screen.findByRole("list", { name: "관계 온도" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("중국 ↔ 미국");
    expect(rows[0]).toHaveTextContent("갈등 8 · 협력 1");
    expect(rows[0]).toHaveTextContent("갈등");
    expect(rows[1]).toHaveTextContent("협력");
    expect(screen.queryByText("미국, 중국 반도체 수출 통제 확대")).not.toBeInTheDocument();
    await userEvent.click(within(rows[0]).getByRole("button"));
    expect(screen.getByText("미국, 중국 반도체 수출 통제 확대")).toBeInTheDocument();
  });

  it("나라끼리 관심: 보도 나라 × 일어난 나라 표", async () => {
    fetchMock.mockImplementation(() => json(withRelations()));
    renderView();
    const table = await screen.findByRole("table", { name: "나라끼리 관심" });
    expect(within(table).getByRole("columnheader", { name: "미국" })).toBeInTheDocument();
    const kr = within(table).getByRole("row", { name: /한국 매체/ });
    expect(within(kr).getAllByRole("cell").map((c) => c.textContent)).toEqual(["32", "12"]);
    expect(within(table).getByRole("row", { name: /일본 매체/ })).toHaveTextContent("–");
  });

  it("아직 관계가 없는 상황판이면 모으는 중이라고 알린다", async () => {
    fetchMock.mockImplementation(() => json(boardFixture()));
    renderView();
    expect(await screen.findByText(/관계를 모으는 중/)).toBeInTheDocument();
  });
});
