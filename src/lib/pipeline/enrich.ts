import type { EntityRef, EntityType, Perspective } from "@/types/world";
import { hashId } from "../text";

/**
 * AI 보강(Content Enricher)의 순수 부분: 대상 선택, 프롬프트, 응답 검증.
 * AI는 주어진 헤드라인·요약만 근거로 쓰고, 관점마다 근거 기사 참조를 달아야 한다. 근거 없는 관점은 버린다.
 */

/** 한 사건당 AI에 보내는 기사 수 */
export const ENRICH_ARTICLE_LIMIT = 12;
/** 한 번 호출에 묶는 사건 수 */
export const ENRICH_BATCH = 4;
/** 한 번 실행에서 보강하는 최대 사건 수 (무료 한도 보호) */
export const ENRICH_MAX = 16;
/** 기사가 바뀌어도 이 시간 안에 다시 보강하지 않는다 */
const REFRESH_MS = 3 * 60 * 60 * 1000;
const MAX_SUMMARY_LINES = 3;
const MAX_PERSPECTIVES = 4;
const MAX_ENTITIES = 8;
const ENTITY_TYPES: readonly EntityType[] = ["person", "org", "place", "topic"];

export interface EnrichArticle {
  id: string;
  title: string;
  source: string;
  country: string;
  summary?: string;
}

export interface EnrichInput {
  storyId: string;
  articles: EnrichArticle[];
}

export interface EnrichResult {
  title: string;
  summary: string[];
  why?: string;
  perspectives: Perspective[];
  entities: EntityRef[];
}

export function insightInputHash(articleIds: string[]): string {
  return hashId([...articleIds].sort().join(","));
}

export function selectForEnrichment<T extends { id: string; score: number; articleIds: string[] }>(
  stories: T[],
  existing: Map<string, { inputHash: string; generatedAt: string }>,
  now: Date,
  opts: { max?: number } = {},
): T[] {
  const max = opts.max ?? ENRICH_MAX;
  return stories
    .filter((s) => {
      const prev = existing.get(s.id);
      if (!prev) return true;
      if (prev.inputHash === insightInputHash(s.articleIds.slice(0, ENRICH_ARTICLE_LIMIT))) return false;
      return now.getTime() - Date.parse(prev.generatedAt) >= REFRESH_MS;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, max);
}

export function buildEnrichPrompt(inputs: EnrichInput[]): string {
  const blocks = inputs.map((input) => {
    const lines = input.articles.map((a, i) => {
      const summary = a.summary ? ` — ${a.summary.slice(0, 200)}` : "";
      return `[r${i + 1}] (${a.country} · ${a.source}) ${a.title}${summary}`;
    });
    return `## story ${input.storyId}\n${lines.join("\n")}`;
  });
  return `너는 국제 뉴스 데스크 편집자다. 아래 사건마다 여러 나라 매체의 헤드라인(과 짧은 요약)이 있다.
주어진 헤드라인·요약만 근거로 쓰고, 없는 사실을 지어내지 마라. 모든 출력은 자연스러운 한국어로 쓴다(고유명사는 한국어 표기, 필요하면 괄호 안에 원어).

사건마다 다음을 만든다:
- title_ko: 사건을 한 줄로 (40자 이내, 기사체)
- summary_ko: 무슨 일이 있었는지 정확히 3줄 (각 줄 한 문장)
- why_ko: 왜 중요한지 한 문장 (세계 또는 한국에 미치는 영향, 근거 범위 안에서)
- perspectives: 이 서비스의 핵심이다. 기사가 2개 이상의 나라(괄호 안 코드)에서 나왔다면, 나라별로 무엇을 강조하는지 2~${MAX_PERSPECTIVES}개 정리한다. 같은 사실을 전해도 초점(안보·경제·외교·인권·자국에 미치는 영향·당사자 입장 등)이나 표현의 온도가 다르면 그것이 시각이다. angle_ko는 "그 나라 매체는 ~에 초점을 맞춘다" 식의 한 문장, refs는 근거 기사 번호(예: "r2"). 헤드라인이 거의 같은 내용일 때만 빈 배열.
- entities: 핵심 인물·기관·장소·주제 최대 ${MAX_ENTITIES}개. name은 원어(영어), name_ko는 한국어, type은 person|org|place|topic.
헤드라인들이 사실은 서로 다른 일이라면, 공통 주제를 제목으로 삼고 summary_ko에 그렇다고 밝혀라.

${blocks.join("\n\n")}`;
}

/** Gemini responseSchema (OpenAPI 부분집합) */
export const ENRICH_SCHEMA = {
  type: "OBJECT",
  properties: {
    stories: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING" },
          title_ko: { type: "STRING" },
          summary_ko: { type: "ARRAY", items: { type: "STRING" } },
          why_ko: { type: "STRING" },
          perspectives: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                country: { type: "STRING" },
                angle_ko: { type: "STRING" },
                refs: { type: "ARRAY", items: { type: "STRING" } },
              },
              required: ["country", "angle_ko", "refs"],
            },
          },
          entities: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                name: { type: "STRING" },
                name_ko: { type: "STRING" },
                type: { type: "STRING", enum: [...ENTITY_TYPES] },
              },
              required: ["name", "type"],
            },
          },
        },
        required: ["id", "title_ko", "summary_ko", "perspectives", "entities"],
      },
    },
  },
  required: ["stories"],
} as const;

