import type { Category, CountryCode } from "@/types/catalog";
import type { StoryItem } from "@/types/insights";
import type { Panel } from "@/types/layout";
import { feedsFor } from "./catalog";
import { CONTINENTS, countriesByContinent, getCategory, getCountry } from "./constants";
import { extractTerms, tokenize } from "./keywords";

/**
 * 개인화 추천: 읽은 기사 기록 → 선호(매체·나라·분야·키워드) → 화면에 올라온 기사 중 추천.
 * 모두 브라우저 안에서 계산한다 (서버 저장·비용 없음).
 */

/** 기사를 열 때 남기는 기록 (ReadHistoryRepository로 저장) */
export interface ReadEvent {
  id: string;
  at: string;
  source: string;
  country?: CountryCode;
  category?: Category;
  terms: string[];
}

export const MAX_READ_EVENTS = 500;
export const MIN_EVENTS_FOR_PROFILE = 5;
const HALF_LIFE_MS = 7 * 24 * 3_600_000;
const MAX_REC_AGE_MS = 24 * 3_600_000;
const MIN_SCORE = 0.2;
const MAX_PER_SOURCE = 2;
const CONTINENT_SHARE = 0.2;

export function readEventOf(item: StoryItem, now: Date): ReadEvent {
  return {
    id: item.article.id,
    at: now.toISOString(),
    source: item.article.source,
    ...(item.country ? { country: item.country } : {}),
    ...(item.category ? { category: item.category } : {}),
    terms: extractTerms(item.article.title),
  };
}

/** 같은 기사의 이전 기록은 지우고 맨 뒤에 추가, 오래된 것부터 버린다 */
export function addReadEvent(events: ReadEvent[], event: ReadEvent): ReadEvent[] {
  const next = events.filter((e) => e.id !== event.id);
  next.push(event);
  return next.length > MAX_READ_EVENTS ? next.slice(next.length - MAX_READ_EVENTS) : next;
}

export interface Profile {
  ready: boolean;
  /** 시간 감쇠를 적용한 전체 가중치 */
  total: number;
  sources: Map<string, number>;
  countries: Map<string, number>;
  categories: Map<string, number>;
  terms: Map<string, number>;
}

const bump = (m: Map<string, number>, k: string | undefined, w: number) => {
  if (k) m.set(k, (m.get(k) ?? 0) + w);
};

/** 최근 기록일수록 크게 (반감기 7일) */
export function buildProfile(events: ReadEvent[], now: Date): Profile {
  const profile: Profile = { ready: events.length >= MIN_EVENTS_FOR_PROFILE, total: 0, sources: new Map(), countries: new Map(), categories: new Map(), terms: new Map() };
  for (const e of events) {
    const age = Math.max(0, now.getTime() - Date.parse(e.at));
    const w = Number.isNaN(age) ? 0 : 0.5 ** (age / HALF_LIFE_MS);
    profile.total += w;
    bump(profile.sources, e.source, w);
    bump(profile.countries, e.country, w);
    bump(profile.categories, e.category, w);
    for (const t of e.terms) bump(profile.terms, t, w);
  }
  return profile;
}

export interface Recommendation {
  item: StoryItem;
  score: number;
  /** "관심 키워드: Iran" 같은 한 줄 이유 */
  reason: string;
}

export function recommend(profile: Profile, items: StoryItem[], readIds: Set<string>, now: Date, limit = 6): Recommendation[] {
  if (!profile.ready || profile.total === 0) return [];
  const share = (m: Map<string, number>, k?: string) => (k ? (m.get(k) ?? 0) / profile.total : 0);

  const seen = new Set<string>();
  const scored: Recommendation[] = [];
  for (const item of items) {
    const { article } = item;
    if (seen.has(article.id) || readIds.has(article.id) || !article.publishedAt) continue;
    seen.add(article.id);
    if (now.getTime() - Date.parse(article.publishedAt) > MAX_REC_AGE_MS) continue;

    let bestTerm: { display: string; w: number } | null = null;
    for (const t of tokenize(article.title)) {
      const w = share(profile.terms, t.key);
      if (w > 0 && (!bestTerm || w > bestTerm.w)) bestTerm = { display: t.display, w };
    }
    const term = Math.min(1, bestTerm?.w ?? 0);
    const source = share(profile.sources, article.source);
    const country = share(profile.countries, item.country);
    const category = share(profile.categories, item.category);
    const score = 0.5 * term + 0.2 * source + 0.2 * country + 0.1 * category;
    if (score < MIN_SCORE) continue;

    let reason: string;
    if (bestTerm && term >= source && term >= country) reason = `관심 키워드: ${bestTerm.display}`;
    else if (source >= country) reason = `자주 읽는 매체: ${article.source}`;
    else {
      const meta = item.country ? getCountry(item.country) : undefined;
      reason = meta ? `자주 보는 나라: ${meta.flag} ${meta.name}` : `자주 보는 분야: ${item.category ? getCategory(item.category).label : ""}`;
    }
    scored.push({ item, score, reason });
  }

  scored.sort((a, b) => b.score - a.score);
  const perSource = new Map<string, number>();
  return scored
    .filter((r) => {
      const n = perSource.get(r.item.article.source) ?? 0;
      perSource.set(r.item.article.source, n + 1);
      return n < MAX_PER_SOURCE;
    })
    .slice(0, limit);
}

export interface PanelSuggestion {
  country: CountryCode;
  category: Category;
  reason: string;
}

/** 많이 읽는 대륙에서 아직 패널이 없는 나라를 제안한다 ("최근 중동 기사를 많이 읽었어요") */
export function suggestPanels(profile: Profile, panels: Panel[], limit = 3): PanelSuggestion[] {
  if (!profile.ready || profile.total === 0) return [];
  const byContinent = new Map<string, number>();
  for (const [code, w] of profile.countries) {
    const continent = getCountry(code)?.continent;
    if (continent) byContinent.set(continent, (byContinent.get(continent) ?? 0) + w);
  }
  const have = new Set(panels.map((p) => p.country).filter(Boolean));
  const out: PanelSuggestion[] = [];
  for (const [continent, w] of [...byContinent.entries()].sort((a, b) => b[1] - a[1])) {
    if (w / profile.total < CONTINENT_SHARE) break;
    const label = CONTINENTS.find((c) => c.id === continent)?.label ?? continent;
    for (const c of countriesByContinent(continent as Parameters<typeof countriesByContinent>[0])) {
      if (out.length >= limit) return out;
      if (have.has(c.code) || feedsFor(c.code, "top").length === 0) continue;
      out.push({ country: c.code, category: "top", reason: `최근 ${label} 기사를 많이 읽었어요` });
    }
  }
  return out;
}
