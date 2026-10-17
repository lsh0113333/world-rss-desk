import type { Category, CountryCode } from "./catalog";

/** 패널 보기 방식: 카드(톱 기사 큰 사진) / 목록(작은 썸네일, 기본) / 텍스트 */
export type PanelView = "card" | "list" | "text";

export interface Panel {
  id: string;
  /** 없으면 panelTitle(country, category)로 자동 생성 */
  title?: string;
  country?: CountryCode;
  category?: Category;
  feedIds: string[];
  customUrls: string[];
  /** 5~30, 기본 10 */
  limit: number;
  /** ISO. 이 시각 이후 발행된 기사를 '새 기사'로 강조 */
  lastSeenAt?: string;
  /** 없으면 "list" */
  view?: PanelView;
  /** 그리드에서 2칸 차지 */
  wide?: boolean;
}

export interface Layout {
  version: 1;
  panels: Panel[];
}
