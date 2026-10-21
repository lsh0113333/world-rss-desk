import type { Article } from "@/types/article";
import type { CatalogFeed, Category, Continent, CountryCode } from "@/types/catalog";
import type { FrontContinent, FrontCountry, FrontItem } from "@/types/front";
import { CONTINENTS, getCountry } from "./constants";

/**
 * 가판대: 카탈로그를 대륙 → 나라 → 매체 구조로 고른다 (intent/2026-10-20-newsstand.md).
 * - 국제 구역은 없다. 대륙이 최상위
 * - 묶음 지역(EU·ME·ASIA·LATAM·AFRICA) 매체는 본사가 있는 나라로 옮긴다 ("어느 나라의 시각인가")
 * - 매체마다 대표 피드 하나 (분야 단계 없음)
 */

export const NEWSSTAND_CONTINENTS = CONTINENTS.filter((c) => c.id !== "global");

const REGION_CODES = new Set(["EU", "ME", "ASIA", "LATAM", "AFRICA", "WORLD"]);

/** 묶음 지역 매체의 본사 나라 (소문자 매체명). 없으면 뺀다 (BBC 지역판, AllAfrica 등) */
const HOME_COUNTRY: Record<string, CountryCode> = {
  euronews: "FR",
  dw: "DE",
  "the guardian": "GB",
  "france 24": "FR",
  "politico europe": "BE",
  euobserver: "BE",
  "balkan insight": "RS",
  sifted: "GB",
  "tech.eu": "BE",
  "eu-startups": "ES",
  "the next web": "NL",
  "al jazeera": "QA",
  "middle east eye": "GB",
  "arab news": "SA",
  "al-monitor": "US",
  cna: "SG",
  "the straits times": "SG",
  mercopress: "UY",
};

/** 카탈로그 constants에 없는 나라 (옮겨 오면서 생김) */
const EXTRA_COUNTRIES: Record<CountryCode, { name: string; continent: Continent }> = {
  BE: { name: "벨기에", continent: "europe" },
  RS: { name: "세르비아", continent: "europe" },
  UY: { name: "우루과이", continent: "south-america" },
};

const TIME_ZONES: Record<CountryCode, string> = {
  KR: "Asia/Seoul", JP: "Asia/Tokyo", CN: "Asia/Shanghai", IN: "Asia/Kolkata", VN: "Asia/Ho_Chi_Minh", SG: "Asia/Singapore",
  TW: "Asia/Taipei", PH: "Asia/Manila", TH: "Asia/Bangkok",
  US: "America/New_York", CA: "America/Toronto",
  GB: "Europe/London", DE: "Europe/Berlin", FR: "Europe/Paris", BE: "Europe/Brussels", UA: "Europe/Kyiv", RU: "Europe/Moscow",
  TR: "Europe/Istanbul", ES: "Europe/Madrid", IT: "Europe/Rome", NO: "Europe/Oslo", SE: "Europe/Stockholm", DK: "Europe/Copenhagen",
  FI: "Europe/Helsinki", IS: "Atlantic/Reykjavik", IE: "Europe/Dublin", NL: "Europe/Amsterdam", CH: "Europe/Zurich",
  AT: "Europe/Vienna", PL: "Europe/Warsaw", GR: "Europe/Athens", PT: "Europe/Lisbon", EE: "Europe/Tallinn", LT: "Europe/Vilnius",
  CZ: "Europe/Prague", HU: "Europe/Budapest", RS: "Europe/Belgrade",
  IL: "Asia/Jerusalem", IR: "Asia/Tehran", AE: "Asia/Dubai", SA: "Asia/Riyadh", QA: "Asia/Qatar",
  BR: "America/Sao_Paulo", MX: "America/Mexico_City", AR: "America/Argentina/Buenos_Aires", UY: "America/Montevideo",
  AU: "Australia/Sydney", NZ: "Pacific/Auckland",
  ZA: "Africa/Johannesburg", NG: "Africa/Lagos", KE: "Africa/Nairobi", EG: "Africa/Cairo",
};

