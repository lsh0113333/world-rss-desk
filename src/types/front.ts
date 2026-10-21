import type { FeedError } from "./article";
import type { Continent, CountryCode } from "./catalog";

/** 가판대(한 페이지) 데이터: 대륙 → 나라 → 매체 → 최신 제목 */

export interface FrontItem {
  id: string;
  /** 순수 텍스트 */
  title: string;
  link: string;
  /** ISO 8601, 없으면 null */
  publishedAt: string | null;
}

export interface FrontOutlet {
  name: string;
  homepage: string;
  language: string;
  /** 최신순 */
  items: FrontItem[];
}

export interface FrontCountry {
  code: CountryCode;
  name: string;
  /** IANA 시간대 (현지 시각 표시용) */
  timeZone: string;
  outlets: FrontOutlet[];
}

export interface FrontContinent {
  id: Continent;
  label: string;
  countries: FrontCountry[];
}

export interface FrontResponse {
  fetchedAt: string;
  continents: FrontContinent[];
  errors: FeedError[];
}
