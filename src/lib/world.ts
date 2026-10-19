import type { CountryCode } from "@/types/catalog";
import type { WorldStory } from "@/types/world";

/** 세계 흐름 화면의 순수 계산 (추세·급상승·지도 단계) */

const HOUR = 3_600_000;
export const TREND_HOURS = 12;

/** 최근 hours시간의 시간대별 기사 수. 오래된 칸 → 최신 칸 */
export function hourlyTrend(dates: string[], now: Date, hours = TREND_HOURS): number[] {
  const counts = new Array<number>(hours).fill(0);
  for (const d of dates) {
    const age = now.getTime() - Date.parse(d);
    if (Number.isNaN(age) || age < 0) continue;
    const slot = Math.floor(age / HOUR);
    if (slot < hours) counts[hours - 1 - slot]++;
  }
  return counts;
}

/** 최근 3시간 기사가 3건 이상이고 직전 3시간의 2배 이상 */
export function isRising(trend: number[]): boolean {
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const recent = sum(trend.slice(-3));
  const before = sum(trend.slice(-6, -3));
  return recent >= 3 && recent >= before * 2;
}

/** 지도 색 단계 0~4: 최댓값 대비 제곱근 비율 (작은 나라도 보이게) */
export function mapScale(counts: Record<CountryCode, number>): Record<CountryCode, number> {
  const max = Math.max(0, ...Object.values(counts));
  const out: Record<CountryCode, number> = {};
  for (const [code, n] of Object.entries(counts)) {
    out[code] = n <= 0 || max === 0 ? 0 : Math.max(1, Math.ceil(Math.sqrt(n / max) * 4));
  }
  return out;
}

export function storiesForCountry(stories: WorldStory[], country: CountryCode | null): WorldStory[] {
  return country ? stories.filter((s) => s.countries.includes(country)) : stories;
}
