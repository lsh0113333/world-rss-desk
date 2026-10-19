import type { CountryCode } from "@/types/catalog";

/**
 * 타일 지도: 나라 하나 = 같은 크기 칸 하나, 실제 위치를 대략 따른 격자 (작은 나라도 보이게).
 * [열, 행], 18열 × 9행. 지역 단위(EU·ME·ASIA·LATAM·AFRICA·WORLD)는 지도 밖 칩으로 보여 준다.
 */
export const MAP_COLS = 18;
export const MAP_ROWS = 9;

export const TILE_POSITIONS: Readonly<Record<CountryCode, readonly [number, number]>> = {
  IS: [6, 0], NO: [8, 0], SE: [9, 0], FI: [10, 0],
  CA: [1, 1], IE: [6, 1], GB: [7, 1], DK: [8, 1], EE: [10, 1], RU: [12, 1],
  US: [1, 2], NL: [7, 2], DE: [8, 2], PL: [9, 2], LT: [10, 2], UA: [11, 2], CN: [15, 2], KR: [16, 2], JP: [17, 2],
  MX: [1, 3], PT: [6, 3], FR: [7, 3], CH: [8, 3], AT: [9, 3], CZ: [10, 3], HU: [11, 3], TW: [16, 3],
  ES: [7, 4], IT: [8, 4], GR: [10, 4], TR: [11, 4], IR: [13, 4], IN: [14, 4], VN: [15, 4], PH: [16, 4],
  BR: [2, 5], EG: [9, 5], IL: [11, 5], SA: [12, 5], QA: [13, 5], TH: [14, 5],
  AR: [2, 6], NG: [8, 6], KE: [10, 6], AE: [13, 6], SG: [15, 6],
  ZA: [9, 7], AU: [16, 7],
  NZ: [17, 8],
};

export const REGION_CODES: readonly CountryCode[] = ["WORLD", "EU", "ME", "ASIA", "LATAM", "AFRICA"];
