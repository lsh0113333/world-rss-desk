import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { boardFixture } from "./__fixtures__/board";
import { OntologyView } from "./OntologyView";

const fetchMock = vi.fn();
const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));

function renderView() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}>
      <OntologyView />
    </SWRConfig>,
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(() => json(boardFixture()));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const worldNames = () =>
  within(screen.getByRole("list", { name: "실험 결과 세계 5" }))
    .getAllByRole("listitem")
    .map((li) => li.textContent ?? "");

describe("OntologyView", () => {
  it("순환 단계와 실제 숫자를 보여 준다", async () => {
    renderView();
    const flow = await screen.findByRole("region", { name: "시스템이 도는 순서" });
    expect(within(flow).getByText(/기사 6,700건/)).toBeInTheDocument();
    expect(within(flow).getByText(/묶음 109개/)).toBeInTheDocument();
  });

  it("객체·관계 종류와 개수, 누가 만들었는지", async () => {
    renderView();
    const model = await screen.findByRole("region", { name: "객체와 관계" });
    const event = within(model).getByRole("row", { name: /사건/ });
    expect(event).toHaveTextContent("78");
    expect(within(model).getByRole("row", { name: /보도/ })).toHaveTextContent("900");
    const made = screen.getByRole("region", { name: "누가 만들었나" });
    expect(made).toHaveTextContent("AI 읽기700");
    expect(made).toHaveTextContent("규칙300");
  });

  it("유형 배수를 바꾸면 세계 5 순위가 다시 계산되고, 되돌릴 수 있다", async () => {
    renderView();
    await screen.findByRole("region", { name: "규칙 실험" });
    const before = worldNames();
    expect(before[0]).toContain("흑해에서 화물선 침몰");
    const slider = screen.getByRole("slider", { name: "기업·기술 배수" });
    expect(slider).toHaveValue("2");
    fireEvent.change(screen.getByRole("slider", { name: "무력 충돌 배수" }), { target: { value: "0" } });
    expect(worldNames()[0]).not.toContain("흑해에서 화물선 침몰");
    await userEvent.click(screen.getByRole("button", { name: "원래 규칙으로" }));
    expect(worldNames()).toEqual(before);
  });

  it("규칙 파일과 직접 해 볼 쿼리를 안내한다", async () => {
    renderView();
    const study = await screen.findByRole("region", { name: "직접 해 보기" });
    expect(study).toHaveTextContent("src/ontology/world.ts");
    expect(study).toHaveTextContent("select");
    expect(screen.getByRole("link", { name: "오늘의 세계" })).toHaveAttribute("href", "/");
  });

  it("실패해도 설정 부분은 보인다", async () => {
    fetchMock.mockImplementation(() => json({ error: "x" }, 502));
    renderView();
    expect(await screen.findByRole("region", { name: "객체와 관계" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "판단 규칙" })).toHaveTextContent("3");
  });
});
