import type { Category, CountryCode } from "./catalog";

/**
 * 세계 흐름 파이프라인(GitHub Actions → Supabase)과 화면(/api/insights)이 주고받는 타입.
 * intent/2026-10-18-sensemaking.md
 */

/** 파이프라인이 저장하는 기사 (카탈로그 피드에서 수집) */
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
  image?: string;
  /** ISO */
  publishedAt: string;
}

/** 나라별 시각: 같은 사건을 이 나라 매체들은 어떻게 다루는가 (근거 기사 id 포함) */
export interface Perspective {
  country: CountryCode;
  angle: string;
  articleIds: string[];
}

export type EntityType = "person" | "org" | "place" | "topic";

export interface EntityRef {
  id: string;
  name: string;
  nameKo?: string;
  type: EntityType;
}

/** AI 보강 결과 (한국어) */
export interface StoryInsight {
  title: string;
  summary: string[];
  why?: string;
  perspectives: Perspective[];
  model: string;
  generatedAt: string;
}

export interface WorldStoryArticle {
  id: string;
  title: string;
  link: string;
  source: string;
  country: CountryCode;
  image?: string;
  publishedAt: string;
}

/** 화면의 사건 카드 하나 */
export interface WorldStory {
  id: string;
  leadTitle: string;
  image?: string;
  terms: string[];
  countries: CountryCode[];
  sources: string[];
  size: number;
  firstSeenAt: string;
  lastSeenAt: string;
  /** 최근 시간대별 기사 수 (오래된 → 최신) */
  trend: number[];
  /** 최근 몇 시간 동안 빠르게 커지는 중 */
  rising: boolean;
  insight?: StoryInsight;
  entities: EntityRef[];
  articles: WorldStoryArticle[];
}

/** /api/insights 응답 */
export interface WorldInsights {
  /** 마지막 파이프라인 실행 시각 (없으면 아직 실행 전) */
  updatedAt: string | null;
  stories: WorldStory[];
  /** 최근 24시간 나라별 기사 수 (지도) */
  countries: Record<CountryCode, number>;
}
