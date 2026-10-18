import type { Article } from "@/types/article";
import type { Panel } from "@/types/layout";
import type { CatalogFeed } from "@/types/catalog";
import { feedsFor, getFeedById } from "./catalog";
import { panelTitle } from "./constants";

/** 패널 기본 제목: 키워드 패널은 "🔎 검색어", 그 밖에는 "🇰🇷 한국 · 경제" */
export function defaultPanelTitle(panel: Panel): string {
  return panel.query && !panel.country && !panel.category ? `🔎 ${panel.query}` : panelTitle(panel.country, panel.category);
}

/** 패널 → /api/feeds URL (SWR 키). 카탈로그에서 빠진 id는 제외. 피드가 없으면 null */
export function buildFeedsUrl(panel: Panel, opts: { fresh?: boolean } = {}): string | null {
  const ids = panel.feedIds.filter((id) => getFeedById(id));
  if (ids.length === 0 && panel.customUrls.length === 0 && !panel.query) return null;
  const params = new URLSearchParams();
  if (ids.length) params.set("ids", ids.join(","));
  for (const url of panel.customUrls) params.append("urls", url);
  if (panel.query) params.set("q", panel.query);
  params.set("limit", String(panel.limit));
  if (opts.fresh) params.set("fresh", "1");
  return `/api/feeds?${params.toString()}`;
}

export function isNewArticle(article: Article, lastSeenAt: string | undefined): boolean {
  if (!lastSeenAt || !article.publishedAt) return false;
  return Date.parse(article.publishedAt) > Date.parse(lastSeenAt);
}

export function countNew(articles: Article[], lastSeenAt: string | undefined): number {
  return articles.filter((a) => isNewArticle(a, lastSeenAt)).length;
}

/** 에러 목록 표시용: 카탈로그 id는 매체명, 커스텀 URL은 그대로 */
export function feedLabel(feed: string): string {
  if (feed.startsWith("q:")) return `구글 뉴스 '${feed.slice(2)}'`;
  return getFeedById(feed)?.name ?? feed;
}

/** 매체명 → 주석 (예: CGTN → 중국 정부 시각) */
export function sourceNotes(panel: Panel): Record<string, string> {
  const notes: Record<string, string> = {};
  for (const id of panel.feedIds) {
    const feed = getFeedById(id);
    if (feed?.note) notes[feed.name] = feed.note;
  }
  return notes;
}

/** 패널 칩 목록: 나라·분야에 해당하는 카탈로그 피드 + 그 밖에 선택돼 있는 피드 */
export function panelFeedOptions(panel: Panel): CatalogFeed[] {
  const base = panel.country || panel.category ? feedsFor(panel.country, panel.category) : [];
  const extra = panel.feedIds.map((id) => getFeedById(id)).filter((f): f is CatalogFeed => !!f && !base.includes(f));
  return [...base, ...extra];
}

/** 칩 토글. 최대 개수를 넘는 추가는 무시 */
export function toggleFeed(feedIds: string[], id: string, max: number): string[] {
  if (feedIds.includes(id)) return feedIds.filter((x) => x !== id);
  return feedIds.length >= max ? feedIds : [...feedIds, id];
}
