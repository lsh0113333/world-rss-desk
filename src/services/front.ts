import { CATALOG } from "@/lib/catalog";
import { FeedFetchError } from "@/lib/errors";
import { buildFront, selectOutlets } from "@/lib/newsstand";
import { assertSafeUrl } from "@/lib/url-guard";
import type { Article, FeedError } from "@/types/article";
import type { CatalogFeed } from "@/types/catalog";
import type { FrontResponse } from "@/types/front";
import { loadFeed } from "./rss";

/** 매체당 보내는 제목 수 (화면은 3개, 나중에 "더 보기"용 여유) */
export const FRONT_PER_OUTLET = 5;
const CONCURRENCY = 24;

interface Options {
  catalog?: readonly CatalogFeed[];
}

/** 가판대: 매체별 대표 피드를 한꺼번에 받아 대륙 → 나라 → 매체로 묶는다. 실패한 피드는 errors로 */
export async function loadFront({ catalog = CATALOG }: Options = {}): Promise<FrontResponse> {
  const picks = selectOutlets(catalog);
  const results = new Map<string, Article[]>();
  const errors: FeedError[] = [];

  let next = 0;
  async function worker() {
    while (next < picks.length) {
      const { feed, name } = picks[next++];
      try {
        const { articles } = await loadFeed(feed.url, { source: name, checkUrl: assertSafeUrl });
        results.set(feed.id, articles);
      } catch (e) {
        errors.push({ feed: feed.id, message: e instanceof FeedFetchError ? e.message : "불러오기 실패" });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, picks.length) }, worker));

  return { fetchedAt: new Date().toISOString(), continents: buildFront(picks, results, FRONT_PER_OUTLET), errors };
}
