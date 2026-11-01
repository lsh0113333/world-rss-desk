import { continentOfCountry, CONTINENTS, countryName } from "@/ontology/countries";
import { EVENT_TYPE_IDS, EVENT_TYPES, FLOWS, RULES, type EventType } from "@/ontology/world";
import type { Continent } from "@/types/catalog";
import type {
  BoardContinent,
  BoardEvent,
  BoardFlow,
  BoardStats,
  BoardChanges,
  EventFact,
  FlowTrend,
  RelatedEvent,
  ScoreBreakdown,
  WorldBoard,
} from "@/types/world";

/**
 * 판단 규칙 (ADR-017: 판단은 규칙, AI는 읽기와 말하기). 순수 함수: 같은 입력이면 항상 같은 결과.
 * 숫자와 기준은 src/ontology/world.ts, 설명은 docs/ONTOLOGY.md 4절.
 */

const HOUR = 3_600_000;
/** 화면에 보내는 사건당 근거 기사 수 */
const EVIDENCE_LIMIT = 8;
/** 화면에 보내는 사건 수 (규칙 실험에도 쓰인다) */
const BOARD_EVENT_LIMIT = 150;

export type Multipliers = Record<EventType, number>;

export function multipliersFromConfig(): Multipliers {
  return Object.fromEntries(EVENT_TYPE_IDS.map((id) => [id, EVENT_TYPES[id].multiplier])) as Multipliers;
}

export function scoreEvent(
  n: { countries: number; continents: number; outlets: number; rising: boolean },
  type: EventType,
  multipliers: Multipliers,
): ScoreBreakdown {
  const scale = RULES.countryWeight * n.countries + RULES.continentWeight * n.continents + Math.min(n.outlets, RULES.outletCap);
  const multiplier = multipliers[type];
  const risingBonus = n.rising ? RULES.risingBonus : 0;
  return {
    countries: n.countries,
    continents: n.continents,
    outlets: n.outlets,
    scale,
    multiplier,
    risingBonus,
    total: Math.round((scale * multiplier + risingBonus) * 100) / 100,
  };
}

/** 저장된 값이 모든 유형에 쓸 수 있는 배수이고 기본값과 다를 때만 돌려준다 */
export function parseMultipliers(raw: unknown): Multipliers | null {
  if (typeof raw !== "object" || raw === null) return null;
  const values = raw as Record<string, unknown>;
  const valid = EVENT_TYPE_IDS.every((id) => {
    const value = values[id];
    return typeof value === "number" && value >= 0 && value <= RULES.multiplierMax;
  });
  if (!valid) return null;
  const parsed = Object.fromEntries(EVENT_TYPE_IDS.map((id) => [id, values[id]])) as Multipliers;
  return EVENT_TYPE_IDS.some((id) => parsed[id] !== EVENT_TYPES[id].multiplier) ? parsed : null;
}

const byScore = (a: BoardEvent, b: BoardEvent) => b.score.total - a.score.total || a.id.localeCompare(b.id);
const time = (iso: string) => Date.parse(iso);

function isRising(fact: EventFact, now: Date): boolean {
  const window = RULES.risingWindowHours * HOUR;
  const ages = fact.articles.map((a) => now.getTime() - time(a.publishedAt));
  const recent = ages.filter((age) => age <= window).length;
  const previous = ages.filter((age) => age > window && age <= window * 2).length;
  return recent >= 2 && recent >= previous * 2;
}

