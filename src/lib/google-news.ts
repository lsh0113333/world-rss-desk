/**
 * 키워드 패널: 구글 뉴스 검색 RSS (무료, 키 없음).
 * 피드 약관상 개인 피드 리더 용도로만 쓴다 (이 앱은 1인용).
 */
const HANGUL = /[가-힣]/;
/** 최근 이틀 기사만 */
const WINDOW = "when:2d";

export function googleNewsUrl(query: string): string {
  const q = `${query.trim()} ${WINDOW}`;
  const [hl, gl, ceid] = HANGUL.test(query) ? ["ko", "KR", "KR:ko"] : ["en-US", "US", "US:en"];
  const params = new URLSearchParams({ q, hl, gl, ceid });
  return `https://news.google.com/rss/search?${params.toString()}`;
}

/** 구글 뉴스 경유 링크 (썸네일 조회를 건너뛴다 — og:image가 구글 로고라서) */
export function isGoogleNewsLink(link: string): boolean {
  try {
    return new URL(link).hostname === "news.google.com";
  } catch {
    return false;
  }
}
