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
  { id: "south-america", label: "중남미" },
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
  { id: "society", label: "사회" },
  { id: "tech", label: "IT" },
  { id: "science", label: "과학" },
  { id: "health", label: "건강" },
  { id: "environment", label: "환경·기후" },
  { id: "culture", label: "문화·연예" },
  { id: "sports", label: "스포츠" },
];

export const COUNTRIES: readonly CountryMeta[] = [
  { code: "KR", name: "한국", flag: "🇰🇷", continent: "asia" },
  { code: "JP", name: "일본", flag: "🇯🇵", continent: "asia" },
  { code: "CN", name: "중국", flag: "🇨🇳", continent: "asia" },
  { code: "IN", name: "인도", flag: "🇮🇳", continent: "asia" },
  { code: "VN", name: "베트남", flag: "🇻🇳", continent: "asia" },
  { code: "SG", name: "싱가포르", flag: "🇸🇬", continent: "asia" },
  { code: "TW", name: "대만", flag: "🇹🇼", continent: "asia" },
  { code: "PH", name: "필리핀", flag: "🇵🇭", continent: "asia" },
  { code: "TH", name: "태국", flag: "🇹🇭", continent: "asia" },
  { code: "ASIA", name: "아시아", flag: "🌏", continent: "asia" },
  { code: "US", name: "미국", flag: "🇺🇸", continent: "north-america" },
  { code: "CA", name: "캐나다", flag: "🇨🇦", continent: "north-america" },
  { code: "GB", name: "영국", flag: "🇬🇧", continent: "europe" },
  { code: "DE", name: "독일", flag: "🇩🇪", continent: "europe" },
  { code: "FR", name: "프랑스", flag: "🇫🇷", continent: "europe" },
  { code: "ES", name: "스페인", flag: "🇪🇸", continent: "europe" },
  { code: "IT", name: "이탈리아", flag: "🇮🇹", continent: "europe" },
  { code: "UA", name: "우크라이나", flag: "🇺🇦", continent: "europe" },
  { code: "RU", name: "러시아", flag: "🇷🇺", continent: "europe" },
  { code: "TR", name: "튀르키예", flag: "🇹🇷", continent: "europe" },
  { code: "IE", name: "아일랜드", flag: "🇮🇪", continent: "europe" },
  { code: "NL", name: "네덜란드", flag: "🇳🇱", continent: "europe" },
  { code: "CH", name: "스위스", flag: "🇨🇭", continent: "europe" },
  { code: "AT", name: "오스트리아", flag: "🇦🇹", continent: "europe" },
  { code: "PT", name: "포르투갈", flag: "🇵🇹", continent: "europe" },
  { code: "GR", name: "그리스", flag: "🇬🇷", continent: "europe" },
  { code: "NO", name: "노르웨이", flag: "🇳🇴", continent: "europe" },
  { code: "SE", name: "스웨덴", flag: "🇸🇪", continent: "europe" },
  { code: "DK", name: "덴마크", flag: "🇩🇰", continent: "europe" },
  { code: "FI", name: "핀란드", flag: "🇫🇮", continent: "europe" },
  { code: "IS", name: "아이슬란드", flag: "🇮🇸", continent: "europe" },
  { code: "PL", name: "폴란드", flag: "🇵🇱", continent: "europe" },
  { code: "CZ", name: "체코", flag: "🇨🇿", continent: "europe" },
  { code: "HU", name: "헝가리", flag: "🇭🇺", continent: "europe" },
  { code: "EE", name: "에스토니아", flag: "🇪🇪", continent: "europe" },
  { code: "LT", name: "리투아니아", flag: "🇱🇹", continent: "europe" },
  { code: "EU", name: "유럽", flag: "🇪🇺", continent: "europe" },
  { code: "ME", name: "중동", flag: "🌍", continent: "middle-east" },
  { code: "IL", name: "이스라엘", flag: "🇮🇱", continent: "middle-east" },
  { code: "IR", name: "이란", flag: "🇮🇷", continent: "middle-east" },
  { code: "AE", name: "아랍에미리트", flag: "🇦🇪", continent: "middle-east" },
  { code: "SA", name: "사우디아라비아", flag: "🇸🇦", continent: "middle-east" },
  { code: "QA", name: "카타르", flag: "🇶🇦", continent: "middle-east" },
  { code: "BH", name: "바레인", flag: "🇧🇭", continent: "middle-east" },
  { code: "BR", name: "브라질", flag: "🇧🇷", continent: "south-america" },
  { code: "MX", name: "멕시코", flag: "🇲🇽", continent: "south-america" },
  { code: "AR", name: "아르헨티나", flag: "🇦🇷", continent: "south-america" },
  { code: "LATAM", name: "중남미", flag: "🌎", continent: "south-america" },
  { code: "ZA", name: "남아공", flag: "🇿🇦", continent: "africa" },
  { code: "NG", name: "나이지리아", flag: "🇳🇬", continent: "africa" },
  { code: "KE", name: "케냐", flag: "🇰🇪", continent: "africa" },
  { code: "EG", name: "이집트", flag: "🇪🇬", continent: "africa" },
  { code: "AFRICA", name: "아프리카", flag: "🌍", continent: "africa" },
  { code: "AU", name: "호주", flag: "🇦🇺", continent: "oceania" },
  { code: "NZ", name: "뉴질랜드", flag: "🇳🇿", continent: "oceania" },
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
  const label = category ? getCategory(category).label : undefined;
  // 'WORLD · world'처럼 나라명과 분야명이 같으면 한 번만 ("🌐 국제")
  if (label && !(country && getCountry(country)?.name === label)) parts.push(label);
  return parts.length > 0 ? parts.join(" · ") : "사용자 패널";
}
