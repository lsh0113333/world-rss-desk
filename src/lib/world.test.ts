import { describe, expect, it } from "vitest";
import { hourlyTrend, isRising, mapScale, storiesForCountry } from "./world";
import type { WorldStory } from "@/types/world";

const NOW = new Date("2026-10-19T12:30:00Z");
const ago = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

describe("hourlyTrend", () => {
  it("최근 N시간을 1시간 칸으로 센다 (오래된 → 최신)", () => {
    const trend = hourlyTrend([ago(0.2), ago(0.5), ago(1.5), ago(5.5), ago(30)], NOW, 6);
    expect(trend).toEqual([1, 0, 0, 0, 1, 2]);
  });
  it("잘못된 날짜는 무시", () => {
    expect(hourlyTrend(["x"], NOW, 3)).toEqual([0, 0, 0]);
  });
});

describe("isRising", () => {
  it("최근 3시간이 직전 3시간의 2배 이상이고 3건 이상이면 급상승", () => {
    expect(isRising([0, 0, 0, 0, 1, 0, 1, 2, 2])).toBe(true);
    expect(isRising([0, 0, 0, 2, 2, 2, 2, 2, 2])).toBe(false);
    expect(isRising([0, 0, 0, 0, 0, 0, 0, 1, 1])).toBe(false);
  });
});

describe("mapScale", () => {
  it("최댓값 대비 0~4 단계 (기사가 없으면 0)", () => {
    const scale = mapScale({ KR: 100, US: 50, JP: 10, FR: 1 });
    expect(scale.KR).toBe(4);
    expect(scale.US).toBeGreaterThanOrEqual(2);
    expect(scale.FR).toBe(1);
    expect(scale.XX ?? 0).toBe(0);
  });
});

describe("storiesForCountry", () => {
  const s = (id: string, countries: string[]) => ({ id, countries }) as WorldStory;
  it("그 나라가 다루는 사건만", () => {
    expect(storiesForCountry([s("a", ["KR", "US"]), s("b", ["JP"])], "KR").map((x) => x.id)).toEqual(["a"]);
    expect(storiesForCountry([s("a", ["KR"])], null)).toHaveLength(1);
  });
});
