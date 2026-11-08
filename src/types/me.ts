import type { SituationId } from "@/ontology/me";
import type { CountryCode } from "./catalog";

/** "나" 객체 (3단계). 브라우저에만 저장한다 */
export interface Trip {
  country: CountryCode;
  /** 돌아오는 날 YYYY-MM-DD. 지나면 일정에서 빠진다. 없으면 계속 */
  until?: string;
}

export interface Me {
  situations: SituationId[];
  trips: Trip[];
}

/** 나에게 한 문장: 어떤 사건이 어떤 규칙에 걸렸나 */
export interface Advice {
  eventId: string;
  ruleId: string;
  situation: SituationId;
  sentence: string;
  /** 왜 이 문장인지 (사람이 읽는 규칙 설명) */
  why: string;
}
