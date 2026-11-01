import { isKnownCountry } from "@/ontology/countries";
import {
  ACTOR_KINDS,
  ACTOR_ROLES,
  EVENT_TYPE_IDS,
  EVENT_TYPES,
  FLOW_IDS,
  FLOWS,
  type ActorKind,
  type ActorRole,
  type EventType,
  type FlowId,
} from "@/ontology/world";
import type { BoardActor } from "@/types/world";

/**
 * AI 추출(읽기)의 순수 부분: 프롬프트, 스키마, 응답 검증 (docs/ONTOLOGY.md 5절).
 * AI는 정해진 목록 안에서 사실만 옮긴다. 목록 밖 값이나 입력에 없는 근거는 버린다.
 */

const MAX_ACTORS = 4;
const MAX_TITLE = 80;
const MAX_SUMMARY = 200;
/** 한 묶음을 나눌 때 사건 하나에 필요한 근거 수 */
const MIN_EVIDENCE = 2;

export interface ExtractInput {
  cluster: string;
  articles: { id: string; title: string; source: string; country: string; summary?: string }[];
}

export interface ExtractedEvent {
  type: EventType;
  title: string;
  summary: string;
  flow: FlowId | null;
  actors: BoardActor[];
  places: string[];
  evidence: string[];
}

const ACTOR_KIND_IDS = Object.keys(ACTOR_KINDS) as ActorKind[];

export const EXTRACT_SCHEMA = {
  type: "OBJECT",
  properties: {
    events: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          cluster: { type: "STRING" },
          type: { type: "STRING", enum: EVENT_TYPE_IDS },
          title: { type: "STRING" },
          summary: { type: "STRING" },
          flow: { type: "STRING" },
          actors: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                name: { type: "STRING" },
                nameKo: { type: "STRING" },
                kind: { type: "STRING", enum: ACTOR_KIND_IDS },
                role: { type: "STRING", enum: [...ACTOR_ROLES] },
                code: { type: "STRING" },
              },
              required: ["name", "nameKo", "kind", "role", "code"],
            },
          },
          places: { type: "ARRAY", items: { type: "STRING" } },
          evidence: { type: "ARRAY", items: { type: "STRING" } },
        },
        required: ["cluster", "type", "title", "summary", "flow", "actors", "places", "evidence"],
      },
    },
  },
  required: ["events"],
};

export function buildExtractPrompt(inputs: ExtractInput[]): string {
  const types = EVENT_TYPE_IDS.map((id) => `- ${id}: ${EVENT_TYPES[id].label} (${EVENT_TYPES[id].hint})`).join("\n");
  const flows = FLOWS.map((f) => `- ${f.id}: ${f.label} (${f.hint})`).join("\n");
  const clusters = inputs
    .map((input) => {
      const lines = input.articles.map((a) => `- (${a.id}) [${a.country}, ${a.source}] ${a.title}${a.summary ? ` — ${a.summary.slice(0, 160)}` : ""}`);
      return `[묶음 ${input.cluster}]\n${lines.join("\n")}`;
    })
    .join("\n\n");
  return `너는 뉴스 헤드라인에서 사건 정보를 옮겨 적는 도구다. 중요도를 판단하거나 의견을 넣지 말고, 주어진 기사에 있는 사실만 정해진 형식으로 옮겨라.

묶음마다 다음을 만들어라.
- cluster: 묶음 이름 그대로
- type: 아래 사건 유형 id 중 하나
- title: 한국어 한 줄 제목 (30자 안팎, 사실만)
- summary: 한국어 한 문장 ("누가 누구에게 무엇을")
- flow: 아래 큰 흐름 id 중 하나. 해당 없으면 빈 문자열
- actors: 사건의 행위자 최대 ${MAX_ACTORS}개. name은 영어 이름, nameKo는 한국어 이름, kind는 ${ACTOR_KIND_IDS.join("/")}, role은 subject(주체)/target(대상)/participant(참여). kind가 country면 code에 ISO 2글자 나라 코드, 아니면 빈 문자열
- places: 사건이 실제로 일어난 나라의 ISO 2글자 코드. 보도한 나라가 아니다. 기업 발표는 그 기업 본사 나라
- evidence: 이 사건의 근거 기사 id (입력에 있는 것만)

한 묶음에 서로 다른 사건이 섞여 있으면 사건마다 항목을 따로 만들고 evidence에 그 사건의 기사만 넣어라. 기사가 ${MIN_EVIDENCE}건 미만인 사건은 버려라.

사건 유형:
${types}

큰 흐름:
${flows}

${clusters}`;
}

