import type { Category, Continent, CountryCode } from "./catalog";
import type { ActorKind, ActorRole, EventType, FlowId } from "@/ontology/world";

/**
 * 세계 상황판: 파이프라인(GitHub Actions → Supabase)이 만들고 화면(/api/world)이 읽는 타입.
 * intent/2026-10-23-ontology-lab.md, docs/ONTOLOGY.md
 */

/** 수집한 기사. country는 매체 본사 나라 */
export interface PipelineArticle {
  /** 정규화 링크의 sha1 앞 16자 */
  id: string;
  link: string;
  title: string;
  summary?: string;
  source: string;
  feedId: string;
  country: CountryCode;
  continent: string;
  category: Category;
  /** ISO */
  publishedAt: string;
}

export interface BoardArticle {
  id: string;
  title: string;
  link: string;
  source: string;
  country: CountryCode;
  publishedAt: string;
}

export interface BoardActor {
  /** "country:US" 또는 "actor:person:elon musk" */
  id: string;
  name: string;
  nameKo: string;
  kind: ActorKind;
  role: ActorRole;
}

/** "왜 이 순위?": 점수의 모든 재료. 같은 입력이면 항상 같은 점수 */
export interface ScoreBreakdown {
  countries: number;
  continents: number;
  outlets: number;
  /** 보도 규모 */
  scale: number;
  multiplier: number;
  risingBonus: number;
  total: number;
}

export interface RelatedEvent {
  id: string;
  title: string;
  /** 사람이 읽는 이유 ("우크라이나 전쟁", "미국, 중국") */
  why: string;
  strength: number;
  crossContinent: boolean;
}

/** 규칙의 입력: 사건 객체 + 관계 + 그 사건의 최근 기사 */
export interface EventFact {
  id: string;
  type: EventType;
  title: string;
  summary: string;
  flow: FlowId | null;
  actors: BoardActor[];
  /** 일어난 나라 */
  occurs: CountryCode[];
  firstSeenAt: string;
  articles: BoardArticle[];
}

export interface BoardEvent extends Omit<EventFact, "articles"> {
  /** 보도한 나라 */
  reporting: CountryCode[];
  /** 보도한 대륙 */
  continents: Continent[];
  outlets: number;
  articleCount: number;
  lastSeenAt: string;
  rising: boolean;
  scope: "world" | "country";
  score: ScoreBreakdown;
  related: RelatedEvent[];
  /** 근거 기사 (최신순, 일부) */
  articles: BoardArticle[];
}

export type FlowTrend = "up" | "flat" | "down" | "quiet";

export interface BoardFlow {
  id: FlowId;
  label: string;
  /** 점수순 */
  eventIds: string[];
  trend: FlowTrend;
  recentArticles: number;
  previousArticles: number;
}

export interface BoardCountry {
  code: CountryCode;
  name: string;
  /** 앞쪽일수록 먼저 보여 줄 사건 */
  eventIds: string[];
}

export interface BoardContinent {
  id: Continent;
  label: string;
  top: string[];
  countries: BoardCountry[];
}

export interface OntologyStats {
  objects: Record<string, number>;
  links: Record<string, number>;
  /** 관계를 누가 만들었나: ai | rule | config */
  madeBy: Record<string, number>;
}

export interface BoardStats {
  articles: number;
  clusters: number;
  feedsOk: number;
  feedsFailed: number;
  extracted: number;
  ontology?: OntologyStats;
}

/** 어제 상황판과의 차이 (규칙으로 계산) */
export interface BoardChanges {
  /** 비교한 상황판의 시각 */
  comparedTo: string;
  /** 세계 5·IT 5에 새로 오른 사건 */
  appeared: string[];
  /** 보도한 나라가 늘어난 사건 */
  grew: { id: string; countriesBefore: number }[];
  /** 세계 5·IT 5에서 내려간 사건. 지금 목록에 없을 수 있어 제목을 함께 둔다 */
  faded: { id: string; title: string }[];
}

export interface WorldBoard {
  generatedAt: string;
  stats: BoardStats;
  flows: BoardFlow[];
  world: string[];
  it: string[];
  continents: BoardContinent[];
  events: BoardEvent[];
  /** 비교할 어제 기록이 없으면 없다 */
  changes?: BoardChanges;
}

export interface ActorProfile {
  id: string;
  name: string;
  nameKo: string;
  kind: ActorKind;
  events: { id: string; title: string; summary: string; type: EventType; role: ActorRole; lastSeenAt: string }[];
  /** 같은 사건에 함께 나온 행위자 (많은 순) */
  together: { id: string; nameKo: string; kind: ActorKind; count: number }[];
}
