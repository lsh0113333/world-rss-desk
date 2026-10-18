import { revalidateTag, unstable_cache } from "next/cache";
import { CATALOG } from "@/lib/catalog";
import { assertSafeUrl } from "@/lib/url-guard";
import { checkFeeds } from "@/services/feed-health";
import { loadFeed } from "@/services/rss";

// 카탈로그 전체 점검. 결과는 24시간 캐시하고, 매일 06:00(KST) Vercel cron이 CRON_SECRET으로 다시 점검시킨다
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const TAG = "feed-health";

const getReport = unstable_cache(
  () => checkFeeds(CATALOG, { load: (url, opts) => loadFeed(url, { ...opts, fresh: true, checkUrl: assertSafeUrl }) }),
  ["feed-health-v1"],
  { revalidate: 86_400, tags: [TAG] },
);

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") === `Bearer ${secret}`) revalidateTag(TAG);
  const report = await getReport();
  return Response.json(report, { headers: { "Cache-Control": "no-store" } });
}
