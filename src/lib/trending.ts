import type { Issue, StoryItem } from "@/types/insights";
import { tokenize } from "./keywords";
import { normalizeLink } from "./merge";

export const ISSUE_LIMIT = 8;
const RECENT_MS = 60 * 60 * 1000;
/** 키워드가 같은 기사들에 이만큼 겹쳐 나오면 한 이슈로 합친다 (Jaccard) */
const MERGE_OVERLAP = 0.5;
/** 전체 기사의 이 비율보다 많이 나오는 단어는 이슈가 아니라 흔한 말로 본다 */
const MAX_SHARE = 0.25;
const MAX_LABEL_TERMS = 2;

interface TermStats {
  key: string;
  items: Set<StoryItem>;
  sources: Set<string>;
  countries: Set<string>;
  displays: Map<string, number>;
}

const time = (i: StoryItem) => (i.article.publishedAt ? Date.parse(i.article.publishedAt) : 0);

function topDisplay(displays: Map<string, number>): string {
  return [...displays.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function jaccard<T>(a: Set<T>, b: Set<T>): number {
  let shared = 0;
  for (const x of a) if (b.has(x)) shared++;
  return shared / (a.size + b.size - shared);
}

/**
 * 오늘의 이슈: 여러 매체(2곳 이상)와 여러 나라(2곳 이상, 또는 매체 3곳 이상)가 함께 쓰는 키워드를
 * 나라 수 → 매체 수 순으로 고르고, 같은 기사들에 같이 나오는 키워드는 하나로 합친다.
 */
export function findIssues(items: StoryItem[], now: Date, opts: { limit?: number } = {}): Issue[] {
  const limit = opts.limit ?? ISSUE_LIMIT;

  // 같은 기사가 여러 패널에 있으면 한 번만
  const seen = new Set<string>();
  const unique = items.filter((i) => {
    const link = normalizeLink(i.article.link);
    if (seen.has(link)) return false;
    seen.add(link);
    return true;
  });

  const stats = new Map<string, TermStats>();
  for (const item of unique) {
    const keys = new Set<string>();
    for (const { key, display } of tokenize(item.article.title)) {
      let s = stats.get(key);
      if (!s) {
        s = { key, items: new Set(), sources: new Set(), countries: new Set(), displays: new Map() };
        stats.set(key, s);
      }
      s.displays.set(display, (s.displays.get(display) ?? 0) + 1);
      if (keys.has(key)) continue;
      keys.add(key);
      s.items.add(item);
      s.sources.add(item.article.source);
      if (item.country) s.countries.add(item.country);
    }
  }

  const maxItems = Math.max(5, unique.length * MAX_SHARE);
  const score = (s: TermStats) => s.countries.size * 3 + s.sources.size;
  const candidates = [...stats.values()]
    .filter((s) => s.sources.size >= 2 && (s.countries.size >= 2 || s.sources.size >= 3) && s.items.size <= maxItems)
    .sort((a, b) => score(b) - score(a) || b.items.size - a.items.size || a.key.localeCompare(b.key));

  const groups: { terms: TermStats[]; items: Set<StoryItem> }[] = [];
  for (const term of candidates) {
    const group = groups.find((g) => jaccard(g.items, term.items) >= MERGE_OVERLAP);
    if (group) {
      group.terms.push(term);
      for (const i of term.items) group.items.add(i);
    } else if (groups.length < limit) {
      groups.push({ terms: [term], items: new Set(term.items) });
    }
  }

  return groups.map(({ terms, items: set }) => {
    const sorted = [...set].sort((a, b) => time(b) - time(a));
    return {
      id: terms[0].key,
      label: terms
        .slice(0, MAX_LABEL_TERMS)
        .map((t) => topDisplay(t.displays))
        .join(" · "),
      terms: terms.map((t) => t.key),
      items: sorted,
      countries: [...new Set(sorted.map((i) => i.country).filter((c): c is string => !!c))],
      sources: [...new Set(sorted.map((i) => i.article.source))],
      recent: sorted.filter((i) => now.getTime() - time(i) <= RECENT_MS).length,
    };
  });
}
