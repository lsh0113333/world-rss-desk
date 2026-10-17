import type { Category, CountryCode } from "./catalog";

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
}

export interface Layout {
  version: 1;
  panels: Panel[];
}
