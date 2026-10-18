import { describe, expect, it } from "vitest";
import type { StoryItem } from "@/types/insights";
import { findMentions, matchKeywords, MAX_WATCH_KEYWORDS, normalizeKeywords } from "./watch";

const item = (id: string, title: string, publishedAt: string | null = null): StoryItem => ({
  article: { id, title, link: `https://example.com/${id}`, publishedAt, source: "S" },
  panelId: "p",
});

describe("normalizeKeywords", () => {
  it("trims, drops empties and case-insensitive duplicates", () => {
    expect(normalizeKeywords([" 반도체 ", "", "Iran", "iran", "  "])).toEqual(["반도체", "Iran"]);
  });

  it("caps the count and the length", () => {
    const many = Array.from({ length: 30 }, (_, i) => `k${i}`);
    expect(normalizeKeywords(many)).toHaveLength(MAX_WATCH_KEYWORDS);
    expect(normalizeKeywords(["x".repeat(60)])[0]).toHaveLength(40);
  });
});

describe("matchKeywords", () => {
  it("returns the keywords found in the title, ignoring case", () => {
    expect(matchKeywords("IRAN closes Hormuz; 반도체 수출 급감", ["iran", "반도체", "환율"])).toEqual(["iran", "반도체"]);
  });

  it("matches English keywords as whole words only", () => {
    expect(matchKeywords("Trump waives sanctions in campaign", ["AI"])).toEqual([]);
    expect(matchKeywords("New AI rules; AI-powered tools", ["ai"])).toEqual(["ai"]);
    expect(matchKeywords("Iran's navy", ["Iran"])).toEqual(["Iran"]);
  });

  it("matches Korean keywords inside words so particles do not break them", () => {
    expect(matchKeywords("반도체가 살아난다", ["반도체"])).toEqual(["반도체"]);
  });

  it("returns nothing without keywords", () => {
    expect(matchKeywords("anything", [])).toEqual([]);
  });
});

describe("findMentions", () => {
  it("lists matching articles once, newest first, with unread count", () => {
    const a = item("a", "Iran talks", "2026-10-18T01:00:00Z");
    const b = item("b", "Hormuz and Iran", "2026-10-18T03:00:00Z");
    const c = item("c", "Weather", "2026-10-18T04:00:00Z");
    const dup = { ...a, panelId: "q" };
    const result = findMentions([a, b, c, dup], ["iran"], new Set(["a"]));
    expect(result.items.map((i) => i.article.id)).toEqual(["b", "a"]);
    expect(result.unread).toBe(1);
  });
});

describe("highlightParts", () => {
  it("splits a title into plain and matched parts, ignoring case", async () => {
    const { highlightParts } = await import("./watch");
    expect(highlightParts("Iran and IRAN talks", ["iran"])).toEqual([
      { text: "Iran", hit: true },
      { text: " and ", hit: false },
      { text: "IRAN", hit: true },
      { text: " talks", hit: false },
    ]);
  });

  it("returns the whole text when nothing matches", async () => {
    const { highlightParts } = await import("./watch");
    expect(highlightParts("Weather", ["iran"])).toEqual([{ text: "Weather", hit: false }]);
    expect(highlightParts("Weather", [])).toEqual([{ text: "Weather", hit: false }]);
  });

  it("highlights whole English words only", async () => {
    const { highlightParts } = await import("./watch");
    expect(highlightParts("AI waives", ["ai"])).toEqual([{ text: "AI", hit: true }, { text: " waives", hit: false }]);
  });

  it("treats regex characters in keywords literally", async () => {
    const { highlightParts } = await import("./watch");
    expect(highlightParts("C++ (lang)", ["c++"])).toEqual([{ text: "C++", hit: true }, { text: " (lang)", hit: false }]);
  });
});
