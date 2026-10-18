import type { Article } from "@/types/article";
import type { StoryCluster, StoryItem } from "@/types/insights";
import { extractTerms } from "./keywords";
import { normalizeLink } from "./merge";

/** 공통 키워드가 이 개수 이상이고 */
const MIN_SHARED = 2;
/** 짧은 쪽 제목 키워드의 이 비율 이상이 겹치면 같은 소식 */
const MIN_OVERLAP = 0.5;

const time = (i: StoryItem) => (i.article.publishedAt ? Date.parse(i.article.publishedAt) : 0);

function sameStory(a: Set<string>, b: Set<string>): boolean {
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  return shared >= MIN_SHARED && shared / Math.min(a.size, b.size) >= MIN_OVERLAP;
}

/**
 * 같은 소식 묶기. 입력 순서(패널 순서)대로 보며 각 묶음의 대표 기사와 비교한다
 * (대표와만 비교해 A~B~C 식으로 줄줄이 커지는 것을 막는다). 링크가 같으면 무조건 같은 소식.
 */
export function clusterStories(items: StoryItem[]): StoryCluster[] {
  const groups: { terms: Set<string>; links: Set<string>; items: StoryItem[] }[] = [];

  for (const item of items) {
    const link = normalizeLink(item.article.link);
    const terms = new Set(extractTerms(item.article.title));
    const group = groups.find((g) => g.links.has(link) || sameStory(g.terms, terms));
    if (!group) {
      groups.push({ terms, links: new Set([link]), items: [item] });
    } else if (!group.links.has(link)) {
      group.links.add(link);
      group.items.push(item);
    }
  }

  return groups.map(({ items: [leader, ...rest] }) => {
    const ordered = [leader, ...rest.sort((a, b) => time(b) - time(a))];
    return {
      id: leader.article.id,
      items: ordered,
      sources: [...new Set(ordered.map((i) => i.article.source))],
      countries: [...new Set(ordered.map((i) => i.country).filter((c): c is string => !!c))],
    };
  });
}

/** 기사 id → 그 기사가 속한 묶음 */
export function clusterIndex(clusters: StoryCluster[]): Map<string, StoryCluster> {
  const index = new Map<string, StoryCluster>();
  for (const cluster of clusters) for (const item of cluster.items) index.set(item.article.id, cluster);
  return index;
}

/**
 * 패널 안의 같은 소식은 첫 기사만 남기고, 남긴 기사에 "다른 매체 N곳"을 붙인다.
 * (다른 패널에서 같은 소식을 다룬 매체도 센다)
 */
export function dedupeByCluster(
  articles: Article[],
  index: Map<string, StoryCluster> | undefined,
): { articles: Article[]; alsoIn: Record<string, number> } {
  if (!index) return { articles, alsoIn: {} };
  const used = new Set<string>();
  const out: Article[] = [];
  const alsoIn: Record<string, number> = {};
  for (const article of articles) {
    const cluster = index.get(article.id);
    if (cluster) {
      if (used.has(cluster.id)) continue;
      used.add(cluster.id);
      const others = cluster.sources.filter((s) => s !== article.source).length;
      if (others > 0) alsoIn[article.id] = others;
    }
    out.push(article);
  }
  return { articles: out, alsoIn };
}
