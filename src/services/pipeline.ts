import { createHash } from "node:crypto";
import { normalizeLink } from "@/lib/merge";
import { findClusters, planClusters, type Cluster, type EventProgress } from "@/lib/ontology/cluster";
import { buildExtractPrompt, EXTRACT_SCHEMA, parseExtraction, type ExtractedEvent, type ExtractInput } from "@/lib/ontology/extract";
import { inList, isValidLink } from "@/lib/ontology/graph";
import { interestMatrix, relationPairs, type RelationEventInput } from "@/lib/ontology/relations";
import { buildBoard, diffBoards, type PreviousBoard } from "@/lib/ontology/rules";
import { hashId } from "@/lib/text";
import { assertSafeUrl } from "@/lib/url-guard";
import { allCountryCodes, continentOfCountry, CONTINENTS, countryName } from "@/ontology/countries";
import { baseCountry } from "@/ontology/outlets";
import { ACTOR_ROLES, EVENT_TYPES, FLOWS, LINK_TYPES, OBJECT_TYPES, RULES, type EventType, type FlowId, type LinkType } from "@/ontology/world";
import type { CatalogFeed } from "@/types/catalog";
import type { BoardActor, BoardArticle, BoardStats, EventFact, OntologyStats, PipelineArticle } from "@/types/world";
import { loadFeed, type ParsedFeed } from "./rss";
import type { Db } from "./supabase";

/**
 * 온톨로지 파이프라인 (GitHub Actions, Supabase pg_cron이 30분마다 실행 요청. ADR-017·018).
 * 감지(수집) → 규칙 묶기 → AI 읽기(새 묶음만) → 객체·관계 저장 → 규칙 판단 → 상황판 저장.
 * 화면은 /api/world로 가장 최근 상황판만 읽는다.
 */

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** 수집 시 이보다 오래된 기사는 저장하지 않는다 */
const INGEST_MAX_AGE_H = 48;
/** 사건 계산에 쓰는 기간 */
const WINDOW_H = 24;
/** 기사-사건 연결을 읽는 기간 */
const ASSIGNMENT_H = 72;
const EXTRACT_BATCH = 6;
/** 묶음 하나에서 AI에 보내는 기사 수 */
const EXTRACT_ARTICLE_LIMIT = 12;
const CHUNK = 100;
const KEEP_ARTICLES_DAYS = 14;
const KEEP_GRAPH_DAYS = 30;
/** 어제와 비교하려면 하루보다 길게 둔다 */
const KEEP_SNAPSHOTS_DAYS = 2;

export interface PipelineStats {
  feedsOk: number;
  feedsFailed: number;
  ingested: number;
  windowArticles: number;
  clusters: number;
  extracted: number;
  refreshed: number;
  attached: number;
  boardEvents: number;
  errors: string[];
}

export type ExtractFn = (prompt: string, schema: object) => Promise<{ value: unknown; model: string }>;

export interface PipelineDeps {
  db: Db;
  feeds: readonly CatalogFeed[];
  load?: (url: string, opts: { source: string; timeoutMs: number }) => Promise<ParsedFeed>;
  /** AI 읽기. 없으면(키 없음) 건너뛴다 */
  extract?: ExtractFn;
  now?: Date;
  log?: (message: string) => void;
}

export function articleKey(link: string): string {
  return createHash("sha1").update(normalizeLink(link)).digest("hex").slice(0, 16);
}

interface ArticleRow {
  id: string;
  link: string;
  title: string;
  summary: string | null;
  source: string;
  feed_id: string;
  country: string;
  continent: string;
  category: string;
  published_at: string;
}

interface LinkRow {
  src: string;
  type: LinkType;
  dst: string;
  props: Record<string, unknown>;
  observed_at: string;
  evidence: string[];
  made_by: "ai" | "rule" | "config";
}

interface EventProps {
  eventType: EventType;
  title: string;
  summary: string;
  flow: FlowId | null;
  extractedSize: number;
  extractedAt: string;
  model: string;
}

const iso = (ms: number) => new Date(ms).toISOString();
const articleNode = (id: string) => `article:${id}`;
const articleOf = (node: string) => node.slice("article:".length);
const outletNode = (name: string) => `outlet:${name.toLowerCase()}`;
const ROLE_LINKS = [...ACTOR_ROLES, "occurs_in", "part_of"] as const;

function chunks<T>(list: readonly T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += CHUNK) out.push(list.slice(i, i + CHUNK));
  return out;
}

