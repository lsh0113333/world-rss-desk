import { describe, expect, it } from "vitest";
import type { Article } from "@/types/article";
import type { StoryItem } from "@/types/insights";
import { clusterIndex, clusterStories } from "./story-cluster";

let seq = 0;
function item(title: string, source: string, country = "US", extra: Partial<Article> = {}, panelId = "p1"): StoryItem {
  seq += 1;
  return {
    article: { id: `a${seq}`, title, link: `https://${source.toLowerCase().replace(/\s/g, "")}.example.com/${seq}`, publishedAt: null, source, ...extra },
    panelId,
    country,
  };
}

describe("clusterStories", () => {
  it("groups headlines about the same story from different outlets", () => {
    const a = item("Iran closes Strait of Hormuz to tankers", "BBC", "GB");
    const b = item("Tankers halted as Iran shuts Hormuz strait", "Al Jazeera", "ME");
    const c = item("Nvidia posts record quarterly results", "CNBC", "US");
    const clusters = clusterStories([a, b, c]);
    expect(clusters).toHaveLength(2);
    expect(clusters[0].items.map((i) => i.article.id)).toEqual([a.article.id, b.article.id]);
    expect(clusters[0].sources).toEqual(["BBC", "Al Jazeera"]);
    expect(clusters[0].countries).toEqual(["GB", "ME"]);
    expect(clusters[1].items).toEqual([c]);
  });

  it("does not merge headlines sharing only one keyword", () => {
    const clusters = clusterStories([item("Iran election turnout falls", "BBC"), item("Iran football team wins cup", "ESPN")]);
    expect(clusters).toHaveLength(2);
  });

  it("merges the same link even when titles differ", () => {
    const a = item("Markets rally", "Reuters", "US", { link: "https://x.example.com/a?utm_source=rss" });
    const b = item("Stocks jump on rate hopes", "Reuters", "US", { link: "https://x.example.com/a" });
    expect(clusterStories([a, b])).toHaveLength(1);
  });

  it("keeps the first item as the leader and orders the rest newest first", () => {
    const a = item("Hormuz strait closed by Iran", "BBC", "GB", { publishedAt: "2026-10-18T01:00:00Z" });
    const b = item("Iran Hormuz strait closure deepens", "CNN", "US", { publishedAt: "2026-10-18T02:00:00Z" });
    const c = item("Hormuz strait: Iran closure explained", "NPR", "US", { publishedAt: "2026-10-18T05:00:00Z" });
    const [cluster] = clusterStories([a, b, c]);
    expect(cluster.items.map((i) => i.article.source)).toEqual(["BBC", "NPR", "CNN"]);
    expect(cluster.countries).toEqual(["GB", "US"]);
  });

  it("indexes clusters by article id", () => {
    const a = item("Hormuz strait closed by Iran", "BBC");
    const b = item("Iran Hormuz strait closure deepens", "CNN");
    const index = clusterIndex(clusterStories([a, b]));
    expect(index.get(a.article.id)).toBe(index.get(b.article.id));
  });
});

describe("dedupeByCluster", () => {
  it("keeps the first article of each story and counts the other outlets", async () => {
    const { dedupeByCluster } = await import("./story-cluster");
    const a = item("Hormuz strait closed by Iran", "BBC", "GB");
    const b = item("Iran Hormuz strait closure deepens", "CNN", "US");
    const c = item("Iran Hormuz strait closure, explained", "NPR", "US");
    const d = item("Nvidia record results", "CNBC", "US");
    const index = clusterIndex(clusterStories([a, b, c, d]));
    const { articles, alsoIn } = dedupeByCluster([b.article, a.article, d.article], index);
    expect(articles.map((x) => x.id)).toEqual([b.article.id, d.article.id]);
    expect(alsoIn[b.article.id]).toBe(2);
    expect(alsoIn[d.article.id]).toBeUndefined();
  });

  it("returns the input unchanged without an index", async () => {
    const { dedupeByCluster } = await import("./story-cluster");
    const a = item("x y z", "S");
    expect(dedupeByCluster([a.article], undefined)).toEqual({ articles: [a.article], alsoIn: {} });
  });
});
