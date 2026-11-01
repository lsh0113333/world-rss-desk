import type { PipelineArticle } from "@/types/world";
import { hashId } from "../text";
import { findEvents, type EventItem, type FoundEvent } from "./events";

/**
 * 규칙으로 묶기 + AI에 무엇을 보낼지 정하기 (무료 한도 보호).
 * 묶음은 세계(여러 나라) → IT 피드 → 나라 안 순서로 찾고, 기사 하나는 묶음 하나에만 들어간다.
 */

const WORLD_LIMIT = 40;
const IT_LIMIT = 12;
const COUNTRY_LIMIT = 4;
const HOUR = 3_600_000;

/** 한 번 실행에서 AI에 보내는 새 묶음 수 */
export const MAX_EXTRACT = 48;
/** 한 번 실행에서 다시 정리하는 사건 수 */
export const MAX_REFRESH = 6;
/** 사건이 이 배수만큼 커지고 이 시간이 지나면 다시 정리 */
const REFRESH_GROWTH = 2;
const REFRESH_AFTER_MS = 6 * HOUR;

export interface ClusterArticle {
  id: string;
  title: string;
  source: string;
  country: string;
  publishedAt: string;
  summary?: string;
}

export interface Cluster {
  key: string;
  scope: "world" | "it" | "country";
  /** 처리 순서용 (나라 수 × 3 + 매체 수) */
  rank: number;
  /** 최신순 */
  articles: ClusterArticle[];
}

function toItem(a: PipelineArticle): EventItem {
  return {
    article: { id: a.id, title: a.title, link: a.link, publishedAt: a.publishedAt, source: a.source, ...(a.summary ? { summary: a.summary } : {}) },
    country: a.country,
    category: a.category,
  };
}

function toCluster(issue: FoundEvent, scope: Cluster["scope"]): Cluster {
  return {
    key: `${scope[0]}-${hashId(issue.id)}`,
    scope,
    rank: issue.countries.length * 3 + issue.sources.length,
    articles: issue.items.map((i) => ({
      id: i.article.id,
      title: i.article.title,
      source: i.article.source,
      country: i.country ?? "",
      publishedAt: i.article.publishedAt ?? "",
      ...(i.article.summary ? { summary: i.article.summary } : {}),
    })),
  };
}

export function findClusters(articles: PipelineArticle[]): Cluster[] {
  const items = articles.map(toItem);
  const clusters: Cluster[] = [];
  const used = new Set<string>();
  const take = (list: EventItem[], scope: Cluster["scope"], opts: Parameters<typeof findEvents>[1]) => {
    for (const issue of findEvents(list, opts)) {
      clusters.push(toCluster(issue, scope));
      for (const i of issue.items) used.add(i.article.id);
    }
  };
  const rest = () => items.filter((i) => !used.has(i.article.id));

  take(items, "world", { limit: WORLD_LIMIT });
  take(rest().filter((i) => i.category === "tech"), "it", { limit: IT_LIMIT, minSources: 2, minCountries: 1 });
  const byCountry = new Map<string, EventItem[]>();
  for (const item of rest()) byCountry.set(item.country ?? "", [...(byCountry.get(item.country ?? "") ?? []), item]);
  for (const [, list] of [...byCountry].sort(([a], [b]) => a.localeCompare(b))) {
    take(list, "country", { limit: COUNTRY_LIMIT, minSources: 2, minCountries: 1 });
  }
  return clusters;
}

export interface EventProgress {
  extractedSize: number;
  extractedAt: string;
}

export interface ClusterPlan {
  /** AI에 보낼 새 묶음 (아직 안 보낸 기사만) */
  extract: Cluster[];
  /** AI 없이 기존 사건에 붙일 기사 */
  attach: { articleId: string; eventId: string }[];
  /** 커져서 다시 정리할 사건 */
  refresh: { eventId: string; cluster: Cluster }[];
}

export function planClusters(
  clusters: Cluster[],
  assigned: ReadonlyMap<string, string>,
  sent: ReadonlySet<string>,
  progress: ReadonlyMap<string, EventProgress>,
  now: Date,
  opts: { maxExtract?: number; maxRefresh?: number } = {},
): ClusterPlan {
  const extract: Cluster[] = [];
  const attach: ClusterPlan["attach"] = [];
  const refresh: ClusterPlan["refresh"] = [];

  for (const cluster of clusters) {
    const counts = new Map<string, number>();
    for (const a of cluster.articles) {
      const eventId = assigned.get(a.id);
      if (eventId) counts.set(eventId, (counts.get(eventId) ?? 0) + 1);
    }
    if (counts.size === 0) {
      const fresh = cluster.articles.filter((a) => !sent.has(a.id));
      if (new Set(fresh.map((a) => a.source)).size >= 2) extract.push({ ...cluster, articles: fresh });
      continue;
    }
    const [eventId] = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    const unassigned = cluster.articles.filter((a) => !assigned.has(a.id));
    for (const a of unassigned) attach.push({ articleId: a.id, eventId });
    const state = progress.get(eventId);
    const size = counts.get(eventId)! + unassigned.length;
    if (state && size >= state.extractedSize * REFRESH_GROWTH && now.getTime() - Date.parse(state.extractedAt) >= REFRESH_AFTER_MS) {
      refresh.push({ eventId, cluster });
    }
  }

  const byRank = (a: Cluster, b: Cluster) => b.rank - a.rank || a.key.localeCompare(b.key);
  return {
    extract: extract.sort(byRank).slice(0, opts.maxExtract ?? MAX_EXTRACT),
    attach,
    refresh: refresh.sort((a, b) => byRank(a.cluster, b.cluster)).slice(0, opts.maxRefresh ?? MAX_REFRESH),
  };
}