const guardedLoad: NonNullable<PipelineDeps["load"]> = (url, opts) => loadFeed(url, { ...opts, checkUrl: assertSafeUrl });

async function ingest(feeds: readonly CatalogFeed[], load: NonNullable<PipelineDeps["load"]>, now: Date) {
  const articles: ArticleRow[] = [];
  let ok = 0;
  let failed = 0;
  const queue = feeds.filter((f) => baseCountry(f));
  await Promise.all(
    Array.from({ length: Math.min(20, queue.length) }, async () => {
      for (let feed = queue.shift(); feed; feed = queue.shift()) {
        try {
          const { articles: list } = await load(feed.url, { source: feed.name, timeoutMs: 8_000 });
          ok++;
          const country = baseCountry(feed)!;
          for (const a of list) {
            if (!a.publishedAt || now.getTime() - Date.parse(a.publishedAt) > INGEST_MAX_AGE_H * HOUR) continue;
            articles.push({
              id: articleKey(a.link),
              link: a.link,
              title: a.title,
              summary: a.summary ?? null,
              source: a.source,
              feed_id: feed.id,
              country,
              continent: continentOfCountry(country) ?? "",
              category: feed.category,
              published_at: a.publishedAt,
            });
          }
        } catch {
          failed++;
        }
      }
    }),
  );
  // 같은 링크가 여러 피드에 있으면 하나만 (upsert 한 배치 안 충돌 방지)
  return { articles: [...new Map(articles.map((a) => [a.id, a])).values()], ok, failed };
}

/** 설정에서 오는 뼈대(대륙·나라·큰 흐름·매체)를 그래프에 맞춘다. 멱등 */
async function seedStatic(db: Db, feeds: readonly CatalogFeed[], now: Date) {
  const seen = now.toISOString();
  const outlets = new Map(feeds.filter((f) => baseCountry(f)).map((f) => [outletNode(f.name), { name: f.name, country: baseCountry(f)!, homepage: f.homepage }]));
  await db.upsert(
    "objects",
    [
      ...CONTINENTS.map((c) => ({ id: `continent:${c.id}`, type: "continent", props: { label: c.label }, last_seen: seen })),
      ...allCountryCodes().map((code) => ({ id: `country:${code}`, type: "country", props: { name: countryName(code) }, last_seen: seen })),
      ...FLOWS.map((f) => ({ id: `flow:${f.id}`, type: "flow", props: { label: f.label, hint: f.hint }, last_seen: seen })),
      ...[...outlets].map(([id, o]) => ({ id, type: "outlet", props: { name: o.name, homepage: o.homepage }, last_seen: seen })),
    ],
    { onConflict: "id" },
  );
  const link = (type: LinkType, src: string, dst: string): LinkRow => ({ src, type, dst, props: {}, observed_at: seen, evidence: [], made_by: "config" });
  await db.upsert(
    "links",
    [
      ...allCountryCodes().map((code) => link("belongs_to", `country:${code}`, `continent:${continentOfCountry(code)}`)),
      ...[...outlets].map(([id, o]) => link("based_in", id, `country:${o.country}`)),
    ],
    { onConflict: "src,type,dst" },
  );
}

function clusterInput(cluster: Cluster): ExtractInput {
  return {
    cluster: cluster.key,
    articles: cluster.articles.slice(0, EXTRACT_ARTICLE_LIMIT).map((a) => ({ id: a.id, title: a.title, source: a.source, country: a.country, ...(a.summary ? { summary: a.summary } : {}) })),
  };
}

/** 사건 하나의 관계 (행위자·장소·큰 흐름). 설정에 어긋나는 관계는 저장하지 않는다 */
function eventLinks(eventId: string, e: ExtractedEvent, seen: string): LinkRow[] {
  const evidence = e.evidence;
  const base = { observed_at: seen, evidence, made_by: "ai" as const };
  const rows: LinkRow[] = [
    ...e.actors.map((a) => ({ ...base, src: eventId, type: a.role as LinkType, dst: a.id, props: { name: a.name, nameKo: a.nameKo, kind: a.kind } })),
    ...e.places.map((code) => ({ ...base, src: eventId, type: "occurs_in" as const, dst: `country:${code}`, props: {} })),
    ...(e.flow ? [{ ...base, src: eventId, type: "part_of" as const, dst: `flow:${e.flow}`, props: {} }] : []),
  ];
  return rows.filter((r) => isValidLink(r.type, r.src, r.dst));
}

