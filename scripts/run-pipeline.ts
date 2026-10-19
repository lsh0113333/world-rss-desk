/**
 * 세계 흐름 파이프라인 실행 (GitHub Actions 매시간, .github/workflows/pipeline.yml).
 * 필요 env: SUPABASE_URL, SUPABASE_SECRET_KEY. 선택: GEMINI_API_KEY(없으면 AI 보강 생략), GEMINI_MODELS(쉼표 구분)
 * 로컬 실행: npm run pipeline (env는 직접 넣는다)
 */
import { CATALOG } from "@/lib/catalog";
import { DEFAULT_MODELS, generateJson } from "@/services/gemini";
import { runPipeline } from "@/services/pipeline";
import { createDb } from "@/services/supabase";

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL, SUPABASE_SECRET_KEY가 필요합니다");

  const apiKey = process.env.GEMINI_API_KEY;
  const models = process.env.GEMINI_MODELS?.split(",").map((m) => m.trim()).filter(Boolean) ?? DEFAULT_MODELS;
  const enrich = apiKey ? (prompt: string, schema: object) => generateJson({ apiKey, models, prompt, schema }) : undefined;

  const started = Date.now();
  const stats = await runPipeline({ db: createDb({ url, key }), feeds: CATALOG, enrich, log: (m) => console.log(m) });
  console.log(`완료 (${Math.round((Date.now() - started) / 1000)}초)`, JSON.stringify({ ...stats, countries: Object.keys(stats.countries).length }));
  if (stats.enrichErrors.length) console.warn("AI 오류:", stats.enrichErrors.join(" | "));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
