import type { Issue, StoryItem } from "@/types/insights";
import { tokenize } from "../keywords";
import { normalizeLink } from "../merge";

/**
 * 파이프라인용 사건 찾기 (전체 카탈로그 규모, 하루 수천 건).
 * 단어 하나("AI", "Trump")로 묶으면 서로 다른 일이 한 바구니에 들어가므로, 한 제목 안에서 **함께 나오는 단어 쌍**
 * ("helen"+"haines", "marseille"+"riots")을 기준으로 여러 나라·매체가 다루는 묶음을 찾는다.
 * 같은 기사들을 공유하는 쌍은 하나로 합치고, 기사 하나는 점수가 가장 높은 사건 하나에만 넣는다.
 */

export const EVENT_LIMIT = 40;
const MIN_SOURCES = 3;
const MIN_COUNTRIES = 2;
/** 한 제목에서 쌍을 만들 단어 수 (앞에서부터) */
const MAX_TERMS_PER_TITLE = 10;
/** 같은 기사들을 이만큼 공유하면 같은 사건 (Jaccard) */
const MERGE_OVERLAP = 0.34;
/** 전체 기사의 이 비율(최소 COMMON_MIN건) 넘게 나오는 단어는 "흔한 단어". 둘 다 흔한 쌍("bomb"+"threat")은 서로 다른 일을 섞으므로 쓰지 않는다 */
const COMMON_SHARE = 0.008;
const COMMON_MIN = 25;
const RECENT_MS = 60 * 60 * 1000;

interface PairStats {
  key: string;
  terms: [string, string];
  items: Set<StoryItem>;
  sources: Set<string>;
  countries: Set<string>;
}

const time = (i: StoryItem) => (i.article.publishedAt ? Date.parse(i.article.publishedAt) : 0);
const score = (sources: number, countries: number) => countries * 3 + sources;

function jaccard<T>(a: Set<T>, b: Set<T>): number {
  let shared = 0;
  for (const x of a) if (b.has(x)) shared++;
  return shared / (a.size + b.size - shared);
}

export function findEvents(items: StoryItem[], now: Date, opts: { limit?: number } = {}): Issue[] {
  const limit = opts.limit ?? EVENT_LIMIT;

  const seen = new Set<string>();
  const unique = items.filter((i) => {
    const link = normalizeLink(i.article.link);
    if (seen.has(link)) return false;
    seen.add(link);
    return true;
  });

  const displays = new Map<string, Map<string, number>>();
  const df = new Map<string, number>();
  const keysOf = new Map<StoryItem, string[]>();
  for (const item of unique) {
    const keys: string[] = [];
    for (const { key, display } of tokenize(item.article.title)) {
      const d = displays.get(key) ?? new Map<string, number>();
      d.set(display, (d.get(display) ?? 0) + 1);
      displays.set(key, d);
      if (!keys.includes(key)) keys.push(key);
    }
    for (const k of keys) df.set(k, (df.get(k) ?? 0) + 1);
    keysOf.set(item, keys);
  }
  const commonAt = Math.max(COMMON_MIN, unique.length * COMMON_SHARE);
  const common = (t: string) => (df.get(t) ?? 0) > commonAt;

  const pairs = new Map<string, PairStats>();
  for (const item of unique) {
    const terms = keysOf.get(item)!.slice(0, MAX_TERMS_PER_TITLE).sort();
    for (let a = 0; a < terms.length; a++) {
      for (let b = a + 1; b < terms.length; b++) {
        if (common(terms[a]) && common(terms[b])) continue;
        const key = `${terms[a]} ${terms[b]}`;
        let s = pairs.get(key);
        if (!s) {
          s = { key, terms: [terms[a], terms[b]], items: new Set(), sources: new Set(), countries: new Set() };
          pairs.set(key, s);
        }
        s.items.add(item);
        s.sources.add(item.article.source);
        if (item.country) s.countries.add(item.country);
      }
    }
  }

  const candidates = [...pairs.values()]
    .filter((p) => p.sources.size >= MIN_SOURCES && p.countries.size >= MIN_COUNTRIES)
    .sort(
      (a, b) =>
        score(b.sources.size, b.countries.size) - score(a.sources.size, a.countries.size) ||
        b.items.size - a.items.size ||
        a.key.localeCompare(b.key),
    );

  // 같은 기사들을 공유하는 쌍을 합친다
  const groups: { terms: string[]; items: Set<StoryItem> }[] = [];
  for (const pair of candidates) {
    const group = groups.find((g) => jaccard(g.items, pair.items) >= MERGE_OVERLAP);
    if (group) {
      for (const t of pair.terms) if (!group.terms.includes(t)) group.terms.push(t);
      for (const i of pair.items) group.items.add(i);
    } else {
      groups.push({ terms: [...pair.terms], items: new Set(pair.items) });
    }
  }

  // 기사 하나는 점수 높은 사건 하나에만
  const measure = (set: Iterable<StoryItem>) => {
    const list = [...set];
    return {
      list,
      sources: new Set(list.map((i) => i.article.source)),
      countries: new Set(list.map((i) => i.country).filter((c): c is string => !!c)),
    };
  };
  const ranked = groups
    .map((g) => ({ g, m: measure(g.items) }))
    .sort((a, b) => score(b.m.sources.size, b.m.countries.size) - score(a.m.sources.size, a.m.countries.size));
  const taken = new Set<StoryItem>();
  const events: Issue[] = [];
  for (const { g } of ranked) {
    if (events.length >= limit) break;
    const m = measure([...g.items].filter((i) => !taken.has(i)));
    if (m.sources.size < MIN_SOURCES || m.countries.size < MIN_COUNTRIES) continue;
    for (const i of m.list) taken.add(i);
    const sorted = m.list.sort((a, b) => time(b) - time(a));
    const label = g.terms
      .slice(0, 2)
      .map((t) => [...(displays.get(t) ?? new Map([[t, 1]])).entries()].sort((a, b) => b[1] - a[1])[0][0])
      .join(" · ");
    events.push({
      id: g.terms.join(" "),
      label,
      terms: g.terms,
      items: sorted,
      countries: [...new Set(sorted.map((i) => i.country).filter((c): c is string => !!c))],
      sources: [...new Set(sorted.map((i) => i.article.source))],
      recent: sorted.filter((i) => now.getTime() - time(i) <= RECENT_MS).length,
    });
  }
  return events;
}
