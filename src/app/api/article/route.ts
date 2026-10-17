import { FeedFetchError } from "@/lib/errors";
import { assertSafeUrl } from "@/lib/url-guard";
import { viewArticle } from "@/services/article";

// DNS 조회(url-guard)와 linkedom이 필요하므로 Node 런타임
export const runtime = "nodejs";

const CDN_CACHE = "public, s-maxage=3600, stale-while-revalidate=86400";

function error(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  const url = new URL(request.url).searchParams.get("url")?.trim();
  if (!url) return error("url이 필요합니다", 400);

  try {
    const view = await viewArticle(url, { checkUrl: assertSafeUrl });
    return Response.json(view, { headers: { "Cache-Control": CDN_CACHE } });
  } catch (err) {
    if (err instanceof FeedFetchError) return error(err.message, 400);
    return error("원문을 불러오는 중 오류가 발생했습니다", 500);
  }
}
