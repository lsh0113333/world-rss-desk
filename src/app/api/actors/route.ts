import { readActor, readerDb } from "@/services/world";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/** 행위자 페이지: GET /api/actors?id=country:US */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!/^(actor|country):/.test(id) || id.length > 200) return Response.json({ error: "행위자 id가 올바르지 않습니다" }, { status: 400, headers: NO_STORE });
  try {
    const profile = await readActor(readerDb(), id);
    if (!profile) return Response.json({ error: "행위자를 찾지 못했습니다" }, { status: 404, headers: { "Cache-Control": "public, s-maxage=60" } });
    return Response.json(profile, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900" } });
  } catch {
    return Response.json({ error: "행위자를 불러오지 못했습니다" }, { status: 502, headers: NO_STORE });
  }
}
