import type { StoryItem } from "@/types/insights";

/** 키워드 워치: 관심 키워드가 제목에 나온 기사를 모든 패널에서 찾는다 */
export const MAX_WATCH_KEYWORDS = 20;
export const MAX_KEYWORD_LENGTH = 40;

export function normalizeKeywords(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const k = raw.trim().slice(0, MAX_KEYWORD_LENGTH);
    if (!k || seen.has(k.toLowerCase())) continue;
    seen.add(k.toLowerCase());
    out.push(k);
    if (out.length >= MAX_WATCH_KEYWORDS) break;
  }
  return out;
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * 키워드 하나의 정규식 조각. 영어 등 ASCII 키워드는 단어 단위("AI"가 "waives"에 걸리지 않게),
 * 한국어는 부분 일치(조사가 붙어도 찾도록: "반도체가")
 */
function keywordSource(keyword: string): string {
  const escaped = escapeRegex(keyword);
  return /^[\x20-\x7e]+$/.test(keyword) ? `(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])` : escaped;
}

/** 제목에 들어 있는 키워드 (대소문자 무시) */
export function matchKeywords(title: string, keywords: string[]): string[] {
  return keywords.filter((k) => k && new RegExp(keywordSource(k), "iu").test(title));
}

export interface Mentions {
  /** 최신순, 같은 기사는 한 번 */
  items: StoryItem[];
  /** 아직 읽지 않은 기사 수 */
  unread: number;
}

export function findMentions(items: StoryItem[], keywords: string[], readIds: Set<string>): Mentions {
  const seen = new Set<string>();
  const found = items.filter((i) => {
    if (seen.has(i.article.id) || matchKeywords(i.article.title, keywords).length === 0) return false;
    seen.add(i.article.id);
    return true;
  });
  const t = (i: StoryItem) => (i.article.publishedAt ? Date.parse(i.article.publishedAt) : 0);
  found.sort((a, b) => t(b) - t(a));
  return { items: found, unread: found.filter((i) => !readIds.has(i.article.id)).length };
}

export interface TextPart {
  text: string;
  hit: boolean;
}

/** 제목을 키워드 일치 부분과 나머지로 나눈다 (React에서 <mark>로 감싸 그리기용, HTML 문자열을 만들지 않는다) */
export function highlightParts(text: string, keywords: string[]): TextPart[] {
  const list = keywords.filter(Boolean);
  if (list.length === 0) return [{ text, hit: false }];
  // 긴 키워드부터 (겹칠 때 더 구체적인 쪽). 원본 배열(레이아웃 상태)은 건드리지 않는다
  const sorted = [...list].sort((a, b) => b.length - a.length);
  const pattern = new RegExp(sorted.map(keywordSource).join("|"), "giu");
  const parts: TextPart[] = [];
  let last = 0;
  for (const m of text.matchAll(pattern)) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index), hit: false });
    parts.push({ text: m[0], hit: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), hit: false });
  return parts.length ? parts : [{ text, hit: false }];
}
