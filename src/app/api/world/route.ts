import { readBoard, readerDb } from "@/services/world";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 파이프라인이 30분마다 새 상황판을 만든다. 화면은 1분 CDN 캐시로 읽기만 한다
export async function GET() {
  try {
    const board = await readBoard(readerDb());
    if (!board) return Response.json({ error: "아직 상황판이 없습니다" }, { status: 503, headers: { "Cache-Control": "public, s-maxage=30" } });
    return Response.json(board, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600" } });
  } catch {
    return Response.json({ error: "세계 상황을 불러오지 못했습니다" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
