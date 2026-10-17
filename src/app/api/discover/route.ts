import { assertSafeUrl } from "@/lib/url-guard";
import { discoverFeeds } from "@/services/discover";

// 사이트 주소 → RSS 찾기 (편집 창의 "RSS 또는 사이트 주소 추가")
export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url).searchParams.get("url")?.trim();
  if (!url) return Response.json({ feeds: [], error: "url이 필요합니다" }, { status: 400 });
  const result = await discoverFeeds(url, { checkUrl: assertSafeUrl });
  return Response.json(result, { headers: { "Cache-Control": "public, s-maxage=3600" } });
}
