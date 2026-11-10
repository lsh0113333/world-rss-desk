// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { Article } from "@/types/article";
import type { CatalogFeed } from "@/types/catalog";
import type { WorldBoard } from "@/types/world";
import { assertSafeUrl } from "@/lib/url-guard";
import { articleKey, runPipeline } from "./pipeline";
import { loadFeed } from "./rss";
import type { Db } from "./supabase";

vi.mock("./rss", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./rss")>();
  return { ...actual, loadFeed: vi.fn(async () => ({ title: null, articles: [] })) };
});
vi.mock("@/lib/url-guard", () => ({ assertSafeUrl: vi.fn() }));

const NOW = new Date("2026-11-01T12:30:00Z");
const ago = (min: number) => new Date(NOW.getTime() - min * 60_000).toISOString();

const feed = (id: string, country: string, name: string, continent: CatalogFeed["continent"] = "europe"): CatalogFeed => ({
  id,
  name,
  url: `https://${id}.example/rss`,
  homepage: `https://${id}.example`,
  continent,
  country,
  category: "world",
  language: "en",
});

const FEEDS = [
  feed("gb-bbc", "GB", "BBC"),
  feed("us-cnbc", "US", "CNBC", "north-america"),
  feed("me-aj", "ME", "Al Jazeera", "middle-east"),
  feed("sg-st", "SG", "ST", "asia"),
  feed("world-un", "WORLD", "UN News", "global"),
];

const hormuz: Record<string, Article[]> = {
  "gb-bbc": [
    { id: "1", title: "Iran seizes tanker near Hormuz strait", link: "https://bbc.example/1", publishedAt: ago(10), source: "BBC" },
    { id: "old", title: "Very old Hormuz story", link: "https://bbc.example/old", publishedAt: ago(60 * 24 * 5), source: "BBC" },
    { id: "nodate", title: "No date Hormuz", link: "https://bbc.example/nd", publishedAt: null, source: "BBC" },
  ],
  "us-cnbc": [{ id: "2", title: "Oil jumps after Hormuz tanker seizure by Iran", link: "https://cnbc.example/1", publishedAt: ago(15), source: "CNBC" }],
  "me-aj": [{ id: "3", title: "Tanker seized in Hormuz, Iran says", link: "https://aj.example/1", publishedAt: ago(30), source: "Al Jazeera" }],
  "sg-st": [{ id: "4", title: "Hormuz tension: Iran tanker move rattles Asia", link: "https://st.example/1", publishedAt: ago(40), source: "ST" }],
  "world-un": [{ id: "5", title: "UN on Hormuz tanker Iran seizure", link: "https://un.example/1", publishedAt: ago(40), source: "UN News" }],
};

const loader = (data: Record<string, Article[]>) =>
  vi.fn(async (url: string) => {
    const id = FEEDS.find((f) => f.url === url)!.id;
    if (!data[id]) throw new Error("피드 실패");
    return { title: null, articles: data[id] };
  });

type Row = Record<string, unknown>;

/** 메모리 Supabase: eq/in/gte/lt 필터와 키 기준 upsert를 흉내 낸다 */
function memoryDb() {
  const tables: Record<string, Row[]> = {};
  const parse = (query: string) =>
    query
      .split("&")
      .map((part) => {
        const i = part.indexOf("=");
        return [part.slice(0, i), part.slice(i + 1)] as const;
      })
      .filter(([k]) => k && !["select", "order", "limit"].includes(k));
  const matches = (row: Row, query: string) =>
    parse(query).every(([col, expr]) => {
      const dot = expr.indexOf(".");
      const op = expr.slice(0, dot);
      const raw = expr.slice(dot + 1);
      const value = String(row[col]);
      if (op === "eq") return value === decodeURIComponent(raw);
      if (op === "gte") return value >= raw;
      if (op === "lt") return value < raw;
      if (op === "lte") return value <= raw;
      if (op === "in") {
        const list = raw.slice(1, -1).split(",").map((v) => decodeURIComponent(v).replace(/^"|"$/g, ""));
        return list.includes(value);
      }
      throw new Error(`unknown op ${op}`);
    });
  const KEYS: Record<string, string[]> = {
    articles: ["id"],
    objects: ["id"],
    links: ["src", "type", "dst"],
    extraction_log: ["article_id"],
  };
  const db: Db = {
    async select<T>(table: string, query: string) {
      const rows = (tables[table] ?? []).filter((r) => matches(r, query));
      if (query.includes("order=generated_at.desc")) rows.sort((a, b) => String(b.generated_at).localeCompare(String(a.generated_at)));
      return rows as T[];
    },
    async upsert(table, rows, opts = {}) {
      const list = (tables[table] ??= []);
      const key = KEYS[table] ?? ["id"];
      for (const row of rows as Row[]) {
        const existing = list.find((r) => key.every((k) => r[k] === row[k]));
        if (existing) {
          if (!opts.ignoreDuplicates) Object.assign(existing, row);
        } else list.push({ first_seen: NOW.toISOString(), ...row });
      }
    },
    async insert<T>(table: string, row: object) {
      const list = (tables[table] ??= []);
      const created = { id: list.length + 1, ...row };
      list.push(created);
      return created as T;
    },
    async update(table, filter, patch) {
      for (const r of (tables[table] ?? []).filter((r) => matches(r, filter))) Object.assign(r, patch);
    },
    async remove(table, filter) {
      tables[table] = (tables[table] ?? []).filter((r) => !matches(r, filter));
    },
    async count(table, filter) {
      return (tables[table] ?? []).filter((r) => matches(r, filter)).length;
    },
  };
  return { db, tables };
}

