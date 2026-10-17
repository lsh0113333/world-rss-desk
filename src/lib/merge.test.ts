import { describe, expect, it } from "vitest";
import type { Article } from "@/types/article";
import { mergeArticles, normalizeLink } from "./merge";

const now = new Date("2026-10-17T12:00:00Z");

function article(link: string, publishedAt: string | null, extra: Partial<Article> = {}): Article {
  return { id: link, title: link, link, publishedAt, source: "S", ...extra };
}

describe("normalizeLink", () => {
  it("removes utm_* and fragment, keeps other params", () => {
    expect(normalizeLink("https://Example.com/a?utm_source=rss&id=1&utm_medium=x#top")).toBe("https://example.com/a?id=1");
  });

  it("ignores trailing slash and http vs https", () => {
    expect(normalizeLink("http://example.com/a/")).toBe(normalizeLink("https://example.com/a"));
  });

  it("returns the input when it is not a valid URL", () => {
    expect(normalizeLink("not a url")).toBe("not a url");
  });
});

describe("mergeArticles", () => {
  it("merges lists and sorts by publishedAt descending with nulls last", () => {
    const merged = mergeArticles(
      [
        [article("https://a.com/1", "2026-10-17T10:00:00Z"), article("https://a.com/2", null)],
        [article("https://b.com/1", "2026-10-17T11:00:00Z")],
      ],
      { now },
    );
    expect(merged.map((a) => a.link)).toEqual(["https://b.com/1", "https://a.com/1", "https://a.com/2"]);
  });

  it("removes duplicates by normalized link, keeping the first occurrence", () => {
    const merged = mergeArticles(
      [
        [article("https://a.com/1?utm_source=x", "2026-10-17T10:00:00Z", { source: "First" })],
        [article("https://a.com/1", "2026-10-17T10:00:00Z", { source: "Second" })],
      ],
      { now },
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].source).toBe("First");
  });

  it("drops articles older than maxAgeHours but keeps undated ones", () => {
    const merged = mergeArticles(
      [[article("https://a.com/old", "2026-10-14T11:00:00Z"), article("https://a.com/new", "2026-10-15T13:00:00Z"), article("https://a.com/nodate", null)]],
      { now, maxAgeHours: 72 },
    );
    expect(merged.map((a) => a.link)).toEqual(["https://a.com/new", "https://a.com/nodate"]);
  });

  it("applies the limit after sorting", () => {
    const list = [1, 2, 3, 4, 5].map((h) => article(`https://a.com/${h}`, `2026-10-17T0${h}:00:00Z`));
    expect(mergeArticles([list], { now, limit: 2 }).map((a) => a.link)).toEqual(["https://a.com/5", "https://a.com/4"]);
  });

  it("defaults to limit 10 and 72 hours", () => {
    const list = Array.from({ length: 15 }, (_, i) => article(`https://a.com/${i}`, "2026-10-17T00:00:00Z"));
    expect(mergeArticles([list], { now })).toHaveLength(10);
  });
});
