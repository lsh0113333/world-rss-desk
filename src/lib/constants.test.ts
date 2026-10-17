import { describe, expect, it } from "vitest";
import {
  CATEGORIES,
  CONTINENTS,
  COUNTRIES,
  countriesByContinent,
  getCategory,
  getCountry,
  panelTitle,
} from "./constants";

describe("CONTINENTS", () => {
  it("includes every continent with a Korean label", () => {
    expect(CONTINENTS.map((c) => c.id)).toEqual([
      "asia",
      "europe",
      "north-america",
      "south-america",
      "middle-east",
      "africa",
      "oceania",
      "global",
    ]);
    for (const c of CONTINENTS) expect(c.label).not.toBe("");
  });
});

describe("CATEGORIES", () => {
  it("has the six fixed categories in display order", () => {
    expect(CATEGORIES.map((c) => c.id)).toEqual([
      "top",
      "world",
      "politics",
      "economy",
      "tech",
      "science",
    ]);
  });

  it("getCategory returns the Korean label", () => {
    expect(getCategory("economy").label).toBe("경제");
    expect(getCategory("tech").label).toBe("IT");
  });
});

describe("COUNTRIES", () => {
  it("covers the confirmed target countries", () => {
    const codes = COUNTRIES.map((c) => c.code);
    for (const code of ["KR", "JP", "CN", "IN", "US", "GB", "DE", "FR", "EU", "ME", "BR", "AU", "WORLD"]) {
      expect(codes).toContain(code);
    }
  });

  it("has unique codes and a valid continent for each country", () => {
    const codes = COUNTRIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
    const continentIds = CONTINENTS.map((c) => c.id);
    for (const c of COUNTRIES) {
      expect(continentIds).toContain(c.continent);
      expect(c.name).not.toBe("");
      expect(c.flag).not.toBe("");
    }
  });

  it("getCountry finds by code and returns undefined for unknown codes", () => {
    expect(getCountry("KR")?.name).toBe("한국");
    expect(getCountry("ZZ")).toBeUndefined();
  });

  it("countriesByContinent filters by continent", () => {
    const asia = countriesByContinent("asia").map((c) => c.code);
    expect(asia).toEqual(expect.arrayContaining(["KR", "JP", "CN", "IN"]));
    expect(asia).not.toContain("US");
  });
});

describe("panelTitle", () => {
  it("joins flag, country name and category label", () => {
    expect(panelTitle("KR", "economy")).toBe("🇰🇷 한국 · 경제");
  });

  it("omits the missing part", () => {
    expect(panelTitle("US")).toBe("🇺🇸 미국");
    expect(panelTitle(undefined, "tech")).toBe("IT");
  });

  it("falls back to a generic title", () => {
    expect(panelTitle()).toBe("사용자 패널");
    expect(panelTitle("ZZ")).toBe("ZZ");
  });
});
