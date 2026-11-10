/**
 * 온톨로지 v1: 세계 뉴스 분야의 정의 (docs/ONTOLOGY.md). 코드가 아니라 데이터로 둔다.
 * 다른 분야(공공 지원 등)는 이 파일과 같은 모양의 설정을 하나 더 만들어 꽂는다.
 * 사람의 판단 기준("무엇이 더 중요한가")은 전부 여기에 있다. 순위를 바꾸려면 이 파일만 고치면 된다.
 */

export const OBJECT_TYPES = {
  continent: { label: "대륙", madeBy: "config" },
  country: { label: "나라", madeBy: "config" },
  outlet: { label: "매체", madeBy: "config" },
  flow: { label: "큰 흐름", madeBy: "config" },
  event: { label: "사건", madeBy: "ai" },
  actor: { label: "행위자", madeBy: "ai" },
} as const;
export type ObjectType = keyof typeof OBJECT_TYPES;

/** 기사는 양이 많아 articles 테이블에 따로 둔다. 관계에서는 "article"로 가리킨다 */
export type NodeType = ObjectType | "article";

export const LINK_TYPES = {
  belongs_to: { label: "속함", from: ["country"], to: ["continent"] },
  based_in: { label: "본사", from: ["outlet"], to: ["country"] },
  reports: { label: "보도", from: ["article"], to: ["event"] },
  subject: { label: "주체", from: ["event"], to: ["actor", "country"] },
  target: { label: "대상", from: ["event"], to: ["actor", "country"] },
  participant: { label: "참여", from: ["event"], to: ["actor", "country"] },
  occurs_in: { label: "일어난 곳", from: ["event"], to: ["country"] },
  part_of: { label: "일부", from: ["event"], to: ["flow"] },
} as const satisfies Record<string, { label: string; from: readonly NodeType[]; to: readonly NodeType[] }>;
export type LinkType = keyof typeof LINK_TYPES;

export const ACTOR_ROLES = ["subject", "target", "participant"] as const;
export type ActorRole = (typeof ACTOR_ROLES)[number];

export const ACTOR_KINDS = {
  person: "사람",
  org: "기관",
  country: "나라",
  group: "집단",
} as const;
export type ActorKind = keyof typeof ACTOR_KINDS;

export const EVENT_TYPES = {
  tech: { label: "기업·기술", hint: "기업 실적·인수, 소프트웨어·AI·반도체 등 IT, 해킹, 산업 정책. 무기 시험·군사 행동은 해당하지 않는다", multiplier: 2, worldEligible: true, axis: null },
  "armed-conflict": { label: "무력 충돌", hint: "전투, 공습, 테러, 미사일·무기 시험", multiplier: 1.75, worldEligible: true, axis: "conflict-action" },
  disaster: { label: "재난·사고", hint: "지진, 태풍, 대형 사고, 감염병", multiplier: 1.75, worldEligible: true, axis: null },
  sanction: { label: "제재·압박", hint: "제재, 관세, 수출 통제", multiplier: 1.5, worldEligible: true, axis: "conflict-action" },
  diplomacy: { label: "외교·협상", hint: "정상회담, 협상, 합의, 조약", multiplier: 1.5, worldEligible: true, axis: "cooperation-word" },
  politics: { label: "선거·정권", hint: "선거, 정권 교체, 탄핵, 주요 입법", multiplier: 1.5, worldEligible: true, axis: null },
  economy: { label: "경제·시장", hint: "금리, 물가, 환율, 증시, 경제 지표", multiplier: 1.5, worldEligible: true, axis: null },
  "verbal-conflict": { label: "비난·경고", hint: "규탄, 위협, 경고", multiplier: 1.25, worldEligible: true, axis: "conflict-word" },
  cooperation: { label: "원조·협력", hint: "지원, 공동 사업", multiplier: 1.25, worldEligible: true, axis: "cooperation-action" },
  protest: { label: "시위·소요", hint: "시위, 파업, 폭동", multiplier: 1.25, worldEligible: true, axis: "conflict-action" },
  crime: { label: "범죄·사법", hint: "수사, 재판, 판결", multiplier: 1, worldEligible: true, axis: null },
  society: { label: "사회·문화", hint: "사회 이슈, 교육, 문화", multiplier: 0.75, worldEligible: true, axis: null },
  // 사용자 결정(2026-11-01): 스포츠·연예는 세계 5에서 뺀다. 그래서 사회·문화에서 나누었다
  sports: { label: "스포츠·연예", hint: "경기, 선수, 연예인", multiplier: 0.5, worldEligible: false, axis: null },
} as const;
export type EventType = keyof typeof EVENT_TYPES;
export const EVENT_TYPE_IDS = Object.keys(EVENT_TYPES) as EventType[];