async function saveActors(db: Db, events: ExtractedEvent[], seen: string) {
  const actors = new Map(events.flatMap((e) => e.actors).filter((a) => a.id.startsWith("actor:")).map((a) => [a.id, a]));
  if (actors.size === 0) return;
  await db.upsert(
    "objects",
    [...actors.values()].map((a) => ({ id: a.id, type: "actor", props: { name: a.name, nameKo: a.nameKo, kind: a.kind }, last_seen: seen })),
    { onConflict: "id" },
  );
}

async function ontologyStats(db: Db): Promise<OntologyStats> {
  const count = async (filters: [string, string][], table: string) =>
    Object.fromEntries(await Promise.all(filters.map(async ([key, filter]) => [key, await db.count(table, filter)] as const)));
  return {
    objects: await count(Object.keys(OBJECT_TYPES).map((t) => [t, `type=eq.${t}`]), "objects"),
    links: await count(Object.keys(LINK_TYPES).map((t) => [t, `type=eq.${t}`]), "links"),
    madeBy: await count(["ai", "rule", "config"].map((m) => [m, `made_by=eq.${m}`]), "links"),
  };
}

/** 관계 온도의 재료: 최근 며칠 사건과 그 행위자 (이미 저장된 객체·관계만 읽는다) */
async function recentRelationEvents(db: Db, now: Date): Promise<RelationEventInput[]> {
  const since = iso(now.getTime() - RULES.relationDays * DAY);
  const events = await db.select<{ id: string; props: EventProps; last_seen: string }>("objects", `select=id,props,last_seen&type=eq.event&last_seen=gte.${since}`, { all: true });
  const actors = new Map<string, RelationEventInput["actors"]>();
  for (const ids of chunks(events.map((e) => e.id))) {
    for (const l of await db.select<LinkRow>("links", `select=src,type,dst,props&src=${inList(ids)}&type=${inList(ACTOR_ROLES)}`, { all: true })) {
      const list = actors.get(l.src) ?? [];
      list.push({ id: l.dst, nameKo: String(l.props.nameKo ?? l.props.name ?? l.dst), kind: l.props.kind as RelationEventInput["actors"][number]["kind"], role: l.type as RelationEventInput["actors"][number]["role"] });
      actors.set(l.src, list);
    }
  }
  return events
    .filter((e) => EVENT_TYPES[e.props.eventType])
    .map((e) => ({ id: e.id, title: e.props.title, type: e.props.eventType, lastSeenAt: e.last_seen, actors: actors.get(e.id) ?? [] }));
}

