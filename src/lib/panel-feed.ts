import type { Article } from "@/types/article";
import type { Panel } from "@/types/layout";
import { getFeedById } from "./catalog";

/** 패널 → /api/feeds URL (SWR 키). 카탈로그에서 빠진 id는 제외. 피드가 없으면 null */
export function buildFeedsUrl(panel: Panel, opts: { fresh?: boolean } = {}): string | null {
  const ids = panel.feedIds.filter((id) => getFeedById(id));
  if (ids.length === 0 && panel.customUrls.length === 0) return null;
  const params = new URLSearchParams();
  if (ids.length) params.set("ids", ids.join(","));
  for (const url of panel.customUrls) params.append("urls", url);
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
