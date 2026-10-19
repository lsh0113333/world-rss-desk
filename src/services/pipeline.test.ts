// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { CatalogFeed } from "@/types/catalog";
import type { Article } from "@/types/article";
import type { Db } from "./supabase";
import { articleKey, runPipeline } from "./pipeline";

const NOW = new Date("2026-10-19T12:30:00Z");
const ago = (min: number) => new Date(NOW.getTime() - min * 60_000).toISOString();

const feed = (id: string, country: string, name: string): CatalogFeed => ({
  id,
  name,
  url: `https://${id}.example/rss`,
  homepage: `https://${id}.example`,
  continent: "global",
  country,
  category: "world",
  language: "en",
});

const FEEDS = [feed("gb-bbc", "GB", "BBC"), feed("us-cnbc", "US", "CNBC"), feed("me-aj", "ME", "Al Jazeera"), feed("sg-st", "SG", "Straits Times")];

const FEED_ARTICLES: Record<string, Article[]> = {
  "gb-bbc": [
    { id: "1", title: "Iran seizes tanker near Hormuz strait", link: "https://bbc.example/1", publishedAt: ago(10), source: "BBC" },
    { id: "x", title: "Local bakery wins award", link: "https://bbc.example/2", publishedAt: ago(20), source: "BBC" },
    { id: "old", title: "Very old Hormuz story", link: "https://bbc.example/old", publishedAt: ago(60 * 24 * 5), source: "BBC" },
    { id: "nodate", title: "No date Hormuz", link: "https://bbc.example/nd", publishedAt: null, source: "BBC" },
  ],
  "us-cnbc": [{ id: "2", title: "Oil jumps after Hormuz tanker seizure by Iran", link: "https://cnbc.example/1", publishedAt: ago(15), source: "CNBC" }],
  "me-aj": [{ id: "3", title: "Tanker seized in Hormuz, Iran says", link: "https://aj.example/1", publishedAt: ago(30), source: "Al Jazeera", image: "https://img/1.jpg" }],
  "sg-st": [
    { id: "4", title: "Hormuz tension: Iran tanker move rattles Asia", link: "https://st.example/1", publishedAt: ago(40), source: "Straits Times" },
    { id: "5", title: "Rain expected over weekend", link: "https://st.example/2", publishedAt: ago(50), source: "Straits Times" },
  ],
};

/** 메모리 DB: articles는 upsert된 것을 그대로 select로 돌려준다 */
function fakeDb(opts: { previous?: unknown[]; insights?: unknown[] } = {}) {
  const tables: Record<string, Record<string, unknown>[]> = {};
  const calls: { op: string; table: string; arg?: unknown }[] = [];
  const db: Db = {
    async select<T>(table: string, query: string) {
      calls.push({ op: "select", table, arg: query });
      if (table === "articles") return (tables.articles ?? []) as T[];
      if (table === "stories") return (opts.previous ?? []) as T[];
      if (table === "story_insights") return (opts.insights ?? []) as T[];
      return [] as T[];
    },
    async upsert(table, rows) {
      calls.push({ op: "upsert", table, arg: rows });
      (tables[table] ??= []).push(...(rows as Record<string, unknown>[]));
    },
    async insert<T>(table: string, row: object) {
      calls.push({ op: "insert", table, arg: row });
      return { id: 1 } as T;
    },
    async update(table, filter, patch) {
      calls.push({ op: "update", table, arg: { filter, patch } });
    },
    async remove(table, filter) {
      calls.push({ op: "remove", table, arg: filter });
    },
  };
  return { db, tables, calls };
}

const load = vi.fn(async (url: string) => {
  const id = FEEDS.find((f) => f.url === url)!.id;
  if (id === "sg-st" && url.includes("fail")) throw new Error("x");
  return { title: null, articles: FEED_ARTICLES[id] };
});

