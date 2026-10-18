import type { Article } from "@/types/article";
import type { InsightEngine, StoryItem } from "@/types/insights";
import type { Panel } from "@/types/layout";
import { getFeedById } from "./catalog";
import { clusterStories } from "./story-cluster";
import { findIssues } from "./trending";

/**
 * 화면의 패널 기사 → 분석 입력. 나라는 매체의 카탈로그 나라(여러 나라를 섞은 패널 대비) → 패널 나라 순.
 * 패널 순서를 유지한다 (묶음의 대표 기사는 앞 패널의 기사).
 */
export function toStoryItems(panels: Panel[], articlesByPanel: Record<string, Article[]>): StoryItem[] {
  const items: StoryItem[] = [];
  for (const panel of panels) {
    const articles = articlesByPanel[panel.id];
    if (!articles) continue;
    const countryBySource = new Map<string, string>();
    for (const id of panel.feedIds) {
      const feed = getFeedById(id);
      if (feed) countryBySource.set(feed.name, feed.country);
    }
    for (const article of articles) {
      const country = countryBySource.get(article.source) ?? panel.country;
      items.push({
        article,
        panelId: panel.id,
        ...(country ? { country } : {}),
        ...(panel.category ? { category: panel.category } : {}),
      });
    }
  }
  return items;
}

/** 1차 분석 엔진: 브라우저 안 규칙 기반 (무료). 2차에서 같은 타입의 AI 엔진으로 교체 가능 */
export const ruleEngine: InsightEngine = (items, now) => ({
  clusters: clusterStories(items),
  issues: findIssues(items, now),
});
