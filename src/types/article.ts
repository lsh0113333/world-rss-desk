export interface Article {
  /** link(또는 guid) 기반 해시 */
  id: string;
  /** 순수 텍스트 */
  title: string;
  /** http(s)만 */
  link: string;
  /** ISO 8601, 없으면 null */
  publishedAt: string | null;
  /** 매체명 */
  source: string;
  /** 순수 텍스트, 최대 300자 */
  summary?: string;
  /** 대표 이미지 (http(s)만). RSS에 없으면 비어 있고 화면에서 /api/thumb로 보완 */
  image?: string;
}

export interface FeedError {
  /** 카탈로그 id 또는 커스텀 URL */
  feed: string;
  message: string;
}

export interface FeedsResponse {
  articles: Article[];
  errors: FeedError[];
  fetchedAt: string;
}

/** 읽기 모드 본문 블록. 외부 HTML을 그대로 그리지 않고 이 데이터만 React 요소로 렌더링한다 */
export type ReaderBlock =
  | { type: "p" | "h2" | "h3" | "blockquote" | "li"; text: string }
  | { type: "img"; src: string; alt?: string };

export interface ReaderDoc {
  title: string;
  siteName?: string;
  byline?: string;
  publishedAt?: string;
  blocks: ReaderBlock[];
}

/** /api/article 응답: 실제 페이지(iframe) / 읽기 모드 / 새 탭 안내 */
export type ArticleView =
  | { mode: "frame"; url: string }
  | ({ mode: "reader"; url: string } & ReaderDoc)
  | { mode: "link"; url: string; reason: string };
