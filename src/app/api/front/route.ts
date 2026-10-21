import { loadFront } from "@/services/front";

// DNS 조회(url-guard)가 필요하므로 Node 런타임. 매체 130여 곳을 한 번에 받는다(로컬 약 12초)
export const runtime = "nodejs";
export const maxDuration = 60;
// 빌드 때 미리 만들지 않는다 (빌드가 네트워크에 의존하지 않게). 캐시는 CDN이 맡는다
export const dynamic = "force-dynamic";

// 10분마다 새로 모으고, 그 사이와 이후 하루 동안은 CDN의 이전 결과를 즉시 준다 (뒤에서 갱신)
const CDN_CACHE = "public, s-maxage=600, stale-while-revalidate=86400";

function failed() {
  return Response.json({ error: "뉴스를 불러오지 못했습니다" }, { status: 502, headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  try {
    const front = await loadFront();
    if (front.continents.length === 0) return failed();
    return Response.json(front, { headers: { "Cache-Control": CDN_CACHE } });
  } catch {
    return failed();
  }
}