export function entityId(type: EntityType, name: string): string {
  return `${type}:${name.trim().replace(/\s+/g, " ").toLowerCase()}`;
}

const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Record<string, unknown> | undefined =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;

export function parseEnrichment(raw: unknown, inputs: EnrichInput[]): Map<string, EnrichResult> {
  const out = new Map<string, EnrichResult>();
  const byId = new Map(inputs.map((i) => [i.storyId, i]));

  for (const entry of arr(obj(raw)?.stories)) {
    const s = obj(entry);
    const input = s && byId.get(str(s.id) ?? "");
    const title = s && str(s.title_ko);
    if (!s || !input || !title) continue;

    const countries = new Set(input.articles.map((a) => a.country));
    const perspectives: Perspective[] = [];
    for (const p of arr(s.perspectives)) {
      const po = obj(p);
      const country = po && str(po.country);
      const angle = po && str(po.angle_ko);
      if (!po || !country || !angle || !countries.has(country)) continue;
      const articleIds = arr(po.refs)
        .map((r) => (typeof r === "string" ? /^r(\d+)$/.exec(r.trim()) : null))
        .map((m) => (m ? input.articles[Number(m[1]) - 1]?.id : undefined))
        .filter((id): id is string => !!id);
      if (articleIds.length === 0) continue;
      perspectives.push({ country, angle, articleIds: [...new Set(articleIds)] });
      if (perspectives.length >= MAX_PERSPECTIVES) break;
    }

    const entities: EntityRef[] = [];
    const seen = new Set<string>();
    for (const e of arr(s.entities)) {
      const eo = obj(e);
      const name = eo && str(eo.name);
      const type = eo && (str(eo.type) as EntityType | undefined);
      if (!eo || !name || !type || !ENTITY_TYPES.includes(type)) continue;
      const id = entityId(type, name);
      if (seen.has(id)) continue;
      seen.add(id);
      const nameKo = str(eo.name_ko);
      entities.push({ id, name, ...(nameKo ? { nameKo } : {}), type });
      if (entities.length >= MAX_ENTITIES) break;
    }

    const why = str(s.why_ko);
    out.set(input.storyId, {
      title,
      summary: arr(s.summary_ko)
        .map(str)
        .filter((l): l is string => !!l)
        .slice(0, MAX_SUMMARY_LINES),
      ...(why ? { why } : {}),
      perspectives,
      entities,
    });
  }
  return out;
}