/** 지켜보는 큰 흐름. 앞쪽이 IT (사용자 결정: IT 최우선) */
export const FLOWS = [
  { id: "ai-race", label: "AI 경쟁", hint: "빅테크, AI 모델, AI 규제" },
  { id: "chips", label: "반도체", hint: "반도체 공급망, 수출 통제" },
  { id: "cyber", label: "사이버 보안", hint: "해킹, 개인정보 유출, 사이버 공격" },
  { id: "bigtech", label: "빅테크 규제", hint: "EU 디지털 규제, 반독점, 플랫폼 규제" },
  { id: "ukraine", label: "우크라이나 전쟁", hint: "러시아·우크라이나 전쟁과 휴전" },
  { id: "mideast", label: "가자·중동 분쟁", hint: "이스라엘, 가자, 이란, 홍해" },
  { id: "us-china", label: "미·중 갈등", hint: "무역, 관세, 대만, 기술 패권" },
  { id: "korea", label: "한반도", hint: "남북 관계, 북한, 주한미군" },
] as const;
export type FlowId = (typeof FLOWS)[number]["id"];
export const FLOW_IDS: readonly string[] = FLOWS.map((f) => f.id);

/** 판단 규칙의 숫자 (docs/ONTOLOGY.md 4절) */
export const RULES = {
  /** 보도 규모 = 나라 수 × countryWeight + 대륙 수 × continentWeight + min(매체 수, outletCap) */
  countryWeight: 3,
  continentWeight: 2,
  outletCap: 10,
  /** 최근 3시간 기사가 그 전 3시간의 2배 이상(2건 이상)이면 더하는 점수 */
  risingBonus: 5,
  risingWindowHours: 3,
  /** 세계 사건: 이만큼 많은 나라의 매체가 보도 */
  worldMinCountries: 2,
  /** 사건 자격: 이만큼 많은 매체가 보도 */
  minOutlets: 2,
  worldLimit: 5,
  itLimit: 5,
  continentLimit: 3,
  /** 나라별로 고르는 사건 수 */
  countryLimit: 3,
  relatedLimit: 2,
  /** 제목 단어가 이 비율 이상 겹치면 같은 사건으로 합친다 */
  mergeTitleOverlap: 0.7,
  /** 하루 사건 중 이 비율 이상에 나오는 행위자는 "흔한 행위자" (하나만 겹치면 연관 아님) */
  commonActorShare: 0.2,
  /** 흐름 추세: 최근 6시간 ÷ 그 전 6시간 */
  trendWindowHours: 6,
  trendUp: 1.3,
  trendDown: 0.7,
  /** 이 시간 넘게 새 기사가 없으면 잦아든 사건으로 보고 화면에서 내린다 */
  fadeHours: 12,
  /** 내 기준에서 정할 수 있는 유형 배수의 최댓값 */
  multiplierMax: 3,
  /** 어제와 비교: 이만큼 전 상황판과 비교한다 */
  changeHours: 24,
  /** 보도한 나라가 이만큼 늘면 "커진 일" */
  changeGrowCountries: 3,
  /** "새로 오른 일", "커진 일", "내려간 일" 칸마다 보여 줄 수 */
  changeLimit: 3,
  /** 관계 온도: 이 기간(일)의 사건을 센다 */
  relationDays: 7,
  /** 관계 온도: 이만큼 많은 사건에 함께 나와야 보여 준다 */
  relationMinEvents: 2,
  /** 행위자가 이보다 많은 사건은 누가 누구와인지 흐려서 세지 않는다 */
  relationMaxActors: 6,
  /** 행동(전투·제재·원조)은 말(비난·협상)보다 무겁게 센다 */
  relationActionWeight: 2,
  relationWordWeight: 1,
  relationLimit: 10,
  relationEvidenceLimit: 5,
  /** 온도가 이보다 낮으면 "갈등", 높으면(부호 반대) "협력", 그 사이는 "엇갈림" */
  relationLean: 0.33,
  /** 나라끼리 관심 표의 나라 수 (보도 나라, 일어난 나라 각각) */
  interestCountries: 8,
  /** 상위에 없어도 관심 표에 항상 넣는 보도 나라 (보는 사람의 나라) */
  interestAlwaysReporters: ["KR"],
} as const;
export type Rules = typeof RULES;
