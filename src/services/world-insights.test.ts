// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { Db } from "./supabase";
import { readWorldInsights } from "./world-insights";

const NOW = new Date("2026-10-19T12:30:00Z");
const ago = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

function fakeDb(data: Record<string, unknown[]>): Db & { queries: string[] } {
  const queries: string[] = [];
  return {
    queries,
    async select<T>(table: string, query: string) {
      queries.push(`${table}?${query}`);
      return (data[table] ?? []) as T[];
    },
    async upsert() {},
    async insert<T>() {
      return {} as T;
    },
    async update() {},
    async remove() {},
  };
}

const storyRow = {
  id: "s-1",
  lead_title: "Iran seizes tanker",
  lead_link: "https://bbc.example/1",
  image: "https://img/1.jpg",
  terms: ["hormuz", "tanker"],
  countries: ["GB", "US"],
  sources: ["BBC", "CNBC"],
  size: 3,
  score: 8,
  first_seen_at: ago(5),
  last_seen_at: ago(0.3),
  story_insights: {
    title_ko: "이란, 유조선 나포",
    summary_ko: ["a", "b"],
    why_ko: "w",
    perspectives: [{ country: "US", angle_ko: "유가", article_ids: ["a2"] }],
    model: "m",
    generated_at: ago(0.3),
  },
  story_entities: [{ entities: { id: "place:iran", name: "Iran", name_ko: "이란", type: "place" } }],
};

const articleRows = [
  { story_id: "s-1", articles: { id: "a1", title: "Iran seizes tanker", link: "https://bbc.example/1", source: "BBC", country: "GB", image: null, published_at: ago(0.2) } },
  { story_id: "s-1", articles: { id: "a2", title: "Oil jumps", link: "https://cnbc.example/1", source: "CNBC", country: "US", image: "https://img/2.jpg", published_at: ago(1.2) } },
  { story_id: "s-1", articles: null },
];

describe("readWorldInsights", () => {
  it("최근 실행 기준 사건 + AI 결과 + 기사 + 추세 + 나라별 수를 돌려준다", async () => {
    const db = fakeDb({
      pipeline_runs: [{ finished_at: ago(0.3), started_at: ago(0.35), stats: { countries: { GB: 10, US: 4 } } }],
      stories: [storyRow],
      story_articles: articleRows,
    });
    const out = await readWorldInsights(db, NOW);
    expect(out.updatedAt).toBe(ago(0.3));
    expect(out.countries).toEqual({ GB: 10, US: 4 });
    const [s] = out.stories;
    expect(s).toMatchObject({ id: "s-1", leadTitle: "Iran seizes tanker", size: 3, countries: ["GB", "US"] });
    expect(s.insight).toMatchObject({ title: "이란, 유조선 나포", perspectives: [{ country: "US", angle: "유가", articleIds: ["a2"] }] });
    expect(s.entities).toEqual([{ id: "place:iran", name: "Iran", nameKo: "이란", type: "place" }]);
    expect(s.articles.map((a) => a.id)).toEqual(["a1", "a2"]);
    expect(s.articles[1].image).toBe("https://img/2.jpg");
    expect(s.trend).toHaveLength(12);
    expect(s.trend.slice(-2)).toEqual([1, 1]);
  });

  it("AI 결과가 배열로 와도(관계 추론 차이) 첫 번째를 쓴다, 없으면 insight 없음", async () => {
    const db = fakeDb({
      pipeline_runs: [{ finished_at: ago(0.3), started_at: ago(0.35), stats: {} }],
      stories: [{ ...storyRow, story_insights: [storyRow.story_insights] }, { ...storyRow, id: "s-2", story_insights: [] }],
    });
    const out = await readWorldInsights(db, NOW);
    expect(out.stories[0].insight?.title).toBe("이란, 유조선 나포");
    expect(out.stories[1].insight).toBeUndefined();
  });

  it("실행 기록이 없으면 빈 결과", async () => {
    const out = await readWorldInsights(fakeDb({}), NOW);
    expect(out).toEqual({ updatedAt: null, stories: [], countries: {} });
  });

  it("최근 실행에서 본 사건만 고른다 (실행 시작 2시간 전 이후)", async () => {
    const db = fakeDb({ pipeline_runs: [{ finished_at: ago(1), started_at: ago(1.1), stats: {} }] });
    await readWorldInsights(db, NOW);
    const q = db.queries.find((x) => x.startsWith("stories?"))!;
    expect(q).toContain(`last_seen_at=gte.${new Date(NOW.getTime() - 3.1 * 3_600_000).toISOString()}`);
  });
});
