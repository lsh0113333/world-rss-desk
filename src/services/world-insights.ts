import { hourlyTrend, isRising } from "@/lib/world";
import type { EntityRef, EntityType, StoryInsight, WorldInsights, WorldStory, WorldStoryArticle } from "@/types/world";
import type { Db } from "./supabase";

/** 화면용 세계 흐름 읽기 (/api/insights). 파이프라인이 Supabase에 쌓은 결과를 WorldInsights로 바꾼다 */

const STORY_LIMIT = 24;
const ARTICLES_PER_STORY = 30;
/** 최근 실행 시작 이 시간 전 이후에 본 사건만 */
const FRESH_MS = 2 * 3_600_000;

interface InsightRow {
  title_ko: string;
  summary_ko: string[];
  why_ko: string | null;
  perspectives: { country: string; angle_ko: string; article_ids: string[] }[];
  model: string;
  generated_at: string;
}

interface StoryRow {
  id: string;
  lead_title: string;
  image: string | null;
  terms: string[];
  countries: string[];
  sources: string[];
  size: number;
  first_seen_at: string;
  last_seen_at: string;
  story_insights: InsightRow | InsightRow[] | null;
  story_entities: { entities: { id: string; name: string; name_ko: string | null; type: string } | null }[];
}

interface StoryArticleRow {
  story_id: string;
  articles: { id: string; title: string; link: string; source: string; country: string; image: string | null; published_at: string } | null;
}

const EMPTY: WorldInsights = { updatedAt: null, stories: [], countries: {} };

function toInsight(raw: StoryRow["story_insights"]): StoryInsight | undefined {
  const row = Array.isArray(raw) ? raw[0] : raw;
  if (!row) return undefined;
  return {
    title: row.title_ko,
    summary: row.summary_ko,
    ...(row.why_ko ? { why: row.why_ko } : {}),
    perspectives: row.perspectives.map((p) => ({ country: p.country, angle: p.angle_ko, articleIds: p.article_ids })),
    model: row.model,
    generatedAt: row.generated_at,
  };
}

export async function readWorldInsights(db: Db, now: Date = new Date()): Promise<WorldInsights> {
  const [run] = await db.select<{ started_at: string; finished_at: string; stats: { countries?: Record<string, number> } }>(
    "pipeline_runs",
    "select=started_at,finished_at,stats&finished_at=not.is.null&order=finished_at.desc&limit=1",
  );
  if (!run) return EMPTY;

  const since = new Date(Date.parse(run.started_at) - FRESH_MS).toISOString();
  const rows = await db.select<StoryRow>(
    "stories",
    `select=id,lead_title,image,terms,countries,sources,size,first_seen_at,last_seen_at,` +
      `story_insights(title_ko,summary_ko,why_ko,perspectives,model,generated_at),story_entities(entities(id,name,name_ko,type))` +
      `&last_seen_at=gte.${since}&order=score.desc&limit=${STORY_LIMIT}`,
  );

  const articlesByStory = new Map<string, WorldStoryArticle[]>();
  if (rows.length > 0) {
    const ids = rows.map((r) => `"${r.id}"`).join(",");
    const links = await db.select<StoryArticleRow>(
      "story_articles",
      `select=story_id,articles(id,title,link,source,country,image,published_at)&story_id=in.(${ids})`,
      { all: true },
    );
    for (const { story_id, articles: a } of links) {
      if (!a) continue;
      const list = articlesByStory.get(story_id) ?? [];
      list.push({
        id: a.id,
        title: a.title,
        link: a.link,
        source: a.source,
        country: a.country,
        ...(a.image ? { image: a.image } : {}),
        publishedAt: a.published_at,
      });
      articlesByStory.set(story_id, list);
    }
  }

  const stories: WorldStory[] = rows.map((r) => {
    const all = (articlesByStory.get(r.id) ?? []).sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
    const trend = hourlyTrend(
      all.map((a) => a.publishedAt),
      now,
    );
    const insight = toInsight(r.story_insights);
    const entities: EntityRef[] = r.story_entities
      .map((se) => se.entities)
      .filter((e): e is NonNullable<typeof e> => !!e)
      .map((e) => ({ id: e.id, name: e.name, ...(e.name_ko ? { nameKo: e.name_ko } : {}), type: e.type as EntityType }));
    return {
      id: r.id,
      leadTitle: r.lead_title,
      ...(r.image ? { image: r.image } : {}),
      terms: r.terms,
      countries: r.countries,
      sources: r.sources,
      size: r.size,
      firstSeenAt: r.first_seen_at,
      lastSeenAt: r.last_seen_at,
      trend,
      rising: isRising(trend),
      ...(insight ? { insight } : {}),
      entities,
      articles: all.slice(0, ARTICLES_PER_STORY),
    };
  });

  return { updatedAt: run.finished_at, stories, countries: run.stats.countries ?? {} };
}
