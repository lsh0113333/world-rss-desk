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
  actors: { id: string; nameKo: string; kind: ActorKind; role: ActorRole }[];
}

type Actor = RelationEventInput["actors"][number];

/** 사건 하나에서 나오는 쌍: 주체가 있으면 주체와 나머지, 없으면 모두끼리 */
function pairsOf(actors: Actor[]): [Actor, Actor][] {
  const unique = [...new Map(actors.map((a) => [a.id, a])).values()];
  const subjects = new Set(actors.filter((a) => a.role === "subject").map((a) => a.id));
  const out: [Actor, Actor][] = [];
  for (let i = 0; i < unique.length; i++) {
    for (let j = i + 1; j < unique.length; j++) {
      if (subjects.size === 0 || subjects.has(unique[i].id) || subjects.has(unique[j].id)) out.push([unique[i], unique[j]]);
    }
  }
  return out;
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
    for (const pair of pairsOf(event.actors)) {
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
  const targets = top(byTarget);
  return { reporters, targets, counts: reporters.map((r) => targets.map((t) => counts.get(`${r}|${t}`) ?? 0)) };
}
