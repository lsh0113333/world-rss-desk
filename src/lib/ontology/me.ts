import { isKnownCountry, countryName } from "@/ontology/countries";
import { ADVICE_RULES, ME_RULES, SITUATION_IDS, SITUATIONS, type AdviceRule, type SituationId } from "@/ontology/me";
import { EVENT_TYPES, FLOWS } from "@/ontology/world";
import type { Advice, Me, Trip } from "@/types/me";
import type { BoardEvent } from "@/types/world";

/**
 * 3단계: "나" 객체 × 상황판 사건 → 나에게 한 문장 (intent/2026-11-08-me-one-sentence.md).
 * 순수 규칙. 기준과 문장 틀은 src/ontology/me.ts에 있다.
 */

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** 저장된 값을 믿지 않고 다시 확인한다. 상황이 하나도 없으면 null */
export function parseMe(raw: unknown): Me | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const situations = [...new Set(Array.isArray(r.situations) ? r.situations : [])].filter((s): s is SituationId => SITUATION_IDS.includes(s as SituationId));
  if (situations.length === 0) return null;
  const trips: Trip[] = (Array.isArray(r.trips) ? r.trips : [])
    .flatMap((t: unknown) => {
      if (!t || typeof t !== "object") return [];
      const { country, until } = t as Record<string, unknown>;
      if (typeof country !== "string" || !isKnownCountry(country)) return [];
      return [typeof until === "string" && DATE.test(until) ? { country, until } : { country }];
    })
    .slice(0, ME_RULES.maxTrips);
  return { situations, trips };
}

/** 돌아오는 날이 지나지 않은 일정. today는 YYYY-MM-DD (보는 사람의 날짜) */
export function activeTrips(trips: readonly Trip[], today: string): Trip[] {
  return trips.filter((t) => !t.until || t.until >= today);
}

function matches(rule: AdviceRule, event: BoardEvent): boolean {
  return !!(rule.when.types?.includes(event.type) || (event.flow && rule.when.flows?.includes(event.flow)));
}

const flowLabel = (id: string | null) => FLOWS.find((f) => f.id === id)?.label;

/** 상황판 사건마다 처음 맞는 규칙 하나 → 한 문장. 안전(우선순위 큰 상황) 먼저, 그다음 점수순 */
export function adviseMe(me: Me, events: readonly BoardEvent[], today: string): Advice[] {
  const trips = activeTrips(me.trips, today);
  const out: { advice: Advice; priority: number; score: number }[] = [];
  for (const event of events) {
    for (const rule of ADVICE_RULES) {
      if (!me.situations.includes(rule.situation) || !matches(rule, event)) continue;
      const reported = `${event.reporting.length}개 나라 보도`;
      const typeLabel = EVENT_TYPES[event.type]?.label ?? event.type;
      let sentence: string;
      let why: string;
      if (rule.situation === "travel") {
        const trip = trips.find((t) => event.occurs.includes(t.country));
        if (!trip) continue;
        const place = countryName(trip.country);
        sentence = `가시는 ${place}에서 ${event.title} 소식이 있어요(${reported}). ${rule.advice}.`;
        why = `${SITUATIONS.travel.label}(${place}) × ${typeLabel} → 규칙 ${rule.id}`;
      } else {
        const topic = (rule.when.flows && flowLabel(event.flow)) || typeLabel;
        sentence = `${topic}: ${event.title} 소식이 있어요(${reported}). ${rule.advice}.`;
        why = `${SITUATIONS[rule.situation].label} × ${topic} → 규칙 ${rule.id}`;
      }
      out.push({ advice: { eventId: event.id, ruleId: rule.id, situation: rule.situation, sentence, why }, priority: SITUATIONS[rule.situation].priority, score: event.score.total });
      break;
    }
  }
  return out.sort((a, b) => b.priority - a.priority || b.score - a.score).map((o) => o.advice);
}
