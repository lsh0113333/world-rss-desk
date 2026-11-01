import type { Article } from "./article";
import type { Category, CountryCode } from "./catalog";

/** 사건 찾기 입력: 기사 + 어느 피드·나라·분야에서 왔는지 */
export interface StoryItem {
  article: Article;
  panelId: string;
  country?: CountryCode;
  category?: Category;
}

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
