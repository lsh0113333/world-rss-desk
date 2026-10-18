import type { Article } from "./article";
import type { Category, CountryCode } from "./catalog";

/** 분석 입력: 화면에 올라온 기사 + 어느 패널·나라·분야에서 왔는지 */
export interface StoryItem {
  article: Article;
  panelId: string;
  country?: CountryCode;
  category?: Category;
}

/** 같은 소식 묶음. items[0]이 대표 기사 */
export interface StoryCluster {
  id: string;
  items: StoryItem[];
  /** 서로 다른 매체명 */
  sources: string[];
  countries: CountryCode[];
}

/** 오늘의 이슈: 여러 나라·매체가 함께 다루는 키워드 묶음 */
export interface Issue {
  id: string;
  /** 표시용 ("Hormuz · Iran") */
  label: string;
  terms: string[];
  /** 최신순 */
  items: StoryItem[];
  countries: CountryCode[];
  sources: string[];
  /** 최근 1시간 안에 나온 기사 수 */
  recent: number;
}

export interface Insights {
  clusters: StoryCluster[];
  issues: Issue[];
}

/**
 * 분석 엔진. 1차는 브라우저 안의 규칙 기반(`ruleEngine`).
 * 2차(AI)는 같은 Insights를 돌려주는 `/api/insights`로 바꿔 끼운다 (화면 코드는 그대로).
 */
export type InsightEngine = (items: StoryItem[], now: Date) => Insights;
