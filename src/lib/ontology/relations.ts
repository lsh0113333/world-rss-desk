import { EVENT_TYPES, RULES, type ActorKind, type ActorRole, type EventType } from "@/ontology/world";
import type { BoardEvent, InterestMatrix, RelationPair } from "@/types/world";

/**
 * 2단계 관계 (intent/2026-11-08-relations.md). 순수 규칙: AI는 쓰지 않고 이미 뽑은 관계만 센다.
 * - 관계 온도: 함께 나온 두 행위자의 갈등·협력 사건 수 → -1(갈등) ~ 1(협력)
 * - 나라끼리 관심: 어느 나라 매체가 어느 나라에서 일어난 일을 보도했나
 */

export interface RelationEventInput {
  id: string;
  title: string;
  type: EventType;
  lastSeenAt: string;
  /** country: 소속 나라 (사람·기관·집단, 알 때만) */
  actors: { id: string; nameKo: string; kind: ActorKind; role: ActorRole; country?: string }[];
}

type Actor = RelationEventInput["actors"][number];

/** 사람·기관과 그 소속 나라는 같은 편 (소속 관계 affiliated_with) */
const sameSide = (a: Actor, b: Actor) => (!!a.country && b.id === `country:${a.country}`) || (!!b.country && a.id === `country:${b.country}`);

/**
 * 사건 하나에서 나오는 쌍: "누가 누구에게". 주체가 있으면 주체 × (대상·참여자),
 * 없으면 참여자끼리. 주체끼리(같은 편, 예: 트럼프와 미국)는 쌍으로 보지 않는다.
 */
function pairsOf(actors: Actor[]): [Actor, Actor][] {
  const subjectIds = new Set(actors.filter((a) => a.role === "subject").map((a) => a.id));
  const unique = [...new Map(actors.map((a) => [a.id, a])).values()];
  const subjects = unique.filter((a) => subjectIds.has(a.id));
  const others = unique.filter((a) => !subjectIds.has(a.id));
  if (subjects.length > 0) return subjects.flatMap((s) => others.map((o): [Actor, Actor] => [s, o]));
  return others.flatMap((a, i) => others.slice(i + 1).map((b): [Actor, Actor] => [a, b]));
}

export function relationPairs(events: readonly RelationEventInput[], rules = RULES): RelationPair[] {
  const acc = new Map<string, RelationPair & { weight: { conflict: number; cooperation: number } }>();
  for (const event of events) {
    const axis = EVENT_TYPES[event.type]?.axis;
    if (!axis) continue;
    const unique = new Set(event.actors.map((a) => a.id));
    if (unique.size > rules.relationMaxActors) continue;
    const side = axis.startsWith("conflict") ? "conflict" : "cooperation";
    const weight = axis.endsWith("action") ? rules.relationActionWeight : rules.relationWordWeight;
    for (const pair of pairsOf(event.actors).filter(([a, b]) => !sameSide(a, b))) {
      const [a, b] = pair.sort((x, y) => x.id.localeCompare(y.id));
      const key = `${a.id}|${b.id}`;
      const entry = acc.get(key) ?? {
        a: { id: a.id, nameKo: a.nameKo, kind: a.kind },
        b: { id: b.id, nameKo: b.nameKo, kind: b.kind },
        conflict: 0,
        cooperation: 0,
        temperature: 0,
        events: [],
        weight: { conflict: 0, cooperation: 0 },
      };
      entry[side]++;
      entry.weight[side] += weight;
      entry.events.push({ id: event.id, title: event.title, type: event.type, lastSeenAt: event.lastSeenAt });
      acc.set(key, entry);
    }
  }
  const total = (p: { weight: { conflict: number; cooperation: number } }) => p.weight.conflict + p.weight.cooperation;
  return [...acc.entries()]
    .filter(([, p]) => p.events.length >= rules.relationMinEvents)
    .sort(([ka, a], [kb, b]) => total(b) - total(a) || b.events.length - a.events.length || ka.localeCompare(kb))
    .slice(0, rules.relationLimit)
    .map(([, { weight, ...p }]) => ({
      ...p,
      temperature: (weight.cooperation - weight.conflict) / (weight.cooperation + weight.conflict),
      events: [...p.events].sort((x, y) => y.lastSeenAt.localeCompare(x.lastSeenAt)).slice(0, rules.relationEvidenceLimit),
    }));
}

/** 보도 나라 × 일어난 나라. 사건 하나는 (보도 나라, 일어난 나라) 쌍마다 한 번 센다 */
export function interestMatrix(events: readonly Pick<BoardEvent, "reporting" | "occurs">[], rules = RULES): InterestMatrix {
  const counts = new Map<string, number>();
  const byReporter = new Map<string, number>();
  const byTarget = new Map<string, number>();
  const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
  for (const e of events) {
    for (const r of new Set(e.reporting)) {
      for (const t of new Set(e.occurs)) {
        if (r === t) continue;
        bump(counts, `${r}|${t}`);
        bump(byReporter, r);
        bump(byTarget, t);
      }
    }
  }
  const top = (m: Map<string, number>) =>
    [...m.entries()]
      .sort(([ka, a], [kb, b]) => b - a || ka.localeCompare(kb))
      .slice(0, rules.interestCountries)
      .map(([k]) => k);
  const reporters = top(byReporter);
  // 보는 사람의 나라 줄은 상위에 없어도 넣는다 (마지막 자리와 바꾼다)
  for (const code of rules.interestAlwaysReporters) {
    if (!reporters.includes(code)) reporters.splice(Math.max(0, Math.min(reporters.length, rules.interestCountries - 1)), 1, code);
  }
  const targets = top(byTarget);
  return { reporters, targets, counts: reporters.map((r) => targets.map((t) => counts.get(`${r}|${t}`) ?? 0)) };
}
