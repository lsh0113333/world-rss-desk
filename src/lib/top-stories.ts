import type { Article } from "@/types/article";
import { normalizeLink } from "./merge";

export interface TopStory {
  panelId: string;
  /** 아직 데이터가 없거나 모든 후보가 중복이면 null */
  article: Article | null;
}

/**
 * 패널 순서대로 각 패널의 첫 기사를 고르되, 앞 패널에서 이미 고른 기사는 건너뛴다.
 * storyKey: 같은 소식 판정 키 (기본은 링크, 같은 소식 묶기를 쓰면 묶음 id)
 */
export function pickTopStories(
  panelIds: string[],
  candidates: Record<string, Article[]>,
  storyKey: (article: Article) => string = (a) => normalizeLink(a.link),
): TopStory[] {
  const used = new Set<string>();
  return panelIds.map((panelId) => {
    const article = (candidates[panelId] ?? []).find((c) => !used.has(storyKey(c)) && !used.has(normalizeLink(c.link))) ?? null;
    if (article) {
      used.add(storyKey(article));
      used.add(normalizeLink(article.link));
    }
    return { panelId, article };
  });
}
