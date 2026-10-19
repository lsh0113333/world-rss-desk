import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { WorldInsights, WorldStory } from "@/types/world";
import { WorldView } from "./WorldView";

const NOW = new Date("2026-10-19T12:30:00Z");
const ago = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

function story(over: Partial<WorldStory> = {}): WorldStory {
  return {
    id: "s-1",
    leadTitle: "Iran seizes tanker near Hormuz",
    image: "https://img.example/1.jpg",
    terms: ["hormuz"],
    countries: ["GB", "US", "ME"],
    sources: ["BBC", "CNBC", "Al Jazeera"],
    size: 3,
    firstSeenAt: ago(5),
    lastSeenAt: ago(0.2),
    trend: [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1],
    rising: false,
    entities: [],
    articles: [
      { id: "a1", title: "Iran seizes tanker near Hormuz", link: "https://bbc.example/1", source: "BBC", country: "GB", publishedAt: ago(0.2) },
      { id: "a2", title: "Oil jumps after seizure", link: "https://cnbc.example/1", source: "CNBC", country: "US", publishedAt: ago(1.2) },
      { id: "a3", title: "Tehran says tanker broke rules", link: "https://aj.example/1", source: "Al Jazeera", country: "ME", publishedAt: ago(2.2) },
    ],
    ...over,
  };
}

const withInsight = story({
  rising: true,
  insight: {
    title: "이란, 호르무즈서 유조선 나포",
    summary: ["이란이 유조선을 나포했다.", "유가가 올랐다.", "긴장이 커지고 있다."],
    why: "한국 원유 수입의 길목이다.",
    perspectives: [
      { country: "US", angle: "유가·시장 영향에 집중", articleIds: ["a2"] },
      { country: "ME", angle: "이란 측 주장 전달", articleIds: ["a3"] },
    ],
    model: "gemini-flash-lite-latest",
    generatedAt: ago(0.2),
  },
  entities: [{ id: "place:iran", name: "Iran", nameKo: "이란", type: "place" }],
});

const other = story({ id: "s-2", leadTitle: "Korea chip exports surge", countries: ["KR", "JP"], sources: ["Yonhap", "Nikkei"], articles: [] });

const data: WorldInsights = { updatedAt: ago(0.3), stories: [withInsight, other], countries: { GB: 40, US: 30, KR: 10, ME: 5 } };

function setup(props: Partial<Parameters<typeof WorldView>[0]> = {}) {
  const onSelect = vi.fn();
  render(<WorldView data={data} loading={false} now={NOW} readIds={new Set()} onSelect={onSelect} {...props} />);
  return { onSelect, user: userEvent.setup() };
}

describe("WorldView", () => {
  it("사건 카드: AI 한국어 제목, 없으면 원문 대표 제목", () => {
    setup();
    expect(screen.getByRole("button", { name: /이란, 호르무즈서 유조선 나포/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Korea chip exports surge/ })).toBeInTheDocument();
  });

  it("카드에 나라 수·매체 수, 급상승 표시, 요약 첫 줄", () => {
    setup();
    const card = screen.getByRole("button", { name: /이란, 호르무즈서 유조선 나포/ });
    expect(within(card).getByText(/3개 나라 · 매체 3곳/)).toBeInTheDocument();
    expect(within(card).getByText("급상승")).toBeInTheDocument();
    expect(within(card).getByText("이란이 유조선을 나포했다.")).toBeInTheDocument();
  });

  it("업데이트 시각을 보여 준다", () => {
    setup();
    expect(screen.getByText(/업데이트/)).toHaveTextContent("18분 전");
  });

  it("지도에서 나라를 누르면 그 나라가 다루는 사건만 보이고, 다시 누르면 전체", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: /한국 기사 10건/ }));
    expect(screen.queryByRole("button", { name: /이란, 호르무즈서/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Korea chip exports surge/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /한국 기사 10건/ }));
    expect(screen.getByRole("button", { name: /이란, 호르무즈서/ })).toBeInTheDocument();
  });

  it("사건을 누르면 요약·왜 중요한가·나라별 시각·엔티티가 있는 상세가 열린다", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: /이란, 호르무즈서 유조선 나포/ }));
    const dialog = screen.getByRole("dialog", { name: /이란, 호르무즈서 유조선 나포/ });
    expect(within(dialog).getByText("유가가 올랐다.")).toBeInTheDocument();
    expect(within(dialog).getByText("한국 원유 수입의 길목이다.")).toBeInTheDocument();
    expect(within(dialog).getByText("유가·시장 영향에 집중")).toBeInTheDocument();
    expect(within(dialog).getByText("이란 측 주장 전달")).toBeInTheDocument();
    expect(within(dialog).getByText("이란")).toBeInTheDocument();
    expect(within(dialog).getByText(/AI가 헤드라인을 바탕으로/)).toBeInTheDocument();
  });

  it("상세에서 근거 기사를 누르면 같은 사건의 다른 기사와 함께 연다", async () => {
    const { user, onSelect } = setup();
    await user.click(screen.getByRole("button", { name: /이란, 호르무즈서 유조선 나포/ }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getAllByRole("button", { name: /Oil jumps after seizure/ })[0]);
    const [article, related] = onSelect.mock.calls[0];
    expect(article).toMatchObject({ id: "a2", title: "Oil jumps after seizure", link: "https://cnbc.example/1", source: "CNBC" });
    expect(related.map((a: { id: string }) => a.id)).toEqual(["a1", "a3"]);
  });

  it("AI 결과가 없는 사건은 나라별 기사 목록만", async () => {
    const { user } = setup({ data: { ...data, stories: [story()] } });
    await user.click(screen.getByRole("button", { name: /Iran seizes tanker near Hormuz/ }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/AI 요약 준비 중/)).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: /미국/ })).toBeInTheDocument();
  });

  it("아직 분석 결과가 없으면 안내", () => {
    setup({ data: { updatedAt: null, stories: [], countries: {} } });
    expect(screen.getByText(/첫 분석을 기다리는 중/)).toBeInTheDocument();
  });

  it("불러오기 실패", () => {
    setup({ data: undefined, error: new Error("x") });
    expect(screen.getByText(/세계 흐름을 불러오지 못했습니다/)).toBeInTheDocument();
  });
});
