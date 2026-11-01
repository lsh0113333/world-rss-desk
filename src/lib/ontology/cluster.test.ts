import { describe, expect, it } from "vitest";
import type { PipelineArticle } from "@/types/world";
import { findClusters, planClusters, type Cluster } from "./cluster";

const NOW = new Date("2026-11-01T12:00:00Z");
let seq = 0;
function art(title: string, source: string, country: string, category: PipelineArticle["category"] = "top"): PipelineArticle {
  seq++;
  return {
    id: `a${seq}`,
    link: `https://${source}.example/${seq}`,
    title,
    source,
    feedId: `f-${source}`,
    country,
    continent: "x",
    category,
    publishedAt: new Date(NOW.getTime() - seq * 60_000).toISOString(),
  };
}

describe("findClusters", () => {
  const world = [
    art("Marseille bans protests as riots spread", "france24", "FR"),
    art("Riots: Marseille bans gatherings, curfew considered", "bbc", "GB"),
    art("Marseille protests ban after nights of riots", "cnn", "US"),
  ];
  const domestic = [art("서울 지하철 요금 인상안 시의회 통과", "연합", "KR"), art("서울 지하철 요금 인상안 시의회 통과 논란", "한경", "KR")];
  const tech = [art("OpenAI launches Sora video editor", "verge", "US", "tech"), art("Sora video editor from OpenAI debuts", "wired", "US", "tech")];
  const noise = [art("Local bakery wins award", "local", "GB")];

  it("세계 → IT → 나라 순으로 찾고, 기사 하나는 묶음 하나에만", () => {
    const clusters = findClusters([...world, ...domestic, ...tech, ...noise]);
    expect(clusters.map((c) => c.scope)).toEqual(["world", "it", "country"]);
    const ids = clusters.flatMap((c) => c.articles.map((a) => a.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain(noise[0].id);
    expect(clusters[1].articles.map((a) => a.id).sort()).toEqual(tech.map((a) => a.id).sort());
    expect(clusters[2].articles.map((a) => a.id).sort()).toEqual(domestic.map((a) => a.id).sort());
  });

  it("묶음 이름은 내용이 같으면 같다", () => {
    const a = findClusters(world);
    const b = findClusters(world);
    expect(a[0].key).toBe(b[0].key);
  });
});

describe("planClusters", () => {
  const a = (id: string, source: string) => ({ id, title: id, source, country: "US", publishedAt: NOW.toISOString() });
  const cluster = (key: string, articles: Cluster["articles"]): Cluster => ({ key, scope: "world", rank: 10, articles });

  it("처음 보는 묶음은 AI에 보낸다", () => {
    const plan = planClusters([cluster("c", [a("1", "x"), a("2", "y")])], new Map(), new Set(), new Map(), NOW);
    expect(plan.extract.map((c) => c.key)).toEqual(["c"]);
    expect(plan.attach).toEqual([]);
    expect(plan.refresh).toEqual([]);
  });

  it("이미 사건이 있는 묶음은 AI 없이 새 기사를 가장 큰 사건에 붙인다", () => {
    const assigned = new Map([
      ["1", "e1"],
      ["2", "e1"],
      ["3", "e2"],
    ]);
    const plan = planClusters([cluster("c", [a("1", "x"), a("2", "y"), a("3", "z"), a("4", "w")])], assigned, new Set(), new Map(), NOW);
    expect(plan.extract).toEqual([]);
    expect(plan.attach).toEqual([{ articleId: "4", eventId: "e1" }]);
  });

  it("AI에 보냈는데 사건이 아니었던 기사는 다시 보내지 않는다", () => {
    const plan = planClusters([cluster("c", [a("1", "x"), a("2", "y")])], new Map(), new Set(["1", "2"]), new Map(), NOW);
    expect(plan.extract).toEqual([]);
  });

  it("새 기사가 있어도 아직 안 보낸 기사의 매체가 2곳 미만이면 보내지 않는다", () => {
    const plan = planClusters([cluster("c", [a("1", "x"), a("2", "y"), a("3", "y")])], new Map(), new Set(["1"]), new Map(), NOW);
    expect(plan.extract).toEqual([]);
    const plan2 = planClusters([cluster("c", [a("1", "x"), a("2", "y"), a("3", "z")])], new Map(), new Set(["1"]), new Map(), NOW);
    expect(plan2.extract[0].articles.map((x) => x.id)).toEqual(["2", "3"]);
  });

  it("사건이 2배 넘게 커졌고 6시간이 지났으면 다시 정리한다", () => {
    const assigned = new Map([
      ["1", "e1"],
      ["2", "e1"],
    ]);
    const old = new Date(NOW.getTime() - 7 * 3_600_000).toISOString();
    const articles = [a("1", "x"), a("2", "y"), a("3", "z"), a("4", "w")];
    const stale = planClusters([cluster("c", articles)], assigned, new Set(), new Map([["e1", { extractedSize: 2, extractedAt: old }]]), NOW);
    expect(stale.refresh.map((r) => r.eventId)).toEqual(["e1"]);

    const recent = planClusters([cluster("c", articles)], assigned, new Set(), new Map([["e1", { extractedSize: 2, extractedAt: NOW.toISOString() }]]), NOW);
    expect(recent.refresh).toEqual([]);
    const notGrown = planClusters([cluster("c", articles)], assigned, new Set(), new Map([["e1", { extractedSize: 3, extractedAt: old }]]), NOW);
    expect(notGrown.refresh).toEqual([]);
  });

  it("중요한 묶음부터 정해진 수만 보낸다", () => {
    const small = { ...cluster("small", [a("1", "x"), a("2", "y")]), rank: 1 };
    const big = { ...cluster("big", [a("3", "x"), a("4", "y")]), rank: 9 };
    const plan = planClusters([small, big], new Map(), new Set(), new Map(), NOW, { maxExtract: 1 });
    expect(plan.extract.map((c) => c.key)).toEqual(["big"]);
  });
});
