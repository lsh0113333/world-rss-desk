import { createDb } from "@/services/supabase";
import { readWorldInsights } from "@/services/world-insights";
import type { WorldInsights } from "@/types/world";

// 세계 흐름: 매시간 파이프라인(GitHub Actions)이 Supabase에 쌓은 사건·AI 결과를 읽는다 (읽기 전용 키)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMPTY: WorldInsights = { updatedAt: null, stories: [], countries: {} };

export async function GET() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return Response.json(EMPTY, { headers: { "Cache-Control": "no-store" } });
  try {
    const insights = await readWorldInsights(createDb({ url, key }));
    // 아직 결과가 없으면(첫 실행 전) 빈 응답을 오래 캐시하지 않는다
    const cache = insights.updatedAt ? "public, s-maxage=300, stale-while-revalidate=900" : "public, s-maxage=30";
    return Response.json(insights, { headers: { "Cache-Control": cache } });
  } catch (err) {
    console.error("insights", err instanceof Error ? err.message : err);
    return Response.json({ error: "세계 흐름을 불러오지 못했습니다" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
