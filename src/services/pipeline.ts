import { createHash } from "node:crypto";
import {
  buildEnrichPrompt,
  ENRICH_ARTICLE_LIMIT,
  ENRICH_BATCH,
  ENRICH_SCHEMA,
  insightInputHash,
  parseEnrichment,
  selectForEnrichment,
  type EnrichInput,
} from "@/lib/pipeline/enrich";
import { assignStoryIds, buildStories, type PreviousStory } from "@/lib/pipeline/stories";
import { normalizeLink } from "@/lib/merge";
import type { CatalogFeed } from "@/types/catalog";
import type { PipelineArticle } from "@/types/world";
import { loadFeed, type ParsedFeed } from "./rss";
import type { Db } from "./supabase";

/**
 * 세계 흐름 파이프라인 (GitHub Actions에서 매시간 실행, scripts/run-pipeline.ts).
 * Ingest → Normalize(upsert, 링크 기준 멱등) → Aggregate(사건, id 이어 쓰기) → Snapshot(시간축)
 * → Enrich(AI, 선택) → 정리. 화면은 /api/insights로 결과만 읽는다.
 */

const HOUR = 3_600_000;
/** 수집 시 이보다 오래된 기사는 저장하지 않는다 */
const INGEST_MAX_AGE_H = 48;
/** 사건 계산에 쓰는 기간 */
const WINDOW_H = 24;
/** 이전 사건 이어 쓰기 대상 기간 */
const PREVIOUS_H = 48;
const KEEP_ARTICLES_DAYS = 14;
const KEEP_STORIES_DAYS = 30;
const KEEP_SNAPSHOTS_DAYS = 7;

export interface PipelineStats {
  feedsOk: number;
  feedsFailed: number;
  ingested: number;
  windowArticles: number;
  stories: number;
  enriched: number;
  enrichErrors: string[];
  /** 최근 24시간 나라별 기사 수 (지도) */
  countries: Record<string, number>;
}

export interface PipelineDeps {
  db: Db;
  feeds: readonly CatalogFeed[];
  load?: (url: string, opts: { source: string; timeoutMs: number }) => Promise<ParsedFeed>;
  /** AI 보강. 없으면(키 없음) 건너뛴다 */
  enrich?: (prompt: string, schema: object) => Promise<{ value: unknown; model: string }>;
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
  image: string | null;
  published_at: string;
}

const toRow = (a: PipelineArticle): ArticleRow => ({
  id: a.id,
  link: a.link,
  title: a.title,
  summary: a.summary ?? null,
  source: a.source,
  feed_id: a.feedId,
  country: a.country,
  continent: a.continent,
  category: a.category,
  image: a.image ?? null,
  published_at: a.publishedAt,
});

const fromRow = (r: ArticleRow): PipelineArticle => ({
  id: r.id,
  link: r.link,
  title: r.title,
  ...(r.summary ? { summary: r.summary } : {}),
  source: r.source,
  feedId: r.feed_id,
  country: r.country,
  continent: r.continent,
  category: r.category as PipelineArticle["category"],
  ...(r.image ? { image: r.image } : {}),
  publishedAt: r.published_at,
});

const iso = (ms: number) => new Date(ms).toISOString();
const hourOf = (d: Date) => iso(Math.floor(d.getTime() / HOUR) * HOUR);
const inList = (ids: string[]) => `in.(${ids.map((id) => `"${id}"`).join(",")})`;

async function ingest(deps: Required<Pick<PipelineDeps, "feeds" | "load">>, now: Date) {
  const articles: PipelineArticle[] = [];
  let ok = 0;
  let failed = 0;
  const queue = [...deps.feeds];
  await Promise.all(
    Array.from({ length: Math.min(20, queue.length) }, async () => {
      for (let feed = queue.shift(); feed; feed = queue.shift()) {
        try {
          const { articles: list } = await deps.load(feed.url, { source: feed.name, timeoutMs: 8_000 });
          ok++;
          for (const a of list) {
            if (!a.publishedAt || now.getTime() - Date.parse(a.publishedAt) > INGEST_MAX_AGE_H * HOUR) continue;
            articles.push({
              id: articleKey(a.link),
              link: a.link,
              title: a.title,
              ...(a.summary ? { summary: a.summary } : {}),
              source: a.source,
              feedId: feed.id,
              country: feed.country,
              continent: feed.continent,
              category: feed.category,
              ...(a.image ? { image: a.image } : {}),
              publishedAt: a.publishedAt,
            });
          }
        } catch {
          failed++;
        }
      }
    }),
  );
  // 같은 링크가 여러 피드에 있으면 하나만 (upsert 한 배치 안 충돌 방지)
  const unique = [...new Map(articles.map((a) => [a.id, a])).values()];
  return { articles: unique, ok, failed };
}

