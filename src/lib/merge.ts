import type { Article } from "@/types/article";

export const DEFAULT_LIMIT = 10;
export const DEFAULT_MAX_AGE_HOURS = 72;

/** 중복 판정용 링크: https 통일, 호스트 소문자, utm_*·fragment·끝 슬래시 제거 */
export function normalizeLink(link: string): string {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return link;
  }
  url.protocol = "https:";
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith("utm_")) url.searchParams.delete(key);
  }
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
}

export interface MergeOptions {
  limit?: number;
  maxAgeHours?: number;
  now?: Date;
}

/**
 * 여러 피드의 기사를 합친다: 링크 기준 중복 제거(먼저 나온 것 유지) →
 * maxAgeHours보다 오래된 기사 제외(날짜 없는 기사는 유지) → 최신순(날짜 없음은 맨 뒤) → limit.
 */
export function mergeArticles(lists: Article[][], opts: MergeOptions = {}): Article[] {
  const { limit = DEFAULT_LIMIT, maxAgeHours = DEFAULT_MAX_AGE_HOURS, now = new Date() } = opts;
  const cutoff = now.getTime() - maxAgeHours * 3_600_000;
  const seen = new Set<string>();
  const merged: Article[] = [];

  for (const article of lists.flat()) {
    const key = normalizeLink(article.link);
    if (seen.has(key)) continue;
    seen.add(key);
    if (article.publishedAt && Date.parse(article.publishedAt) < cutoff) continue;
    merged.push(article);
  }

  const time = (a: Article) => (a.publishedAt ? Date.parse(a.publishedAt) : -Infinity);
  return merged.sort((a, b) => time(b) - time(a)).slice(0, limit);
}