export async function runPipeline(deps: PipelineDeps): Promise<PipelineStats> {
  const { db, feeds, load = guardedLoad, extract, now = new Date(), log = () => {} } = deps;
  const run = await db.insert<{ id: number }>("pipeline_runs", { started_at: now.toISOString() });
  const seen = now.toISOString();
  const errors: string[] = [];

  try {
    // 1) 감지: 수집 + 정규화
    const ingested = await ingest(feeds, load, now);
    await db.upsert("articles", ingested.articles, { ignoreDuplicates: true });
    await seedStatic(db, feeds, now);
    log(`수집: 피드 ${ingested.ok}개 성공, ${ingested.failed}개 실패, 기사 ${ingested.articles.length}개`);

    // 2) 최근 24시간 기사 (본사 나라는 카탈로그 기준으로 다시 맞춘다)
    const feedById = new Map(feeds.map((f) => [f.id, f]));
    const windowRows = await db.select<ArticleRow>("articles", `select=*&published_at=gte.${iso(now.getTime() - WINDOW_H * HOUR)}&order=published_at.desc`, { all: true });
    const articles: PipelineArticle[] = windowRows.flatMap((r) => {
      const feed = feedById.get(r.feed_id);
      const country = feed && baseCountry(feed);
      if (!country) return [];
      return [{ id: r.id, link: r.link, title: r.title, ...(r.summary ? { summary: r.summary } : {}), source: r.source, feedId: r.feed_id, country, continent: continentOfCountry(country) ?? "", category: feed.category, publishedAt: r.published_at }];
    });

    // 3) 규칙으로 묶기 + AI에 무엇을 보낼지 정하기
    const clusters = findClusters(articles);
    const since = iso(now.getTime() - ASSIGNMENT_H * HOUR);
    const reports = await db.select<LinkRow>("links", `select=src,dst&type=eq.reports&observed_at=gte.${since}`, { all: true });
    const assigned = new Map(reports.map((l) => [articleOf(l.src), l.dst]));
    const sentRows = await db.select<{ article_id: string }>("extraction_log", `select=article_id&at=gte.${since}`, { all: true });
    const sent = new Set(sentRows.map((r) => r.article_id));
    const eventIds = [...new Set(assigned.values())];
    const progress = new Map<string, EventProgress>();
    for (const ids of chunks(eventIds)) {
      const rows = await db.select<{ id: string; props: EventProps }>("objects", `select=id,props&id=${inList(ids)}`);
      for (const r of rows) progress.set(r.id, { extractedSize: r.props.extractedSize, extractedAt: r.props.extractedAt });
    }
    const plan = planClusters(clusters, assigned, sent, progress, now);
    log(`묶음 ${clusters.length}개: AI ${plan.extract.length}개, 다시 정리 ${plan.refresh.length}개, 규칙으로 붙임 ${plan.attach.length}건`);

    // 4) 규칙으로 기존 사건에 기사 붙이기
    if (plan.attach.length > 0) {
      await db.upsert(
        "links",
        plan.attach.map(({ articleId, eventId }): LinkRow => ({ src: articleNode(articleId), type: "reports", dst: eventId, props: {}, observed_at: seen, evidence: [articleId], made_by: "rule" })),
        { onConflict: "src,type,dst" },
      );
      for (const { articleId, eventId } of plan.attach) assigned.set(articleId, eventId);
    }

    // 5) AI 읽기: 새 묶음 → 사건
    let extracted = 0;
    let refreshed = 0;
    if (extract) {
      for (let i = 0; i < plan.extract.length; i += EXTRACT_BATCH) {
        const inputs = plan.extract.slice(i, i + EXTRACT_BATCH).map(clusterInput);
        try {
          const { value, model } = await extract(buildExtractPrompt(inputs), EXTRACT_SCHEMA);
          const results = parseExtraction(value, inputs);
          const newEvents = [...results.values()].flat();
          await saveActors(db, newEvents, seen);
          for (const event of newEvents) {
            const id = `event:${seen.slice(0, 10).replace(/-/g, "")}-${hashId([...event.evidence].sort().join(","))}`;
            const props: EventProps = { eventType: event.type, title: event.title, summary: event.summary, flow: event.flow, extractedSize: event.evidence.length, extractedAt: seen, model };
            await db.upsert("objects", [{ id, type: "event", props, first_seen: seen, last_seen: seen }], { onConflict: "id" });
            await db.upsert(
              "links",
              [
                ...event.evidence.map((a): LinkRow => ({ src: articleNode(a), type: "reports", dst: id, props: {}, observed_at: seen, evidence: [a], made_by: "ai" })),
                ...eventLinks(id, event, seen),
              ],
              { onConflict: "src,type,dst" },
            );
            for (const a of event.evidence) assigned.set(a, id);
            extracted++;
          }
          await db.upsert("extraction_log", inputs.flatMap((input) => input.articles.map((a) => ({ article_id: a.id, at: seen }))), { onConflict: "article_id" });
        } catch (err) {
          errors.push(err instanceof Error ? err.message : String(err));
        }
      }

      // 6) 커진 사건 다시 정리 (id와 처음 본 시각은 그대로)
      for (const { eventId, cluster } of plan.refresh) {
        const input = clusterInput(cluster);
        try {
          const { value, model } = await extract(buildExtractPrompt([input]), EXTRACT_SCHEMA);
          const event = parseExtraction(value, [input]).get(cluster.key)?.[0];
          if (!event) continue;
          const size = [...assigned.values()].filter((v) => v === eventId).length;
          const props: EventProps = { eventType: event.type, title: event.title, summary: event.summary, flow: event.flow, extractedSize: size, extractedAt: seen, model };
          await saveActors(db, [event], seen);
          await db.upsert("objects", [{ id: eventId, type: "event", props, last_seen: seen }], { onConflict: "id" });
          await db.remove("links", `src=eq.${encodeURIComponent(eventId)}&type=${inList(ROLE_LINKS)}`);
          await db.upsert("links", eventLinks(eventId, event, seen), { onConflict: "src,type,dst" });
          refreshed++;
        } catch (err) {
          errors.push(err instanceof Error ? err.message : String(err));
        }
      }
      log(`AI 읽기: 새 사건 ${extracted}개, 다시 정리 ${refreshed}개${errors.length ? `, 오류 ${errors.length}건` : ""}`);
    }

    // 7) 사건 사실 모으기
    const articlesByEvent = new Map<string, BoardArticle[]>();
    for (const a of articles) {
      const eventId = assigned.get(a.id);
      if (!eventId) continue;
      const list = articlesByEvent.get(eventId) ?? [];
      list.push({ id: a.id, title: a.title, link: a.link, source: a.source, country: a.country, publishedAt: a.publishedAt });
      articlesByEvent.set(eventId, list);
    }
    const activeIds = [...articlesByEvent.keys()];
    const objects = new Map<string, { id: string; props: EventProps; first_seen: string }>();
    const linksByEvent = new Map<string, LinkRow[]>();
    for (const ids of chunks(activeIds)) {
      for (const r of await db.select<{ id: string; props: EventProps; first_seen: string }>("objects", `select=id,props,first_seen&id=${inList(ids)}`)) objects.set(r.id, r);
      for (const l of await db.select<LinkRow>("links", `select=*&src=${inList(ids)}&type=${inList(ROLE_LINKS)}`, { all: true })) {
        linksByEvent.set(l.src, [...(linksByEvent.get(l.src) ?? []), l]);
      }
    }
    for (const ids of chunks(activeIds)) await db.update("objects", `id=${inList(ids)}`, { last_seen: seen });
    const facts: EventFact[] = activeIds.flatMap((id) => {
      const object = objects.get(id);
      if (!object || !EVENT_TYPES[object.props.eventType]) return [];
      const links = linksByEvent.get(id) ?? [];
      const actors = links
        .filter((l) => (ACTOR_ROLES as readonly string[]).includes(l.type))
        .map((l): BoardActor => ({ id: l.dst, name: String(l.props.name ?? l.dst), nameKo: String(l.props.nameKo ?? l.props.name ?? l.dst), kind: l.props.kind as BoardActor["kind"], role: l.type as BoardActor["role"] }));
      return [
        {
          id,
          type: object.props.eventType,
          title: object.props.title,
          summary: object.props.summary,
          flow: object.props.flow,
          actors,
          occurs: links.filter((l) => l.type === "occurs_in").map((l) => l.dst.replace("country:", "")),
          firstSeenAt: object.first_seen,
          articles: articlesByEvent.get(id)!,
        },
      ];
    });

    // 8) 정리 후 규칙 판단 → 상황판 저장
    await db.remove("articles", `published_at=lt.${iso(now.getTime() - KEEP_ARTICLES_DAYS * DAY)}`);
    await db.remove("extraction_log", `at=lt.${iso(now.getTime() - KEEP_ARTICLES_DAYS * DAY)}`);
    await db.remove("links", `observed_at=lt.${iso(now.getTime() - KEEP_GRAPH_DAYS * DAY)}`);
    await db.remove("objects", `last_seen=lt.${iso(now.getTime() - KEEP_GRAPH_DAYS * DAY)}`);
    await db.remove("board_snapshots", `generated_at=lt.${iso(now.getTime() - KEEP_SNAPSHOTS_DAYS * DAY)}`);

    const boardStats: BoardStats = {
      articles: articles.length,
      clusters: clusters.length,
      feedsOk: ingested.ok,
      feedsFailed: ingested.failed,
      extracted,
      ontology: await ontologyStats(db),
    };
    const board = buildBoard(facts, now, boardStats);
    const [yesterday] = await db.select<{ generated_at: string; payload: PreviousBoard }>(
      "board_snapshots",
      `select=generated_at,payload&generated_at=lte.${iso(now.getTime() - RULES.changeHours * HOUR)}&order=generated_at.desc&limit=1`,
    );
    if (yesterday) board.changes = diffBoards(board, yesterday.payload, yesterday.generated_at);
    board.relations = { days: RULES.relationDays, pairs: relationPairs(await recentRelationEvents(db, now)), interest: interestMatrix(board.events) };
    await db.insert("board_snapshots", { generated_at: seen, payload: board });

    const stats: PipelineStats = {
      feedsOk: ingested.ok,
      feedsFailed: ingested.failed,
      ingested: ingested.articles.length,
      windowArticles: articles.length,
      clusters: clusters.length,
      extracted,
      refreshed,
      attached: plan.attach.length,
      boardEvents: board.events.length,
      errors,
    };
    await db.update("pipeline_runs", `id=eq.${run.id}`, { finished_at: new Date().toISOString(), stats });
    return stats;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.update("pipeline_runs", `id=eq.${run.id}`, { error: message }).catch(() => {});
    throw err;
  }
}
