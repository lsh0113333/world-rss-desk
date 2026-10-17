import { getFeedById } from "@/lib/catalog";
import { FeedFetchError } from "@/lib/errors";
import { DEFAULT_LIMIT, DEFAULT_MAX_AGE_HOURS, mergeArticles } from "@/lib/merge";
import { assertSafeUrl } from "@/lib/url-guard";
import { loadFeed } from "@/services/rss";
import type { Article, FeedError, FeedsResponse } from "@/types/article";

// DNS 조회(url-guard)가 필요하므로 Edge가 아닌 Node 런타임
export const runtime = "nodejs";

const MAX_FEEDS = 12;
const MAX_LIMIT = 50;
const MAX_AGE_HOURS_LIMIT = 720;
const CDN_CACHE = "public, s-maxage=120, stale-while-revalidate=600";

function badRequest(error: string) {
  return Response.json({ error }, { status: 400, headers: { "Cache-Control": "no-store" } });
}

/** 정수 파라미터. 없으면 fallback, 범위를 벗어나거나 숫자가 아니면 null */
function intParam(value: string | null, fallback: number, min: number, max: number): number | null {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value)) return null;
  const n = Number(value);
  return n >= min && n <= max ? n : null;
}

interface Job {
  feed: string;
  url: string | null;
  source?: string;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  const ids = [...new Set((params.get("ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean))];
  const urls = [...new Set(params.getAll("urls").map((s) => s.trim()).filter(Boolean))];
  if (ids.length + urls.length === 0) return badRequest("ids 또는 urls가 필요합니다");
  if (ids.length + urls.length > MAX_FEEDS) return badRequest(`피드는 최대 ${MAX_FEEDS}개까지 요청할 수 있습니다`);

  const limit = intParam(params.get("limit"), DEFAULT_LIMIT, 1, MAX_LIMIT);
  if (limit === null) return badRequest(`limit은 1~${MAX_LIMIT} 사이 정수여야 합니다`);
  const maxAgeHours = intParam(params.get("maxAgeHours"), DEFAULT_MAX_AGE_HOURS, 1, MAX_AGE_HOURS_LIMIT);
  if (maxAgeHours === null) return badRequest(`maxAgeHours는 1~${MAX_AGE_HOURS_LIMIT} 사이 정수여야 합니다`);
  const fresh = params.get("fresh") === "1";

  const jobs: Job[] = [
    ...ids.map((id) => {
      const feed = getFeedById(id);
      return { feed: id, url: feed?.url ?? null, source: feed?.name };
    }),
    ...urls.map((url) => ({ feed: url, url })),
  ];

  const results = await Promise.allSettled(
    jobs.map(async (job) => {
      if (!job.url) throw new FeedFetchError("더 이상 제공되지 않는 매체입니다");
      const { articles } = await loadFeed(job.url, { source: job.source, fresh, checkUrl: assertSafeUrl });
      return articles;
    }),
  );

  const lists: Article[][] = [];
  const errors: FeedError[] = [];
  results.forEach((result, i) => {
    if (result.status === "fulfilled") lists.push(result.value);
    else {
      const message = result.reason instanceof FeedFetchError ? result.reason.message : "불러오기 실패";
      errors.push({ feed: jobs[i].feed, message });
    }
  });

  const body: FeedsResponse = {
    articles: mergeArticles(lists, { limit, maxAgeHours }),
    errors,
    fetchedAt: new Date().toISOString(),
  };
  return Response.json(body, { headers: { "Cache-Control": fresh ? "no-store" : CDN_CACHE } });
}