function toBoardEvent(fact: EventFact, now: Date, multipliers: Multipliers): BoardEvent | null {
  if (fact.articles.length === 0) return null;
  const sorted = [...fact.articles].sort((a, b) => time(b.publishedAt) - time(a.publishedAt));
  const outlets = new Set(sorted.map((a) => a.source)).size;
  if (outlets < RULES.minOutlets) return null;
  if (now.getTime() - time(sorted[0].publishedAt) > RULES.fadeHours * HOUR) return null;

  const reporting = [...new Set(sorted.map((a) => a.country))];
  const continents = [...new Set(reporting.map(continentOfCountry).filter((c): c is Continent => !!c))];
  const rising = isRising(fact, now);
  return {
    ...fact,
    // 장소를 못 뽑았어도 한 나라 안 사건이면 그 나라다
    occurs: fact.occurs.length > 0 ? fact.occurs : reporting.length === 1 ? reporting : [],
    reporting,
    continents,
    outlets,
    articleCount: sorted.length,
    lastSeenAt: sorted[0].publishedAt,
    rising,
    scope: reporting.length >= RULES.worldMinCountries ? "world" : "country",
    score: scoreEvent({ countries: reporting.length, continents: continents.length, outlets, rising }, fact.type, multipliers),
    related: [],
    articles: sorted.slice(0, EVIDENCE_LIMIT),
  };
}

const titleWords = (title: string) => new Set(title.toLowerCase().split(/[^\p{L}\p{N}%]+/u).filter(Boolean));

function titleOverlap(a: Set<string>, b: Set<string>): number {
  const shared = [...a].filter((w) => b.has(w)).length;
  return shared / (a.size + b.size - shared || 1);
}

/** 규칙 묶기가 갈라 놓은 같은 사건을 제목으로 합친다. 기사가 많은 쪽이 대표 */
function mergeDuplicates(facts: EventFact[]): EventFact[] {
  const ordered = [...facts].sort((a, b) => b.articles.length - a.articles.length || a.id.localeCompare(b.id));
  const kept: { fact: EventFact; words: Set<string> }[] = [];
  for (const fact of ordered) {
    const words = titleWords(fact.title);
    const same = kept.find((k) => titleOverlap(k.words, words) >= RULES.mergeTitleOverlap);
    if (!same) {
      kept.push({ fact, words });
      continue;
    }
    const f = same.fact;
    same.fact = {
      ...f,
      articles: [...new Map([...f.articles, ...fact.articles].map((a) => [a.id, a])).values()],
      actors: [...f.actors, ...fact.actors.filter((a) => f.actors.every((x) => x.id !== a.id))],
      occurs: [...new Set([...f.occurs, ...fact.occurs])],
      flow: f.flow ?? fact.flow,
      firstSeenAt: f.firstSeenAt < fact.firstSeenAt ? f.firstSeenAt : fact.firstSeenAt,
    };
  }
  return kept.map((k) => k.fact);
}

/** 세계 5 후보를 점수순으로 (규칙 실험 화면에서 배수를 바꿔 다시 계산한다) */
export function rankWorld(events: BoardEvent[], multipliers: Multipliers): BoardEvent[] {
  return events
    .filter((e) => e.scope === "world" && EVENT_TYPES[e.type].worldEligible)
    .map((e) => rescore(e, multipliers))
    .sort(byScore);
}

function rescore(e: BoardEvent, multipliers: Multipliers): BoardEvent {
  return { ...e, score: scoreEvent({ countries: e.score.countries, continents: e.score.continents, outlets: e.score.outlets, rising: e.rising }, e.type, multipliers) };
}

/** 점수순 사건에서 세계 5와 IT 5를 고른다 */
function pickTop(events: BoardEvent[]): Pick<WorldBoard, "world" | "it"> {
  const world = events.filter((e) => e.scope === "world" && EVENT_TYPES[e.type].worldEligible).slice(0, RULES.worldLimit).map((e) => e.id);
  const worldSet = new Set(world);
  const it = events.filter((e) => e.type === "tech" && !worldSet.has(e.id)).slice(0, RULES.itLimit).map((e) => e.id);
  return { world, it };
}

/** 내 기준(유형 배수)으로 상황판 순위를 다시 계산한다. 원본은 바꾸지 않는다 */
export function applyMultipliers(board: WorldBoard, multipliers: Multipliers): WorldBoard {
  const events = board.events.map((e) => rescore(e, multipliers)).sort(byScore);
  const order = new Map(events.map((e, i) => [e.id, i]));
  const { world, it } = pickTop(events);
  return {
    ...board,
    events,
    world,
    it,
    flows: board.flows.map((f) => ({ ...f, eventIds: [...f.eventIds].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0)) })),
    continents: continentsOf(events, new Set([...world, ...it])),
  };
}

