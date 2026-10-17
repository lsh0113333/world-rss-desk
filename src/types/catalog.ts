export type Continent =
  | "asia"
  | "europe"
  | "north-america"
  | "south-america"
  | "middle-east"
  | "africa"
  | "oceania"
  | "global";

export type Category = "top" | "world" | "politics" | "economy" | "tech" | "science";

/** ISO 3166-1 alpha-2. 지역 단위는 'EU'(유럽), 'ME'(중동), 국제 매체는 'WORLD' */
export type CountryCode = string;

export interface CatalogFeed {
  /** 'kr-yonhap-top' 형식. 전역 유일, 한번 정하면 바꾸지 않는다 (사용자 레이아웃이 참조) */
  id: string;
  name: string;
  url: string;
  homepage: string;
  continent: Continent;
  country: CountryCode;
  category: Category;
  language: string;
  /** 표시용 주석 (예: '중국 정부 시각') */
  note?: string;
}