describe("articleKey", () => {
  it("정규화 링크 기준 16자 해시 (utm 무시)", () => {
    expect(articleKey("https://a.example/x?utm_source=rss")).toBe(articleKey("http://a.example/x"));
    expect(articleKey("https://a.example/x")).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe("runPipeline", () => {
  it("수집 → 저장 → 사건 → 스냅샷 → 실행 기록 (AI 없이도 동작)", async () => {
    const { db, tables, calls } = fakeDb();
    const stats = await runPipeline({ db, feeds: FEEDS, load, now: NOW });

    // 48시간 넘은 기사, 날짜 없는 기사는 저장하지 않는다
    const titles = tables.articles.map((a) => a.title);
    expect(titles).toContain("Iran seizes tanker near Hormuz strait");
    expect(titles).not.toContain("Very old Hormuz story");
    expect(titles).not.toContain("No date Hormuz");
    expect(tables.articles[0]).toMatchObject({ feed_id: "gb-bbc", country: "GB", source: "BBC" });

    expect(tables.stories).toHaveLength(1);
    const story = tables.stories[0];
    expect(story).toMatchObject({ image: "https://img/1.jpg", size: 4 });
    expect(story.countries).toEqual(expect.arrayContaining(["GB", "US", "ME", "SG"]));
    expect(story).not.toHaveProperty("first_seen_at");
    expect(tables.story_articles).toHaveLength(4);
    expect(tables.story_snapshots[0]).toMatchObject({ story_id: story.id, at: "2026-10-19T12:00:00.000Z", size: 4, countries: 4 });

    expect(stats).toMatchObject({ feedsOk: 4, feedsFailed: 0, stories: 1, enriched: 0 });
    expect(stats.countries).toMatchObject({ GB: 2, US: 1, ME: 1, SG: 2 });
    const finish = calls.find((c) => c.op === "update" && c.table === "pipeline_runs");
    expect(finish?.arg).toMatchObject({ filter: "id=eq.1", patch: { finished_at: expect.any(String) } });
    // 오래된 데이터 정리
    expect(calls.filter((c) => c.op === "remove").map((c) => c.table)).toEqual(
      expect.arrayContaining(["articles", "stories", "story_snapshots"]),
    );
  });

  it("이전 사건과 겹치면 id를 이어 쓴다", async () => {
    const { db: db1, tables: t1 } = fakeDb();
    await runPipeline({ db: db1, feeds: FEEDS, load, now: NOW });
    const first = t1.stories[0];
    const prevArticles = t1.story_articles.map((r) => ({ article_id: r.article_id }));
    const { db, tables } = fakeDb({ previous: [{ id: "s-keep", terms: first.terms, story_articles: prevArticles }] });
    await runPipeline({ db, feeds: FEEDS, load, now: NOW });
    expect(tables.stories[0].id).toBe("s-keep");
  });

  it("AI가 있으면 사건을 보강해 한국어 결과·엔티티를 저장한다", async () => {
    const { db, tables } = fakeDb();
    const enrich = vi.fn(async (prompt: string) => {
      const id = /## story (\S+)/.exec(prompt)![1];
      return {
        model: "m",
        value: {
          stories: [
            {
              id,
              title_ko: "이란, 유조선 나포",
              summary_ko: ["a", "b", "c"],
              why_ko: "w",
              perspectives: [{ country: "US", angle_ko: "유가", refs: ["r1"] }],
              entities: [{ name: "Iran", name_ko: "이란", type: "place" }],
            },
          ],
        },
      };
    });
    const stats = await runPipeline({ db, feeds: FEEDS, load, now: NOW, enrich });
    expect(stats.enriched).toBe(1);
    expect(tables.story_insights[0]).toMatchObject({ title_ko: "이란, 유조선 나포", model: "m", summary_ko: ["a", "b", "c"] });
    expect(tables.entities[0]).toMatchObject({ id: "place:iran", name_ko: "이란" });
    expect(tables.story_entities[0]).toMatchObject({ entity_id: "place:iran" });
  });

  it("AI 호출이 실패해도 실행은 끝나고 오류 수를 남긴다", async () => {
    const { db } = fakeDb();
    const enrich = vi.fn(async () => {
      throw new Error("quota");
    });
    const stats = await runPipeline({ db, feeds: FEEDS, load, now: NOW, enrich });
    expect(stats.enrichErrors).toEqual(["quota"]);
  });

  it("피드 하나가 실패해도 나머지로 진행한다", async () => {
    const { db } = fakeDb();
    const failing = vi.fn(async (url: string) => {
      if (url.includes("sg-st")) throw new Error("down");
      return load(url);
    });
    const stats = await runPipeline({ db, feeds: FEEDS, load: failing, now: NOW });
    expect(stats).toMatchObject({ feedsOk: 3, feedsFailed: 1 });
  });

  it("치명적 오류는 실행 기록에 남기고 다시 던진다", async () => {
    const { db, calls } = fakeDb();
    db.upsert = async () => {
      throw new Error("db down");
    };
    await expect(runPipeline({ db, feeds: FEEDS, load, now: NOW })).rejects.toThrow("db down");
    const fail = calls.find((c) => c.op === "update" && c.table === "pipeline_runs");
    expect(fail?.arg).toMatchObject({ patch: { error: "db down" } });
  });
});
