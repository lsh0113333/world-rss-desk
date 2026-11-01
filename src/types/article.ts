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
}
