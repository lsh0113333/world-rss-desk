import type { Category, Continent, CountryCode } from "@/types/catalog";

export interface ContinentMeta {
  id: Continent;
  label: string;
}

export interface CategoryMeta {
  id: Category;
  label: string;
}

export interface CountryMeta {
  code: CountryCode;
  name: string;
  flag: string;
  continent: Continent;
}

export const CONTINENTS: readonly ContinentMeta[] = [
  { id: "asia", label: "아시아" },
  { id: "europe", label: "유럽" },
  { id: "north-america", label: "북미" },
  { id: "south-america", label: "남미" },
  { id: "middle-east", label: "중동" },
  { id: "africa", label: "아프리카" },
  { id: "oceania", label: "오세아니아" },
  { id: "global", label: "국제" },
];

export const CATEGORIES: readonly CategoryMeta[] = [
  { id: "top", label: "종합" },
  { id: "world", label: "국제" },
  { id: "politics", label: "정치" },
  { id: "economy", label: "경제" },
  { id: "tech", label: "IT" },
  { id: "science", label: "과학" },
];

export const COUNTRIES: readonly CountryMeta[] = [
  { code: "KR", name: "한국", flag: "🇰🇷", continent: "asia" },
  { code: "JP", name: "일본", flag: "🇯🇵", continent: "asia" },
  { code: "CN", name: "중국", flag: "🇨🇳", continent: "asia" },
  { code: "IN", name: "인도", flag: "🇮🇳", continent: "asia" },
  { code: "US", name: "미국", flag: "🇺🇸", continent: "north-america" },
  { code: "GB", name: "영국", flag: "🇬🇧", continent: "europe" },
  { code: "DE", name: "독일", flag: "🇩🇪", continent: "europe" },
  { code: "FR", name: "프랑스", flag: "🇫🇷", continent: "europe" },
  { code: "EU", name: "유럽", flag: "🇪🇺", continent: "europe" },
  { code: "ME", name: "중동", flag: "🌍", continent: "middle-east" },
  { code: "BR", name: "브라질", flag: "🇧🇷", continent: "south-america" },
  { code: "AU", name: "호주", flag: "🇦🇺", continent: "oceania" },
  { code: "WORLD", name: "국제", flag: "🌐", continent: "global" },
];

export function getCategory(id: Category): CategoryMeta {
  const found = CATEGORIES.find((c) => c.id === id);
  if (!found) throw new Error(`Unknown category: ${id}`);
  return found;
}

export function getCountry(code: CountryCode): CountryMeta | undefined {
  return COUNTRIES.find((c) => c.code === code);
}

export function countriesByContinent(continent: Continent): CountryMeta[] {
  return COUNTRIES.filter((c) => c.continent === continent);
}

/** "🇰🇷 한국 · 경제" 형식의 패널 기본 제목 */
export function panelTitle(country?: CountryCode, category?: Category): string {
  const parts: string[] = [];
  if (country) {
    const meta = getCountry(country);
    parts.push(meta ? `${meta.flag} ${meta.name}` : country);
  }
  if (category) parts.push(getCategory(category).label);
  return parts.length > 0 ? parts.join(" · ") : "사용자 패널";
}