/** 어제 상황판에서 비교에 쓰는 부분 */
export interface PreviousBoard {
  world: string[];
  it: string[];
  events: { id: string; title: string; reporting: string[] }[];
}

/** 지금 상황판과 어제 상황판의 차이 */
export function diffBoards(current: Pick<WorldBoard, "world" | "it" | "events">, previous: PreviousBoard, comparedTo: string): BoardChanges {
  const top = [...current.world, ...current.it];
  const previousTop = [...previous.world, ...previous.it];
  const before = new Map(previous.events.map((e) => [e.id, e]));
  const appeared = top.filter((id) => !previousTop.includes(id));
  const grew = current.events
    .flatMap((e) => {
      const was = before.get(e.id);
      if (!was || appeared.includes(e.id) || !EVENT_TYPES[e.type].worldEligible) return [];
      const growth = e.reporting.length - was.reporting.length;
      return growth >= RULES.changeGrowCountries ? [{ id: e.id, countriesBefore: was.reporting.length, growth }] : [];
    })
    .sort((a, b) => b.growth - a.growth)
    .slice(0, RULES.changeLimit)
    .map(({ id, countriesBefore }) => ({ id, countriesBefore }));
  const faded = previousTop
    .filter((id) => !top.includes(id))
    .flatMap((id) => {
      const was = before.get(id);
      return was ? [{ id, title: was.title }] : [];
    })
    .slice(0, RULES.changeLimit);
  return { comparedTo, appeared: appeared.slice(0, RULES.changeLimit), grew, faded };
}

const homeContinent = (e: BoardEvent) => {
  const code = e.occurs[0] ?? e.reporting[0];
  return code ? continentOfCountry(code) : undefined;
};

function relatedOf(event: BoardEvent, events: BoardEvent[], isCommon: (id: string) => boolean): RelatedEvent[] {
  const relevant = (e: BoardEvent) => e.actors.filter((a) => a.kind === "country" || a.kind === "org");
  const mine = new Map(relevant(event).map((a) => [a.id, a.nameKo]));
  const flowLabel = FLOWS.find((f) => f.id === event.flow)?.label;
  const found: RelatedEvent[] = [];
  for (const other of events) {
    if (other.id === event.id) continue;
    const shared = [...new Set(relevant(other).map((a) => a.id))].filter((id) => mine.has(id));
    const meaningful = shared.length >= 2 || shared.some((id) => !isCommon(id));
    const sameFlow = !!event.flow && event.flow === other.flow;
    if (!meaningful && !sameFlow) continue;
    found.push({
      id: other.id,
      title: other.title,
      why: sameFlow ? flowLabel! : shared.map((id) => mine.get(id)).join(", "),
      strength: (meaningful ? shared.length : 0) + (sameFlow ? 2 : 0),
      crossContinent: homeContinent(other) !== homeContinent(event),
    });
  }
  return found
    .sort((a, b) => Number(b.crossContinent) - Number(a.crossContinent) || b.strength - a.strength || a.id.localeCompare(b.id))
    .slice(0, RULES.relatedLimit);
}

function flowsOf(events: BoardEvent[], facts: EventFact[], now: Date): BoardFlow[] {
  const window = RULES.trendWindowHours * HOUR;
  return FLOWS.map((flow) => {
    const inFlow = events.filter((e) => e.flow === flow.id).sort(byScore);
    const counted = new Set(inFlow.map((e) => e.id));
    const ages = facts.filter((f) => counted.has(f.id)).flatMap((f) => f.articles.map((a) => now.getTime() - time(a.publishedAt)));
    const recentArticles = ages.filter((age) => age <= window).length;
    const previousArticles = ages.filter((age) => age > window && age <= window * 2).length;
    let trend: FlowTrend = "flat";
    if (inFlow.length === 0) trend = "quiet";
    else if (previousArticles === 0 ? recentArticles > 0 : recentArticles / previousArticles >= RULES.trendUp) trend = "up";
    else if (previousArticles > 0 && recentArticles / previousArticles <= RULES.trendDown) trend = "down";
    return { id: flow.id, label: flow.label, eventIds: inFlow.map((e) => e.id), trend, recentArticles, previousArticles };
  });
}

