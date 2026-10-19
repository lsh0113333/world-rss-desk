import { describe, expect, it } from "vitest";
import { COUNTRIES } from "./constants";
import { MAP_COLS, MAP_ROWS, REGION_CODES, TILE_POSITIONS } from "./world-map";

describe("TILE_POSITIONS", () => {
  it("지역 단위가 아닌 모든 나라가 지도에 있다", () => {
    const missing = COUNTRIES.map((c) => c.code).filter((code) => !REGION_CODES.includes(code) && !TILE_POSITIONS[code]);
    expect(missing).toEqual([]);
  });

  it("칸이 겹치지 않고 격자 안에 있다", () => {
    const cells = Object.values(TILE_POSITIONS).map(([c, r]) => `${c},${r}`);
    expect(new Set(cells).size).toBe(cells.length);
    for (const [c, r] of Object.values(TILE_POSITIONS)) {
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThan(MAP_COLS);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(MAP_ROWS);
    }
  });

  it("지도에 있는 나라는 모두 나라 목록에 있다", () => {
    const known = new Set(COUNTRIES.map((c) => c.code));
    expect(Object.keys(TILE_POSITIONS).filter((c) => !known.has(c))).toEqual([]);
  });
});
