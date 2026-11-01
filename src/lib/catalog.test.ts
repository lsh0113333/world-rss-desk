import { describe, expect, it } from "vitest";
import { baseCountry } from "@/ontology/outlets";
import { CATALOG } from "./catalog";
import { CONTINENTS } from "./constants";

const CATEGORIES = ["top", "world", "politics", "economy", "society", "tech", "science", "health", "environment", "culture", "sports"];

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

  it("references known continents, and outlets map to a known home country", () => {
    const continents = CONTINENTS.map((c) => c.id);
    for (const f of CATALOG) {
      expect(continents, f.id).toContain(f.continent);
      if (!["UN News", "AllAfrica"].includes(f.name)) expect(baseCountry(f), f.id).not.toBeNull();
    }
  });

  it("references known categories and has name and language", () => {
    for (const f of CATALOG) {
      expect(CATEGORIES, f.id).toContain(f.category);
      expect(f.name, f.id).not.toBe("");
      expect(f.language, f.id).toMatch(/^[a-z]{2}$/);
    }
  });
});

describe("catalog notes", () => {
  it("marks Chinese state media with a note", () => {
    const stateMedia = CATALOG.filter((f) => /cgtn|globaltimes/.test(f.id));
    expect(stateMedia.length).toBeGreaterThan(0);
    for (const f of stateMedia) expect(f.note, f.id).toBe("중국 정부 시각");
  });
});
