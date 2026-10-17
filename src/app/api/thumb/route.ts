import { extractOgImage } from "@/lib/og-image";
import { assertSafeUrl } from "@/lib/url-guard";
import { fetchText } from "@/services/http";

// RSS에 이미지가 없는 기사의 대표 이미지(og:image)로 리다이렉트. <img src="/api/thumb?url=...">로 사용
export const runtime = "nodejs";

const DAY_CACHE = "public, s-maxage=86400, stale-while-revalidate=604800";

export async function GET(request: Request) {
  const url = new URL(request.url).searchParams.get("url")?.trim();
  if (!url) return new Response(null, { status: 400 });

  try {
    const page = await fetchText(url, {
      timeoutMs: 6_000,
      maxBytes: 2 * 1024 * 1024,
      revalidateSeconds: 86_400,
      accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
      checkUrl: assertSafeUrl,
    });
    const image = extractOgImage(page.text, page.url);
    if (image) return new Response(null, { status: 302, headers: { Location: image, "Cache-Control": DAY_CACHE } });
  } catch {
    // 차단·실패 → 이미지 없음
  }
  return new Response(null, { status: 404, headers: { "Cache-Control": DAY_CACHE } });
}
