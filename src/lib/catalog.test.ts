import { describe, expect, it } from "vitest";
import {
  CATALOG,
  categoriesForCountry,
  feedsByCountry,
  feedsFor,
  getFeedById,
} from "./catalog";
import { CATEGORIES, COUNTRIES, getCountry } from "./constants";

describe("catalog schema", () => {
  it("is not empty", () => {
    expect(CATALOG.length).toBeGreaterThan(30);
  });

  it("has unique, kebab-case ids", () => {
    const ids = CATALOG.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)+$/);
  });

  it("has unique feed urls", () => {
    const urls = CATALOG.map((f) => f.url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("uses http(s) urls for feed and homepage", () => {
    for (const f of CATALOG) {
      expect(["http:", "https:"], f.id).toContain(new URL(f.url).protocol);
      expect(["http:", "https:"], f.id).toContain(new URL(f.homepage).protocol);
    }
  });

  it("references known countries with a matching continent", () => {
    for (const f of CATALOG) {
      const country = getCountry(f.country);
      expect(country, f.id).toBeDefined();
      expect(f.continent, f.id).toBe(country?.continent);
    }
  });

  it("references known categories and has name and language", () => {
    const categoryIds = CATEGORIES.map((c) => c.id);
    for (const f of CATALOG) {
      expect(categoryIds, f.id).toContain(f.category);
      expect(f.name, f.id).not.toBe("");
      expect(f.language, f.id).toMatch(/^[a-z]{2}$/);
    }
  });
});

describe("catalog coverage", () => {
  it("has a top feed for every country (world feed for WORLD)", () => {
    for (const { code } of COUNTRIES) {
      const required = code === "WORLD" ? "world" : "top";
      expect(feedsFor(code, required).length, code).toBeGreaterThan(0);
    }
  });

  it("has an economy feed for the major countries", () => {
    for (const code of ["KR", "US", "JP", "CN", "GB"]) {
      expect(feedsFor(code, "economy").length, code).toBeGreaterThan(0);
    }
  });

  it("marks Chinese state media with a note", () => {
    const stateMedia = CATALOG.filter((f) => /cgtn|globaltimes/.test(f.id));
    expect(stateMedia.length).toBeGreaterThan(0);
    for (const f of stateMedia) expect(f.note, f.id).toBe("중국 정부 시각");
  });
});

describe("catalog queries", () => {
  it("getFeedById finds a feed or returns undefined", () => {
    const first = CATALOG[0];
    expect(getFeedById(first.id)).toBe(first);
    expect(getFeedById("no-such-feed")).toBeUndefined();
  });

  it("feedsByCountry returns only that country's feeds", () => {
    const kr = feedsByCountry("KR");
    expect(kr.length).toBeGreaterThan(0);
    expect(kr.every((f) => f.country === "KR")).toBe(true);
  });

  it("feedsFor filters by country and category, each optional", () => {
    expect(feedsFor("KR", "economy").every((f) => f.country === "KR" && f.category === "economy")).toBe(true);
    expect(feedsFor(undefined, "tech").every((f) => f.category === "tech")).toBe(true);
    expect(feedsFor("KR")).toEqual(feedsByCountry("KR"));
    expect(feedsFor()).toEqual([...CATALOG]);
  });

  it("categoriesForCountry lists available categories in display order", () => {
    const cats = categoriesForCountry("KR");
    expect(cats[0]).toBe("top");
    const order = CATEGORIES.map((c) => c.id);
    expect([...cats].sort((a, b) => order.indexOf(a) - order.indexOf(b))).toEqual(cats);
    expect(categoriesForCountry("ZZ")).toEqual([]);
  });
});