/** 나라는 코드로, 나머지는 정리한 영어 이름으로 합친다 ("U.N." = "UN") */
export function actorId(kind: ActorKind, name: string, code: string): string {
  if (kind === "country" && isKnownCountry(code)) return `country:${code}`;
  const clean = name
    .toLowerCase()
    .replace(/[.'’]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return `actor:${kind}:${clean}`;
}

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function parseActors(raw: unknown): BoardActor[] {
  if (!Array.isArray(raw)) return [];
  const actors = new Map<string, BoardActor>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const a = item as Record<string, unknown>;
    const name = text(a.name, 80);
    const kind = a.kind as ActorKind;
    const role = a.role as ActorRole;
    if (!name || !ACTOR_KIND_IDS.includes(kind) || !ACTOR_ROLES.includes(role)) continue;
    const id = actorId(kind, name, text(a.code, 4).toUpperCase());
    if (!actors.has(id)) actors.set(id, { id, name, nameKo: text(a.nameKo, 80) || name, kind, role });
    if (actors.size >= MAX_ACTORS) break;
  }
  return [...actors.values()];
}

export function parseExtraction(raw: unknown, inputs: ExtractInput[]): Map<string, ExtractedEvent[]> {
  const result = new Map<string, ExtractedEvent[]>();
  const items = (raw as { events?: unknown } | null)?.events;
  if (!Array.isArray(items)) return result;

  const drafts = new Map<string, (Omit<ExtractedEvent, "evidence"> & { evidence: string[] })[]>();
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const e = item as Record<string, unknown>;
    const cluster = text(e.cluster, 80).replace(/^\[?묶음\s*/, "").replace(/\]$/, "");
    const input = inputs.find((i) => i.cluster === cluster);
    const type = e.type as EventType;
    const title = text(e.title, MAX_TITLE);
    if (!input || !EVENT_TYPE_IDS.includes(type) || !title) continue;
    const known = new Set(input.articles.map((a) => a.id));
    const flow = FLOW_IDS.includes(e.flow as string) ? (e.flow as FlowId) : null;
    const places = Array.isArray(e.places) ? [...new Set(e.places.map((p) => String(p).toUpperCase()).filter(isKnownCountry))] : [];
    const evidence = Array.isArray(e.evidence) ? [...new Set(e.evidence.map(String).filter((id) => known.has(id)))] : [];
    const list = drafts.get(cluster) ?? [];
    list.push({ type, title, summary: text(e.summary, MAX_SUMMARY), flow, actors: parseActors(e.actors), places, evidence });
    drafts.set(cluster, list);
  }

  for (const [cluster, list] of drafts) {
    const input = inputs.find((i) => i.cluster === cluster)!;
    // 묶음이 사건 하나면 묶음 전체가 근거
    if (list.length === 1) {
      result.set(cluster, [{ ...list[0], evidence: input.articles.map((a) => a.id) }]);
      continue;
    }
    // 나눈 경우: 기사 하나는 사건 하나에만, 근거가 모자라면 버린다
    const taken = new Set<string>();
    const kept: ExtractedEvent[] = [];
    for (const draft of list) {
      const evidence = draft.evidence.filter((id) => !taken.has(id));
      if (evidence.length < MIN_EVIDENCE) continue;
      for (const id of evidence) taken.add(id);
      kept.push({ ...draft, evidence });
    }
    if (kept.length > 0) result.set(cluster, kept);
  }
  return result;
}
