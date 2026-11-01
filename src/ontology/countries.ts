import type { Continent } from "@/types/catalog";

/**
 * 나라 → 대륙 (ISO 3166-1 alpha-2). 사건은 매체가 없는 나라(요르단, 베네수엘라 등)에서도 일어나므로 카탈로그보다 넓다.
 * 대륙 구분은 이 서비스의 7개 기준: 중동을 따로 두고, 중미·카리브는 중남미에 넣는다.
 */
export const CONTINENTS: readonly { id: Exclude<Continent, "global">; label: string }[] = [
  { id: "asia", label: "아시아" },
  { id: "europe", label: "유럽" },
  { id: "north-america", label: "북미" },
  { id: "south-america", label: "중남미" },
  { id: "middle-east", label: "중동" },
  { id: "africa", label: "아프리카" },
  { id: "oceania", label: "오세아니아" },
];

const BY_CONTINENT: Record<Exclude<Continent, "global">, string> = {
  asia: "AF AM AZ BD BN BT CN GE HK ID IN JP KG KH KP KR KZ LA LK MM MN MO MV MY NP PH PK SG TH TJ TL TM TW UZ VN",
  europe: "AD AL AT BA BE BG BY CH CY CZ DE DK EE ES FI FR GB GR HR HU IE IS IT LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS RU SE SI SK SM TR UA VA XK",
  "north-america": "BM CA GL US",
  "south-america": "AR BB BO BR BS BZ CL CO CR CU DO EC GT GY HN HT JM MX NI PA PE PR PY SR SV TT UY VE",
  "middle-east": "AE BH IL IQ IR JO KW LB OM PS QA SA SY YE",
  africa: "AO BF BI BJ BW CD CF CG CI CM CV DJ DZ EG ER ET GA GH GM GN GQ GW KE KM LR LS LY MA MG ML MR MU MW MZ NA NE NG RW SC SD SL SN SO SS ST SZ TD TG TN TZ UG ZA ZM ZW",
  oceania: "AU FJ FM KI MH NR NZ PG PW SB TO TV VU WS",
};

const CONTINENT_OF = new Map<string, Continent>(
  Object.entries(BY_CONTINENT).flatMap(([continent, codes]) => codes.split(" ").map((code) => [code, continent as Continent] as const)),
);

const NAME_OVERRIDES: Record<string, string> = { KR: "한국", PS: "팔레스타인", HK: "홍콩", MO: "마카오", XK: "코소보" };
const names = new Intl.DisplayNames(["ko"], { type: "region" });

export function continentOfCountry(code: string): Continent | undefined {
  return CONTINENT_OF.get(code);
}

export function isKnownCountry(code: string): boolean {
  return CONTINENT_OF.has(code);
}

export function countryName(code: string): string {
  return NAME_OVERRIDES[code] ?? names.of(code) ?? code;
}

export function allCountryCodes(): string[] {
  return [...CONTINENT_OF.keys()];
}
