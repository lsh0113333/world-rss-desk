import { describe, expect, it } from "vitest";
import type { Article } from "@/types/article";
import type { Panel } from "@/types/layout";
import { buildFeedsUrl, countNew, feedLabel, isNewArticle, sourceNotes } from "./panel-feed";

const panel = (extra: Partial<Panel> = {}): Panel => ({ id: "p", feedIds: [], customUrls: [], limit: 10, ...extra });

describe("buildFeedsUrl", () => {
  it("joins catalog ids and repeats custom urls", () => {
    const url = buildFeedsUrl(panel({ feedIds: ["kr-yonhap-top", "kr-mk-top"], customUrls: ["https://a.com/rss?x=1,2"], limit: 15 }));
    const parsed = new URL(url!, "http://localhost");
    expect(parsed.pathname).toBe("/api/feeds");
    expect(parsed.searchParams.get("ids")).toBe("kr-yonhap-top,kr-mk-top");
    expect(parsed.searchParams.getAll("urls")).toEqual(["https://a.com/rss?x=1,2"]);
    expect(parsed.searchParams.get("limit")).toBe("15");
    expect(parsed.searchParams.has("fresh")).toBe(false);
  });

  it("adds the keyword query as q", () => {
    const url = buildFeedsUrl(panel({ query: "반도체 수출" }));
    expect(new URL(url!, "http://localhost").searchParams.get("q")).toBe("반도체 수출");
    expect(new URL(url!, "http://localhost").searchParams.has("ids")).toBe(false);
  });

  it("adds fresh=1 for manual refresh", () => {
    expect(buildFeedsUrl(panel({ feedIds: ["kr-yonhap-top"] }), { fresh: true })).toContain("fresh=1");
  });

  it("skips ids that are no longer in the catalog", () => {
    const url = buildFeedsUrl(panel({ feedIds: ["kr-yonhap-top", "cn-globaltimes-top"] }));
    expect(new URL(url!, "http://localhost").searchParams.get("ids")).toBe("kr-yonhap-top");
  });

  it("returns null when the panel has no usable feeds", () => {
    expect(buildFeedsUrl(panel({ feedIds: ["cn-globaltimes-top"] }))).toBeNull();
    expect(buildFeedsUrl(panel())).toBeNull();
  });

  it("is stable for the same panel content (SWR key)", () => {
    const p = panel({ feedIds: ["kr-yonhap-top"] });
    expect(buildFeedsUrl(p)).toBe(buildFeedsUrl({ ...p, lastSeenAt: "2026-10-17T00:00:00Z" }));
  });
});

describe("new article helpers", () => {
  const a = (publishedAt: string | null): Article => ({ id: String(publishedAt), title: "t", link: "https://x", publishedAt, source: "S" });

  it("is never new without lastSeenAt or without a date", () => {
    expect(isNewArticle(a("2026-10-17T10:00:00Z"), undefined)).toBe(false);
    expect(isNewArticle(a(null), "2026-10-17T00:00:00Z")).toBe(false);
  });

  it("is new when published after lastSeenAt", () => {
    expect(isNewArticle(a("2026-10-17T10:00:00Z"), "2026-10-17T09:00:00Z")).toBe(true);
    expect(isNewArticle(a("2026-10-17T08:00:00Z"), "2026-10-17T09:00:00Z")).toBe(false);
  });

  it("countNew counts new articles", () => {
    expect(countNew([a("2026-10-17T10:00:00Z"), a("2026-10-17T08:00:00Z"), a(null)], "2026-10-17T09:00:00Z")).toBe(1);
  });
});

describe("feedLabel / sourceNotes", () => {
  it("labels catalog ids by outlet name and leaves urls as is", () => {
    expect(feedLabel("kr-yonhap-top")).toBe("연합뉴스");
    expect(feedLabel("https://a.com/rss")).toBe("https://a.com/rss");
    expect(feedLabel("q:반도체")).toBe("구글 뉴스 '반도체'");
  });

  it("maps outlet names to their note", () => {
    expect(sourceNotes(panel({ feedIds: ["cn-cgtn-top", "cn-scmp-top"] }))).toEqual({ CGTN: "중국 정부 시각" });
  });
});

describe("panelFeedOptions", () => {
  it("lists the country/category feeds plus selected extras, in catalog order", async () => {
    const { panelFeedOptions } = await import("./panel-feed");
    const { feedsFor } = await import("./catalog");
    const p = panel({ country: "KR", category: "economy", feedIds: ["kr-yonhap-economy", "us-nyt-economy"] });
    const ids = panelFeedOptions(p).map((f) => f.id);
    expect(ids.slice(0, feedsFor("KR", "economy").length)).toEqual(feedsFor("KR", "economy").map((f) => f.id));
    expect(ids).toContain("us-nyt-economy");
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("skips ids no longer in the catalog and works without country", async () => {
    const { panelFeedOptions } = await import("./panel-feed");
    expect(panelFeedOptions(panel({ feedIds: ["kr-yonhap-top", "cn-globaltimes-top"] })).map((f) => f.id)).toEqual(["kr-yonhap-top"]);
  });
});

describe("toggleFeed", () => {
  it("adds or removes an id and respects the maximum", async () => {
    const { toggleFeed } = await import("./panel-feed");
    expect(toggleFeed(["a", "b"], "a", 12)).toEqual(["b"]);
    expect(toggleFeed(["a"], "b", 12)).toEqual(["a", "b"]);
    expect(toggleFeed(["a", "b"], "c", 2)).toEqual(["a", "b"]);
  });
});
