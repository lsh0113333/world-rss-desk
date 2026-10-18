// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { FeedFetchError } from "@/lib/errors";
import type { CatalogFeed } from "@/types/catalog";
import { checkFeeds } from "./feed-health";

const now = new Date("2026-10-18T12:00:00Z");
const feed = (id: string): CatalogFeed => ({ id, name: id.toUpperCase(), url: `https://${id}.example.com/rss`, homepage: `https://${id}.example.com`, continent: "global", country: "WORLD", category: "world", language: "en" });
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();

describe("checkFeeds", () => {
  it("sorts feeds into ok, stale and failed", async () => {
    const load = vi.fn(async (url: string) => {
      if (url.includes("bad")) throw new FeedFetchError("HTTP 404");
      if (url.includes("empty")) return { title: null, articles: [] };
      const publishedAt = url.includes("old") ? hoursAgo(100) : hoursAgo(1);
      return { title: null, articles: [{ id: "1", title: "t", link: "https://x", publishedAt, source: "S" }] };
    });
    const report = await checkFeeds([feed("good"), feed("old"), feed("bad"), feed("empty")], { load, now, concurrency: 2 });
    expect(report.total).toBe(4);
    expect(report.ok).toBe(1);
    expect(report.checkedAt).toBe(now.toISOString());
    expect(report.stale).toEqual([{ id: "old", name: "OLD", detail: "최신 기사 100시간 전" }]);
    expect(report.failed).toEqual([
      { id: "bad", name: "BAD", detail: "HTTP 404" },
      { id: "empty", name: "EMPTY", detail: "기사 0개" },
    ]);
  });

  it("treats feeds without any dated article as stale", async () => {
    const load = vi.fn(async () => ({ title: null, articles: [{ id: "1", title: "t", link: "https://x", publishedAt: null, source: "S" }] }));
    const report = await checkFeeds([feed("nodate")], { load, now });
    expect(report.stale).toEqual([{ id: "nodate", name: "NODATE", detail: "날짜 없음" }]);
  });
});
