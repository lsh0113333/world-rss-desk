import { describe, expect, it } from "vitest";
import type { PipelineArticle } from "@/types/world";
import { assignStoryIds, buildStories, toPipelineItems } from "./stories";

const NOW = new Date("2026-10-19T12:00:00Z");

let seq = 0;
function art(title: string, source: string, country: string, extra: Partial<PipelineArticle> = {}): PipelineArticle {
  seq++;
  return {
    id: `a${seq}`,
    link: `https://${source.toLowerCase().replace(/\s/g, "")}.example/${seq}`,
    title,
    source,
    feedId: `${country.toLowerCase()}-feed`,
    country,
    continent: "asia",
    category: "world",
    publishedAt: new Date(NOW.getTime() - seq * 60_000).toISOString(),
    ...extra,
  };
}

const hormuz = [
  art("Iran seizes tanker near Hormuz strait", "BBC", "GB"),
  art("Tanker seized in Hormuz, Iran says", "Al Jazeera", "ME", { image: "https://img.example/h.jpg" }),
  art("Oil jumps after Hormuz tanker seizure by Iran", "CNBC", "US"),
  art("Hormuz tension: Iran tanker move rattles Asia", "Straits Times", "SG"),
];
const filler = [
  art("Local bakery wins award", "Daily A", "GB"),
  art("Football club signs striker", "Daily B", "US"),
  art("Rain expected over weekend", "Daily C", "SG"),
  art("New museum opens downtown", "Daily D", "ME"),
  art("City council debates parking", "Daily E", "GB"),
];

describe("toPipelineItems", () => {
  it("파이프라인 기사를 분석 입력으로 바꾸고 나라·분야를 보존한다", () => {
    const [item] = toPipelineItems([hormuz[0]]);
    expect(item.article).toMatchObject({ id: hormuz[0].id, title: hormuz[0].title, source: "BBC" });
    expect(item.country).toBe("GB");
    expect(item.category).toBe("world");
    expect(item.panelId).toBe("gb-feed");
  });
});

describe("buildStories", () => {
  it("여러 나라 매체가 함께 다루는 사건을 사건으로 만든다", () => {
    const stories = buildStories([...hormuz, ...filler], NOW);
    expect(stories.length).toBeGreaterThanOrEqual(1);
    const s = stories[0];
    expect(s.articleIds).toEqual(expect.arrayContaining(hormuz.map((a) => a.id)));
    expect(s.countries).toEqual(expect.arrayContaining(["GB", "ME", "US", "SG"]));
    expect(s.sources).toHaveLength(4);
    expect(s.terms.length).toBeGreaterThan(0);
  });

  it("대표 이미지는 사건 기사 중 이미지가 있는 것", () => {
    const [s] = buildStories([...hormuz, ...filler], NOW);
    expect(s.image).toBe("https://img.example/h.jpg");
  });

  it("점수는 나라가 많을수록 높다", () => {
    const [s] = buildStories([...hormuz, ...filler], NOW);
    expect(s.score).toBeGreaterThan(0);
  });

  it("기사가 없으면 빈 목록", () => {
    expect(buildStories([], NOW)).toEqual([]);
  });
});

describe("assignStoryIds", () => {
  const draft = () => buildStories([...hormuz, ...filler], NOW)[0];

  it("이전 사건과 기사가 충분히 겹치면 같은 id를 이어 쓴다", () => {
    const prev = [{ id: "s-old", articleIds: [hormuz[0].id, hormuz[1].id], terms: ["something"] }];
    const [s] = assignStoryIds([draft()], prev, NOW);
    expect(s.id).toBe("s-old");
  });

  it("키워드가 겹치면 기사가 달라도 같은 사건으로 본다", () => {
    const d = draft();
    const prev = [{ id: "s-terms", articleIds: ["zzz"], terms: d.terms }];
    expect(assignStoryIds([d], prev, NOW)[0].id).toBe("s-terms");
  });

  it("겹치는 것이 없으면 새 id (날짜 + 키워드 해시)", () => {
    const [s] = assignStoryIds([draft()], [{ id: "s-x", articleIds: ["q"], terms: ["unrelated"] }], NOW);
    expect(s.id).toMatch(/^s-20261019-[a-z0-9]+$/);
  });

  it("이전 사건 하나는 한 번만 이어 쓴다", () => {
    const d = draft();
    const prev = [{ id: "s-old", articleIds: d.articleIds, terms: d.terms }];
    const out = assignStoryIds([d, { ...d, terms: [...d.terms] }], prev, NOW);
    expect(out.map((s) => s.id).filter((id) => id === "s-old")).toHaveLength(1);
    expect(new Set(out.map((s) => s.id)).size).toBe(2);
  });
});
