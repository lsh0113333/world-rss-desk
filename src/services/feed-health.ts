import { FeedFetchError } from "@/lib/errors";
import type { CatalogFeed } from "@/types/catalog";
import { loadFeed, type ParsedFeed } from "./rss";

/** 카탈로그 피드 자동 점검 (매일 1회 cron + 설정 메뉴 "피드 상태") */

export interface FeedIssue {
  id: string;
  name: string;
  detail: string;
}

export interface FeedHealthReport {
  checkedAt: string;
  total: number;
  ok: number;
  /** 받아지지만 최신 기사가 오래된 피드 */
  stale: FeedIssue[];
  /** 못 받거나 기사가 없는 피드 */
  failed: FeedIssue[];
}

export interface CheckOptions {
  load?: (url: string, opts: { source: string; timeoutMs: number }) => Promise<ParsedFeed>;
  now?: Date;
  concurrency?: number;
  timeoutMs?: number;
  staleHours?: number;
}

export async function checkFeeds(feeds: readonly CatalogFeed[], opts: CheckOptions = {}): Promise<FeedHealthReport> {
  const { load = loadFeed, now = new Date(), concurrency = 20, timeoutMs = 6_000, staleHours = 72 } = opts;
  const stale: FeedIssue[] = [];
  const failed: FeedIssue[] = [];

  async function check(feed: CatalogFeed) {
    const issue = (detail: string): FeedIssue => ({ id: feed.id, name: feed.name, detail });
    try {
      const { articles } = await load(feed.url, { source: feed.name, timeoutMs });
      if (articles.length === 0) return failed.push(issue("기사 0개"));
      const dates = articles.map((a) => (a.publishedAt ? Date.parse(a.publishedAt) : NaN)).filter((d) => !Number.isNaN(d));
      if (dates.length === 0) return stale.push(issue("날짜 없음"));
      const age = (now.getTime() - Math.max(...dates)) / 3_600_000;
      if (age > staleHours) stale.push(issue(`최신 기사 ${Math.round(age)}시간 전`));
    } catch (err) {
      failed.push(issue(err instanceof FeedFetchError ? err.message : "불러오기 실패"));
    }
  }

  const queue = [...feeds];
  await Promise.all(
    Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      for (let feed = queue.shift(); feed; feed = queue.shift()) await check(feed);
    }),
  );

  const byId = (a: FeedIssue, b: FeedIssue) => a.id.localeCompare(b.id);
  return {
    checkedAt: now.toISOString(),
    total: feeds.length,
    ok: feeds.length - stale.length - failed.length,
    stale: stale.sort(byId),
    failed: failed.sort(byId),
  };
}