export async function runPipeline(deps: PipelineDeps): Promise<PipelineStats> {
  const { db, feeds, load = loadFeed, enrich, now = new Date(), log = () => {} } = deps;
  const run = await db.insert<{ id: number }>("pipeline_runs", { started_at: now.toISOString() });

  try {
    // 1) Ingest + Normalize
    const ingested = await ingest({ feeds, load }, now);
    await db.upsert("articles", ingested.articles.map(toRow), { ignoreDuplicates: true });
    log(`수집: 피드 ${ingested.ok}개 성공, ${ingested.failed}개 실패, 기사 ${ingested.articles.length}개`);

    // 2) Aggregate: 최근 24시간 기사로 사건 만들기
    const since = iso(now.getTime() - WINDOW_H * HOUR);
    const windowRows = await db.select<ArticleRow>("articles", `select=*&published_at=gte.${since}&order=published_at.desc`, {
      all: true,
    });
    const windowArticles = windowRows.map(fromRow);
    const previousRows = await db.select<{ id: string; terms: string[]; story_articles: { article_id: string }[] }>(
      "stories",
      `select=id,terms,story_articles(article_id)&last_seen_at=gte.${iso(now.getTime() - PREVIOUS_H * HOUR)}`,
    );
    const previous: PreviousStory[] = previousRows.map((r) => ({
      id: r.id,
      terms: r.terms,
      articleIds: r.story_articles.map((sa) => sa.article_id),
    }));
    const stories = assignStoryIds(buildStories(windowArticles, now), previous, now);
    log(`사건: ${stories.length}개 (기사 ${windowArticles.length}개 기준)`);

    await db.upsert(
      "stories",
      stories.map((s) => ({
        id: s.id,
        lead_title: s.leadTitle,
        lead_link: s.leadLink,
        image: s.image ?? null,
        terms: s.terms,
        countries: s.countries,
        sources: s.sources,
        size: s.articleIds.length,
        score: s.score,
        last_seen_at: now.toISOString(),
      })),
      { onConflict: "id" },
    );
    await db.upsert(
      "story_articles",
      stories.flatMap((s) => s.articleIds.map((article_id) => ({ story_id: s.id, article_id }))),
      { onConflict: "story_id,article_id", ignoreDuplicates: true },
    );

    // 3) Snapshot: 시간축
    await db.upsert(
      "story_snapshots",
      stories.map((s) => ({ story_id: s.id, at: hourOf(now), size: s.articleIds.length, countries: s.countries.length })),
      { onConflict: "story_id,at" },
    );

    // 4) Enrich (AI): 새로 생기거나 바뀐 사건만, 무료 한도 안에서
    let enriched = 0;
    const enrichErrors: string[] = [];
    if (enrich && stories.length > 0) {
      const existingRows = await db.select<{ story_id: string; input_hash: string; generated_at: string }>(
        "story_insights",
        `select=story_id,input_hash,generated_at&story_id=${inList(stories.map((s) => s.id))}`,
      );
      const existing = new Map(existingRows.map((r) => [r.story_id, { inputHash: r.input_hash, generatedAt: r.generated_at }]));
      const targets = selectForEnrichment(stories, existing, now);
      const byId = new Map(windowArticles.map((a) => [a.id, a]));

      for (let i = 0; i < targets.length; i += ENRICH_BATCH) {
        const batch = targets.slice(i, i + ENRICH_BATCH);
        const inputs: EnrichInput[] = batch.map((s) => ({
          storyId: s.id,
          articles: s.articleIds
            .slice(0, ENRICH_ARTICLE_LIMIT)
            .map((id) => byId.get(id))
            .filter((a): a is PipelineArticle => !!a)
            .map((a) => ({ id: a.id, title: a.title, source: a.source, country: a.country, ...(a.summary ? { summary: a.summary } : {}) })),
        }));
        try {
          const { value, model } = await enrich(buildEnrichPrompt(inputs), ENRICH_SCHEMA);
          const results = parseEnrichment(value, inputs);
          const generatedAt = now.toISOString();
          const rows = [...results].map(([storyId, r]) => ({
            story_id: storyId,
            input_hash: insightInputHash(inputs.find((x) => x.storyId === storyId)!.articles.map((a) => a.id)),
            model,
            title_ko: r.title,
            summary_ko: r.summary,
            why_ko: r.why ?? null,
            perspectives: r.perspectives.map((p) => ({ country: p.country, angle_ko: p.angle, article_ids: p.articleIds })),
            generated_at: generatedAt,
          }));
          await db.upsert("story_insights", rows, { onConflict: "story_id" });
          const entities = [...new Map([...results.values()].flatMap((r) => r.entities).map((e) => [e.id, e])).values()];
          await db.upsert(
            "entities",
            entities.map((e) => ({ id: e.id, name: e.name, name_ko: e.nameKo ?? null, type: e.type })),
            { onConflict: "id" },
          );
          await db.upsert(
            "story_entities",
            [...results].flatMap(([storyId, r]) => r.entities.map((e) => ({ story_id: storyId, entity_id: e.id }))),
            { onConflict: "story_id,entity_id", ignoreDuplicates: true },
          );
          enriched += results.size;
        } catch (err) {
          enrichErrors.push(err instanceof Error ? err.message : String(err));
        }
      }
      log(`AI 보강: ${enriched}개${enrichErrors.length ? `, 오류 ${enrichErrors.length}건` : ""}`);
    }

    // 5) 지도용 나라별 기사 수
    const countries: Record<string, number> = {};
    for (const a of windowArticles) countries[a.country] = (countries[a.country] ?? 0) + 1;

    // 6) 정리 (무료 DB 500MB 안에서)
    await db.remove("articles", `published_at=lt.${iso(now.getTime() - KEEP_ARTICLES_DAYS * 24 * HOUR)}`);
    await db.remove("stories", `last_seen_at=lt.${iso(now.getTime() - KEEP_STORIES_DAYS * 24 * HOUR)}`);
    await db.remove("story_snapshots", `at=lt.${iso(now.getTime() - KEEP_SNAPSHOTS_DAYS * 24 * HOUR)}`);

    const stats: PipelineStats = {
      feedsOk: ingested.ok,
      feedsFailed: ingested.failed,
      ingested: ingested.articles.length,
      windowArticles: windowArticles.length,
      stories: stories.length,
      enriched,
      enrichErrors,
      countries,
    };
    await db.update("pipeline_runs", `id=eq.${run.id}`, { finished_at: new Date().toISOString(), stats });
    return stats;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.update("pipeline_runs", `id=eq.${run.id}`, { error: message }).catch(() => {});
    throw err;
  }
}