/** 대표 피드 우선순위. 목록에 없는 분야는 그 뒤 */
const CATEGORY_ORDER: Category[] = ["top", "world", "politics", "economy", "society", "tech", "science"];
const rank = (c: Category) => {
  const i = CATEGORY_ORDER.indexOf(c);
  return i < 0 ? CATEGORY_ORDER.length : i;
};

export function countryMeta(code: CountryCode): { name: string; continent: Continent; timeZone: string } | undefined {
  const timeZone = TIME_ZONES[code];
  const base = getCountry(code) ?? EXTRA_COUNTRIES[code];
  if (!timeZone || !base) return undefined;
  return { name: base.name, continent: base.continent, timeZone };
}

export interface OutletPick {
  continent: Continent;
  country: CountryCode;
  name: string;
  feed: CatalogFeed;
}

export function selectOutlets(catalog: readonly CatalogFeed[]): OutletPick[] {
  const picks = new Map<string, OutletPick>();
  const consider = (feed: CatalogFeed, country: CountryCode, allowReplace: boolean) => {
    const meta = countryMeta(country);
    if (!meta) return;
    const key = `${country}|${feed.name.toLowerCase()}`;
    const current = picks.get(key);
    if (current && (!allowReplace || rank(current.feed.category) <= rank(feed.category))) return;
    picks.set(key, { continent: meta.continent, country, name: current?.name ?? feed.name, feed });
  };
  // 원래 그 나라 피드 먼저 → 묶음 지역에서 옮겨 온 매체는 이미 있으면 합친다(건너뜀)
  for (const feed of catalog) if (!REGION_CODES.has(feed.country)) consider(feed, feed.country, true);
  const moved = new Set<string>();
  for (const feed of catalog) {
    if (!REGION_CODES.has(feed.country) || feed.continent === "global") continue;
    const home = HOME_COUNTRY[feed.name.toLowerCase()];
    if (!home) continue;
    const key = `${home}|${feed.name.toLowerCase()}`;
    if (picks.has(key) && !moved.has(key)) continue;
    moved.add(key);
    consider(feed, home, true);
  }
  return [...picks.values()];
}

function toItem(a: Article): FrontItem {
  return { id: a.id, title: a.title, link: a.link, publishedAt: a.publishedAt };
}

const newestFirst = (a: { publishedAt: string | null }, b: { publishedAt: string | null }) =>
  (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "");

/** 피드별 기사(실패한 피드는 results에 없음)를 대륙 → 나라 → 매체로 묶는다 */
export function buildFront(picks: readonly OutletPick[], results: ReadonlyMap<string, Article[]>, perOutlet: number): FrontContinent[] {
  const countries = new Map<CountryCode, FrontCountry & { continent: Continent }>();
  for (const pick of picks) {
    const articles = results.get(pick.feed.id) ?? [];
    const items = articles.filter((a) => a.title).sort(newestFirst).slice(0, perOutlet).map(toItem);
    if (items.length === 0) continue;
    const meta = countryMeta(pick.country);
    if (!meta) continue;
    let country = countries.get(pick.country);
    if (!country) {
      country = { code: pick.country, name: meta.name, timeZone: meta.timeZone, continent: pick.continent, outlets: [] };
      countries.set(pick.country, country);
    }
    country.outlets.push({ name: pick.name, homepage: pick.feed.homepage, language: pick.feed.language, items });
  }
  return NEWSSTAND_CONTINENTS.map((c) => ({
    id: c.id,
    label: c.label,
    countries: [...countries.values()]
      .filter((x) => x.continent === c.id)
      .sort((a, b) => b.outlets.length - a.outlets.length || a.name.localeCompare(b.name, "ko"))
      .map((x) => ({ code: x.code, name: x.name, timeZone: x.timeZone, outlets: x.outlets })),
  })).filter((c) => c.countries.length > 0);
}

/** 그 나라 1면: 매체별 첫 기사 중 가장 최근 것 */
export function leadOf(country: FrontCountry): { outlet: string; item: FrontItem } | null {
  let best: { outlet: string; item: FrontItem } | null = null;
  for (const o of country.outlets) {
    const item = o.items[0];
    if (!item) continue;
    if (!best || (item.publishedAt ?? "") > (best.item.publishedAt ?? "")) best = { outlet: o.name, item };
  }
  return best;
}
