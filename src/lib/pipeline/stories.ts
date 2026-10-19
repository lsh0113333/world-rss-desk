import type { StoryItem } from "@/types/insights";
import type { PipelineArticle } from "@/types/world";
import { hashId } from "../text";
import { findEvents } from "./events";

/** 한 번의 실행에서 저장하는 사건 수 */
export const STORY_LIMIT = 40;
/** 사건 하나에 연결하는 기사 수 */
export const STORY_ARTICLE_LIMIT = 40;
/** 이전 사건 기사와 이 비율 이상 겹치면 같은 사건 */
const ARTICLE_OVERLAP = 0.3;
/** 이전 사건 키워드와 이만큼 겹치면 같은 사건 (Jaccard) */
const TERM_OVERLAP = 0.5;

/** 사건 초안 (id 배정 전) */
export interface StoryDraft {
  leadTitle: string;
  leadLink: string;
  image?: string;
  terms: string[];
  countries: string[];
  sources: string[];
  /** 최신순 */
  articleIds: string[];
  score: number;
}

export interface Story extends StoryDraft {
  id: string;
}

/** 이전 실행에서 저장된 사건 (사건 이어 쓰기용) */
export interface PreviousStory {
  id: string;
  articleIds: string[];
  terms: string[];
}

export function toPipelineItems(articles: PipelineArticle[]): StoryItem[] {
  return articles.map((a) => ({
    article: {
      id: a.id,
      title: a.title,
      link: a.link,
      publishedAt: a.publishedAt,
      source: a.source,
      ...(a.summary ? { summary: a.summary } : {}),
      ...(a.image ? { image: a.image } : {}),
    },
    panelId: a.feedId,
    country: a.country,
    category: a.category,
  }));
}

/**
 * 수집된 전체 기사 → 사건 초안. 여러 나라·매체가 함께 쓰는 단어 쌍으로 사건을 찾는다 (events.ts).
 */
export function buildStories(articles: PipelineArticle[], now: Date): StoryDraft[] {
  if (articles.length === 0) return [];
  const issues = findEvents(toPipelineItems(articles), now, { limit: STORY_LIMIT });
  return issues.map((issue) => {
    const items = issue.items.slice(0, STORY_ARTICLE_LIMIT);
    const lead = items[0].article;
    const image = items.find((i) => i.article.image)?.article.image;
    return {
      leadTitle: lead.title,
      leadLink: lead.link,
      ...(image ? { image } : {}),
      terms: issue.terms,
      countries: issue.countries,
      sources: issue.sources,
      articleIds: items.map((i) => i.article.id),
      score: issue.countries.length * 3 + issue.sources.length,
    };
  });
}

function jaccard(a: string[], b: string[]): number {
  const setB = new Set(b);
  const shared = new Set(a.filter((x) => setB.has(x))).size;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : shared / union;
}

function overlap(draft: StoryDraft, prev: PreviousStory): number {
  const prevIds = new Set(prev.articleIds);
  const byArticles = draft.articleIds.filter((id) => prevIds.has(id)).length / Math.max(1, draft.articleIds.length);
  if (byArticles >= ARTICLE_OVERLAP) return 1 + byArticles;
  const byTerms = jaccard(draft.terms, prev.terms);
  return byTerms >= TERM_OVERLAP ? byTerms : 0;
}

function newId(draft: StoryDraft, now: Date, taken: Set<string>): string {
  const day = now.toISOString().slice(0, 10).replace(/-/g, "");
  let id = `s-${day}-${hashId(draft.terms.join(" "))}`;
  for (let n = 2; taken.has(id); n++) id = `s-${day}-${hashId(`${draft.terms.join(" ")}#${n}`)}`;
  return id;
}

/**
 * 사건에 id를 배정한다 (Aggregator의 correlation id). 이전 사건과 기사나 키워드가 충분히 겹치면 그 id를 이어 써서
 * 시간축(스냅샷·AI 결과)이 끊기지 않게 한다. 이전 사건 하나는 가장 많이 겹치는 초안 하나에만 배정한다.
 */
export function assignStoryIds(drafts: StoryDraft[], previous: PreviousStory[], now: Date): Story[] {
  const pairs: { d: number; p: number; score: number }[] = [];
  drafts.forEach((draft, d) =>
    previous.forEach((prev, p) => {
      const score = overlap(draft, prev);
      if (score > 0) pairs.push({ d, p, score });
    }),
  );
  pairs.sort((a, b) => b.score - a.score);

  const ids = new Array<string | undefined>(drafts.length);
  const usedPrev = new Set<number>();
  for (const { d, p } of pairs) {
    if (ids[d] !== undefined || usedPrev.has(p)) continue;
    ids[d] = previous[p].id;
    usedPrev.add(p);
  }

  const taken = new Set(ids.filter((id): id is string => !!id));
  return drafts.map((draft, i) => {
    let id = ids[i];
    if (!id) {
      id = newId(draft, now, taken);
      taken.add(id);
    }
    return { ...draft, id };
  });
}