const clusterOf = (prompt: string) => /\[묶음 ([^\]]+)\]/.exec(prompt)![1];
const idsIn = (prompt: string) => [...prompt.matchAll(/^- \(([^)]+)\)/gm)].map((m) => m[1]);

/** AI 흉내: 묶음마다 사건 하나 */
const aiEvent = (over: object = {}) =>
  vi.fn(async (prompt: string) => ({
    model: "fake",
    value: {
      events: [
        {
          cluster: clusterOf(prompt),
          type: "armed-conflict",
          title: "이란, 호르무즈서 유조선 나포",
          summary: "이란이 호르무즈 해협에서 유조선을 나포했다.",
          flow: "mideast",
          actors: [
            { name: "Iran", nameKo: "이란", kind: "country", role: "subject", code: "IR" },
            { name: "Shell", nameKo: "셸", kind: "org", role: "target", code: "" },
          ],
          places: ["IR"],
          evidence: idsIn(prompt),
          ...over,
        },
      ],
    },
  }));

const latestBoard = (tables: Record<string, Row[]>) => tables.board_snapshots.at(-1)!.payload as WorldBoard;

describe("runPipeline", () => {
  it("수집 → 묶기 → AI 추출 → 객체·관계 저장 → 규칙으로 상황판", async () => {
    const { db, tables } = memoryDb();
    const extract = aiEvent();
    const stats = await runPipeline({ db, feeds: FEEDS, load: loader(hormuz), extract, now: NOW });

    // 나라의 시각이 아닌 매체(UN News)는 쓰지 않고, 묶음 지역 매체는 본사 나라로
    expect(FEEDS.length).toBe(5);
    expect(tables.articles.map((a) => a.source)).not.toContain("UN News");
    expect(tables.articles.find((a) => a.source === "Al Jazeera")).toMatchObject({ country: "QA", continent: "middle-east" });
    // 날짜 없음·오래된 기사 제외
    expect(tables.articles).toHaveLength(4);
    expect(tables.articles[0].id).toBe(articleKey("https://bbc.example/1"));

    expect(extract).toHaveBeenCalledTimes(1);
    const event = tables.objects.find((o) => o.type === "event")!;
    expect(String(event.id)).toMatch(/^event:20261101-/);
    expect(event.props).toMatchObject({ eventType: "armed-conflict", title: "이란, 호르무즈서 유조선 나포", flow: "mideast", extractedSize: 4, model: "fake" });

    const linksOf = (type: string) => tables.links.filter((l) => l.type === type);
    expect(linksOf("reports")).toHaveLength(4);
    expect(linksOf("reports")[0]).toMatchObject({ dst: event.id, made_by: "ai" });
    expect(linksOf("subject")[0]).toMatchObject({ src: event.id, dst: "country:IR", made_by: "ai", props: { nameKo: "이란", kind: "country" } });
    expect(linksOf("target")[0].dst).toBe("actor:org:shell");
    expect(linksOf("occurs_in")[0].dst).toBe("country:IR");
    expect(linksOf("part_of")[0].dst).toBe("flow:mideast");
    expect((linksOf("subject")[0].evidence as string[]).length).toBe(4);
    expect(tables.objects.find((o) => o.id === "actor:org:shell")).toMatchObject({ type: "actor", props: { name: "Shell", kind: "org" } });

    // 뼈대 객체·관계 (설정에서 옴)
    expect(tables.objects.find((o) => o.id === "country:QA")).toMatchObject({ type: "country" });
    expect(tables.objects.find((o) => o.id === "flow:ai-race")).toMatchObject({ type: "flow" });
    expect(tables.links.find((l) => l.src === "country:QA" && l.type === "belongs_to")).toMatchObject({ dst: "continent:middle-east", made_by: "config" });
    expect(tables.links.find((l) => l.type === "based_in" && l.src === "outlet:al jazeera")).toMatchObject({ dst: "country:QA" });

    // 상황판
    const board = latestBoard(tables);
    expect(board.world).toEqual([event.id]);
    const be = board.events[0];
    expect(be.reporting.sort()).toEqual(["GB", "QA", "SG", "US"]);
    expect(be.continents).toHaveLength(4);
    expect(be.flow).toBe("mideast");
    expect(be.occurs).toEqual(["IR"]);
    expect(be.actors.find((a) => a.role === "subject")).toMatchObject({ id: "country:IR", nameKo: "이란" });
    // 관계: 보도 나라 × 일어난 나라. 사건이 하나뿐이라 관계 온도 쌍은 아직 없다
    expect(board.relations).toMatchObject({ days: 7, pairs: [] });
    expect(board.relations!.interest.targets).toEqual(["IR"]);
    // 한국 매체 줄은 보도가 없어도 항상 있다 (RULES.interestAlwaysReporters)
    expect([...board.relations!.interest.reporters].sort()).toEqual(["GB", "KR", "QA", "SG", "US"]);
    expect(be.score.multiplier).toBe(1.75);
    expect(board.flows.find((f) => f.id === "mideast")?.eventIds).toEqual([event.id]);
    expect(board.stats).toMatchObject({ feedsOk: 4, feedsFailed: 0, extracted: 1, articles: 4 });
    expect(board.stats.ontology?.objects.event).toBe(1);
    expect(board.stats.ontology?.links.reports).toBe(4);
    expect(board.stats.ontology?.madeBy.ai).toBeGreaterThan(0);
    expect(stats.extracted).toBe(1);
    expect(tables.pipeline_runs[0].finished_at).toBeTruthy();
  });

  it("행위자의 소속 나라를 소속 관계로 저장하고 상황판 행위자에도 붙인다", async () => {
    const { db, tables } = memoryDb();
    const extract = aiEvent({
      actors: [
        { name: "Iran", nameKo: "이란", kind: "country", role: "subject", code: "IR" },
        { name: "Shell", nameKo: "셸", kind: "org", role: "target", code: "GB" },
      ],
    });
    await runPipeline({ db, feeds: FEEDS, load: loader(hormuz), extract, now: NOW });
    const link = tables.links.find((l) => l.type === "affiliated_with");
    expect(link).toMatchObject({ src: "actor:org:shell", dst: "country:GB", made_by: "ai" });
    expect((link!.evidence as string[]).length).toBe(4);
    expect(tables.links.some((l) => l.type === "affiliated_with" && l.src === "country:IR")).toBe(false);
    expect(latestBoard(tables).events[0].actors.find((a) => a.id === "actor:org:shell")).toMatchObject({ country: "GB" });
  });

  it("다음 실행: 이미 정리한 사건은 AI 없이 새 기사만 규칙으로 붙인다", async () => {
    const { db, tables } = memoryDb();
    const extract = aiEvent();
    await runPipeline({ db, feeds: FEEDS, load: loader(hormuz), extract, now: NOW });
    const firstSeen = tables.objects.find((o) => o.type === "event")!.first_seen;

    const later = new Date(NOW.getTime() + 30 * 60_000);
    const more = {
      ...hormuz,
      "gb-bbc": [...hormuz["gb-bbc"], { id: "n", title: "Hormuz tanker seizure: Iran warns navies", link: "https://bbc.example/n", publishedAt: ago(1), source: "BBC" }],
    };
    await runPipeline({ db, feeds: FEEDS, load: loader(more), extract, now: later });

    expect(extract).toHaveBeenCalledTimes(1);
    const reports = tables.links.filter((l) => l.type === "reports");
    expect(reports).toHaveLength(5);
    expect(reports.at(-1)).toMatchObject({ src: `article:${articleKey("https://bbc.example/n")}`, made_by: "rule" });
    const event = tables.objects.find((o) => o.type === "event")!;
    expect(event.first_seen).toBe(firstSeen);
    expect(latestBoard(tables).events[0].articleCount).toBe(5);
  });

  it("AI가 사건이 아니라고 하면 같은 기사를 다시 보내지 않는다", async () => {
    const { db, tables } = memoryDb();
    const extract = vi.fn(async () => ({ model: "fake", value: { events: [] } }));
    await runPipeline({ db, feeds: FEEDS, load: loader(hormuz), extract, now: NOW });
    await runPipeline({ db, feeds: FEEDS, load: loader(hormuz), extract, now: new Date(NOW.getTime() + 60_000) });
    expect(extract).toHaveBeenCalledTimes(1);
    expect(tables.extraction_log).toHaveLength(4);
    expect(latestBoard(tables).events).toEqual([]);
  });

  it("AI 호출이 실패하면 다음 실행에 다시 보낸다. 파이프라인은 멈추지 않는다", async () => {
    const { db, tables } = memoryDb();
    const extract = vi.fn().mockRejectedValueOnce(new Error("429")).mockImplementation(aiEvent());
    const first = await runPipeline({ db, feeds: FEEDS, load: loader(hormuz), extract, now: NOW });
    expect(first.errors).toEqual(["429"]);
    expect(tables.extraction_log ?? []).toEqual([]);
    expect(tables.board_snapshots).toHaveLength(1);

    const second = await runPipeline({ db, feeds: FEEDS, load: loader(hormuz), extract, now: new Date(NOW.getTime() + 60_000) });
    expect(second.extracted).toBe(1);
    expect(second.errors).toEqual([]);
  });

  it("AI 키가 없으면 추출 없이 상황판을 비워 둔다", async () => {
    const { db, tables } = memoryDb();
    const stats = await runPipeline({ db, feeds: FEEDS, load: loader(hormuz), now: NOW });
    expect(stats.extracted).toBe(0);
    expect(latestBoard(tables).events).toEqual([]);
  });

  it("피드 하나가 실패해도 나머지로 진행", async () => {
    const { db, tables } = memoryDb();
    const partial = { ...hormuz };
    delete partial["sg-st"];
    const logs: string[] = [];
    const stats = await runPipeline({ db, feeds: FEEDS, load: loader(partial), extract: aiEvent(), now: NOW, log: (m) => logs.push(m) });
    // 어느 피드가 실패했는지 실행 기록에 남긴다
    expect(logs).toContain("실패 피드: sg-st (피드 실패)");
    expect(stats.feedsFailed).toBe(1);
    expect(latestBoard(tables).world).toHaveLength(1);
  });

  it("사건이 2배 커지고 6시간 지나면 같은 사건을 다시 정리한다 (처음 본 시각은 그대로)", async () => {
    const { db, tables } = memoryDb();
    const extract = aiEvent();
    const small = { "gb-bbc": hormuz["gb-bbc"], "us-cnbc": hormuz["us-cnbc"], "me-aj": hormuz["me-aj"] };
    await runPipeline({ db, feeds: FEEDS, load: loader(small), extract, now: NOW });
    const firstSeen = tables.objects.find((o) => o.type === "event")!.first_seen;

    const later = new Date(NOW.getTime() + 7 * 3_600_000);
    const grown = {
      ...hormuz,
      "gb-bbc": [
        { ...hormuz["gb-bbc"][0], publishedAt: new Date(later.getTime() - 60_000).toISOString() },
        { id: "m", title: "Hormuz tanker seizure Iran latest", link: "https://bbc.example/m", publishedAt: new Date(later.getTime() - 60_000).toISOString(), source: "BBC" },
        { id: "m2", title: "Iran tanker Hormuz analysis", link: "https://bbc.example/m2", publishedAt: new Date(later.getTime() - 60_000).toISOString(), source: "BBC" },
      ],
    };
    const refreshed = aiEvent({ title: "새 제목", actors: [{ name: "Iran", nameKo: "이란", kind: "country", role: "target", code: "IR" }] });
    extract.mockImplementation(refreshed);
    await runPipeline({ db, feeds: FEEDS, load: loader(grown), extract, now: later });

    const events = tables.objects.filter((o) => o.type === "event");
    expect(events).toHaveLength(1);
    expect(events[0].props).toMatchObject({ title: "새 제목" });
    expect(events[0].first_seen).toBe(firstSeen);
    // 옛 관계는 지우고 새로
    const roles = tables.links.filter((l) => l.src === events[0].id && ["subject", "target"].includes(String(l.type)));
    expect(roles.map((l) => [l.type, l.dst])).toEqual([["target", "country:IR"]]);
  });

  it("오래된 데이터를 정리한다", async () => {
    const { db, tables } = memoryDb();
    await db.upsert("objects", [{ id: "event:old", type: "event", props: {}, last_seen: ago(60 * 24 * 40) }]);
    await db.upsert("links", [{ src: "event:old", type: "subject", dst: "country:US", observed_at: ago(60 * 24 * 40), evidence: [], made_by: "ai", props: {} }]);
    await db.insert("board_snapshots", { generated_at: ago(60 * 24 * 3), payload: {} });
    await runPipeline({ db, feeds: FEEDS, load: loader(hormuz), now: NOW });
    expect(tables.objects.find((o) => o.id === "event:old")).toBeUndefined();
    expect(tables.links.find((l) => l.src === "event:old")).toBeUndefined();
    expect(tables.board_snapshots).toHaveLength(1);
  });

  it("24시간 전 상황판과 비교해 달라진 것을 넣고, 비교 기록은 이틀 둔다", async () => {
    const { db, tables } = memoryDb();
    const yesterday = { world: ["event:gone"], it: [], events: [{ id: "event:gone", title: "어제의 큰일", reporting: ["GB"] }] };
    await db.insert("board_snapshots", { generated_at: ago(60 * 25), payload: yesterday });
    await db.insert("board_snapshots", { generated_at: ago(60 * 2), payload: { world: [], it: [], events: [] } });
    await runPipeline({ db, feeds: FEEDS, load: loader(hormuz), extract: aiEvent(), now: NOW });
    const changes = latestBoard(tables).changes!;
    expect(changes.comparedTo).toBe(ago(60 * 25));
    expect(changes.faded).toEqual([{ id: "event:gone", title: "어제의 큰일" }]);
    expect(changes.appeared).toHaveLength(1);
    expect(tables.board_snapshots).toHaveLength(3);
  });

  it("24시간 전 기록이 없으면 비교하지 않는다", async () => {
    const { db, tables } = memoryDb();
    await db.insert("board_snapshots", { generated_at: ago(60 * 2), payload: { world: [], it: [], events: [] } });
    await runPipeline({ db, feeds: FEEDS, load: loader(hormuz), now: NOW });
    expect(latestBoard(tables).changes).toBeUndefined();
  });

  it("관계 온도는 최근 7일 사건(지금 상황판에 없어도)의 주체·대상으로 센다", async () => {
    const { db, tables } = memoryDb();
    const old = (id: string, days: number) => ({ id, type: "event", props: { eventType: "sanction", title: id, summary: "", flow: null }, first_seen: ago(60 * 24 * days), last_seen: ago(60 * 24 * days) });
    const role = (src: string, type: string, dst: string, nameKo: string) => ({ src, type, dst, props: { name: dst, nameKo, kind: "country" }, observed_at: ago(60), evidence: [], made_by: "ai" });
    await db.upsert("objects", [old("event:a", 2), old("event:b", 5), old("event:c", 8)]);
    await db.upsert("links", ["event:a", "event:b", "event:c"].flatMap((e) => [role(e, "subject", "country:US", "미국"), role(e, "target", "country:CN", "중국")]));
    await runPipeline({ db, feeds: FEEDS, load: loader(hormuz), now: NOW });
    const [pair] = latestBoard(tables).relations!.pairs;
    expect(pair).toMatchObject({ a: { nameKo: "중국" }, b: { nameKo: "미국" }, conflict: 2, cooperation: 0, temperature: -1 });
    expect(pair.events.map((e) => e.id)).toEqual(["event:a", "event:b"]);
  });

  it("기본 수집은 카탈로그 URL도 url-guard를 거친다", async () => {
    const { db } = memoryDb();
    await runPipeline({ db, feeds: FEEDS.slice(0, 1), now: NOW });
    expect(vi.mocked(loadFeed).mock.calls[0][1]).toMatchObject({ checkUrl: assertSafeUrl });
  });

  it("실패하면 실행 기록에 남기고 다시 던진다", async () => {
    const { db, tables } = memoryDb();
    db.upsert = async () => {
      throw new Error("DB 오류");
    };
    await expect(runPipeline({ db, feeds: FEEDS, load: loader(hormuz), now: NOW })).rejects.toThrow("DB 오류");
    expect(tables.pipeline_runs[0].error).toBe("DB 오류");
  });
});