function continentsOf(events: BoardEvent[], shown: Set<string>): BoardContinent[] {
  return CONTINENTS.map((c) => {
    const inContinent = events.filter((e) => e.occurs.some((code) => continentOfCountry(code) === c.id)).sort(byScore);
    const top = inContinent.filter((e) => !shown.has(e.id)).slice(0, RULES.continentLimit).map((e) => e.id);
    const topSet = new Set(top);
    const codes = [...new Set(inContinent.flatMap((e) => e.occurs.filter((code) => continentOfCountry(code) === c.id)))];
    const countries = codes.map((code) => {
      const here = inContinent.filter((e) => e.occurs.includes(code));
      return {
        code,
        name: countryName(code),
        // 대륙 상위에 이미 없는 사건을 앞으로 (같은 제목이 바로 아래 반복되지 않게)
        eventIds: [...here.filter((e) => !topSet.has(e.id)), ...here.filter((e) => topSet.has(e.id))].slice(0, RULES.countryLimit).map((e) => e.id),
      };
    });
    const rank = (ids: string[]) => Math.max(0, ...ids.map((id) => events.find((e) => e.id === id)?.score.total ?? 0));
    countries.sort((a, b) => rank(b.eventIds) - rank(a.eventIds) || a.code.localeCompare(b.code));
    return { id: c.id, label: c.label, top, countries };
  });
}

export function buildBoard(rawFacts: EventFact[], now: Date, stats: BoardStats, multipliers: Multipliers = multipliersFromConfig()): WorldBoard {
  const facts = mergeDuplicates(rawFacts);
  const events = facts
    .map((f) => toBoardEvent(f, now, multipliers))
    .filter((e): e is BoardEvent => e !== null)
    .sort(byScore)
    .slice(0, BOARD_EVENT_LIMIT);

  const actorCounts = new Map<string, number>();
  for (const e of events) for (const id of new Set(e.actors.map((a) => a.id))) actorCounts.set(id, (actorCounts.get(id) ?? 0) + 1);
  const commonAt = Math.max(3, events.length * RULES.commonActorShare);
  const isCommon = (id: string) => (actorCounts.get(id) ?? 0) >= commonAt;
  for (const e of events) e.related = relatedOf(e, events, isCommon);

  const { world, it } = pickTop(events);

  return {
    generatedAt: now.toISOString(),
    stats,
    flows: flowsOf(events, facts, now),
    world,
    it,
    continents: continentsOf(events, new Set([...world, ...it])),
    events,
  };
}

export interface Triple {
  from: string;
  relation: string;
  to: string | null;
}

/** 사건을 "누가 -무엇을→ 누구에게"로 (온톨로지 공부용 "관계로 보기") */
export function triplesOf(event: Pick<BoardEvent, "type" | "actors">): Triple[] {
  const relation = EVENT_TYPES[event.type].label;
  const subjects = event.actors.filter((a) => a.role === "subject");
  const targets = event.actors.filter((a) => a.role === "target");
  const triples: Triple[] = [];
  for (const s of subjects) {
    if (targets.length === 0) triples.push({ from: s.nameKo, relation, to: null });
    for (const t of targets) triples.push({ from: s.nameKo, relation, to: t.nameKo });
  }
  if (subjects.length === 0) for (const t of targets) triples.push({ from: t.nameKo, relation: `${relation}의 대상`, to: null });
  for (const p of event.actors.filter((a) => a.role === "participant")) triples.push({ from: p.nameKo, relation: "참여", to: null });
  return triples;
}
