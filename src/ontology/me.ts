import type { EventType, FlowId } from "./world";

/**
 * 3단계 "나" 객체의 정의 (intent/2026-11-08-me-one-sentence.md, docs/ONTOLOGY.md).
 * 내 상황 × 사건 → 나에게 한 문장. 판단 기준과 문장 틀은 전부 여기에 둔다. AI는 쓰지 않는다.
 */

/** 내 상황. priority가 큰 상황의 권고를 먼저 보여 준다 (안전 > 업무) */
export const SITUATIONS = {
  travel: { label: "해외 일정", hint: "여행·출장 가는 나라", priority: 2 },
  "it-work": { label: "IT 업무", hint: "EAI/MOM 같은 시스템 연계 업무", priority: 1 },
} as const;
export type SituationId = keyof typeof SITUATIONS;
export const SITUATION_IDS = Object.keys(SITUATIONS) as SituationId[];

export interface AdviceRule {
  id: string;
  situation: SituationId;
  /** 사건 유형이나 큰 흐름 중 하나라도 맞으면 걸린다. 해외 일정은 일어난 나라가 일정 나라여야 한다 */
  when: { types?: readonly EventType[]; flows?: readonly FlowId[] };
  /** 권할 일. "~해 보세요" 수준으로 쓴다 (틀렸을 때의 해악을 줄인다) */
  advice: string;
}

/**
 * 사건 하나에는 위에서부터 처음 맞는 규칙 하나만 쓴다.
 * "기업·기술 전체" 같은 넓은 규칙은 두지 않는다 (2026-11-08 실제 데이터: 드라마 제작 소식에 업무 권고가 붙었다)
 */
export const ADVICE_RULES: readonly AdviceRule[] = [
  { id: "travel-conflict", situation: "travel", when: { types: ["armed-conflict"] }, advice: "외교부 해외안전여행 경보를 확인하고 일정을 다시 보세요" },
  { id: "travel-disaster", situation: "travel", when: { types: ["disaster"] }, advice: "현지 교통과 숙소가 정상 운영되는지 확인해 보세요" },
  { id: "travel-protest", situation: "travel", when: { types: ["protest"] }, advice: "시위 지역을 피해 동선을 짜 보세요" },
  { id: "travel-sanction", situation: "travel", when: { types: ["sanction"] }, advice: "결제·송금·입국 절차에 바뀐 것이 있는지 확인해 보세요" },
  { id: "it-cyber", situation: "it-work", when: { flows: ["cyber"] }, advice: "연계 시스템의 접속 기록과 인증서를 점검해 보세요" },
  { id: "it-bigtech", situation: "it-work", when: { flows: ["bigtech"] }, advice: "쓰는 클라우드·플랫폼의 정책이나 약관이 바뀌는지 확인해 보세요" },
  { id: "it-chips", situation: "it-work", when: { flows: ["chips"] }, advice: "반도체 쪽 고객사·장비 일정에 영향이 있는지 확인해 보세요" },
  { id: "it-ai", situation: "it-work", when: { flows: ["ai-race"] }, advice: "업무에 쓰는 AI 도구·API의 정책이나 가격이 바뀌는지 확인해 보세요" },
];

export const ME_RULES = {
  /** 이만큼 많은 나라가 보도한 일만 나에게 걸린다 (한 나라만 보도한 작은 사고에 권고하지 않게) */
  minCountries: 2,
  /** 한 문장 아래에 함께 보여 줄 "더 확인할 것" 수 */
  moreLimit: 2,
  /** 해외 일정 나라 수 */
  maxTrips: 5,
} as const;
