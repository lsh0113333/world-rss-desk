// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { discoverFeeds } from "./discover";

const rss = (title: string, n = 2) =>
  `<rss><channel><title>${title}</title>${Array.from({ length: n }, (_, i) => `<item><title>t${i}</title><link>https://x.com/${i}</link></item>`).join("")}</channel></rss>`;

function fakeFetch(routes: Record<string, () => Response>) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const make = routes[String(input)];
    return make ? make() : new Response("not found", { status: 404 });
  }) as unknown as typeof fetch;
}

const html = (body: string) => new Response(body, { headers: { "content-type": "text/html" } });
const xml = (body: string) => new Response(body, { headers: { "content-type": "application/rss+xml" } });

describe("discoverFeeds", () => {
  it("returns the input itself when it already is a feed", async () => {
    const fetchImpl = fakeFetch({ "https://blog.example.com/feed.xml": () => xml(rss("Blog", 3)) });
    expect(await discoverFeeds("blog.example.com/feed.xml", { fetchImpl })).toEqual({
      feeds: [{ url: "https://blog.example.com/feed.xml", title: "Blog", articleCount: 3 }],
    });
  });

  it("finds feeds linked from the page and keeps only ones that parse", async () => {
    const fetchImpl = fakeFetch({
      "https://news.example.com/": () =>
        html(`<link rel="alternate" type="application/rss+xml" title="Top" href="/top.xml"><link rel="alternate" type="application/rss+xml" href="/broken.xml">`),
      "https://news.example.com/top.xml": () => xml(rss("Top stories")),
      "https://news.example.com/broken.xml": () => html("<html>nope</html>"),
    });
    const result = await discoverFeeds("news.example.com", { fetchImpl });
    expect(result.feeds).toEqual([{ url: "https://news.example.com/top.xml", title: "Top stories", articleCount: 2 }]);
  });

  it("falls back to common feed paths", async () => {
    const fetchImpl = fakeFetch({
      "https://site.example.com/": () => html("<html><body>no links</body></html>"),
      "https://site.example.com/rss.xml": () => xml(rss("Site")),
    });
    const result = await discoverFeeds("https://site.example.com/", { fetchImpl });
    expect(result.feeds.map((f) => f.url)).toEqual(["https://site.example.com/rss.xml"]);
  });

  it("checks every candidate url with the guard", async () => {
    const checkUrl = vi.fn(async () => undefined);
    const fetchImpl = fakeFetch({ "https://g.example.com/": () => xml(rss("G")) });
    await discoverFeeds("g.example.com", { fetchImpl, checkUrl });
    expect(checkUrl).toHaveBeenCalledWith(new URL("https://g.example.com/"));
  });

  it("drops duplicate feeds served under several paths", async () => {
    const fetchImpl = fakeFetch({
      "https://dup.example.com/": () => html('<a href="/feed">Feed</a>'),
      "https://dup.example.com/feed": () => xml(rss("Dup")),
      "https://dup.example.com/rss": () => xml(rss("Dup")),
    });
    expect((await discoverFeeds("dup.example.com", { fetchImpl })).feeds.map((f) => f.url)).toEqual(["https://dup.example.com/feed"]);
  });

  it("suggests catalog feeds for known outlets whose pages have no feed links", async () => {
    const fetchImpl = fakeFetch({ "https://www.bbc.com/": () => html("<html></html>") });
    const { feeds } = await discoverFeeds("www.bbc.com", { fetchImpl });
    expect(feeds.length).toBeGreaterThan(3);
    expect(feeds[0]).toMatchObject({ catalogId: expect.stringContaining("bbc"), title: expect.stringContaining("BBC") });
  });

  it("still suggests catalog feeds when the homepage cannot be read (too large, blocked)", async () => {
    const fetchImpl = fakeFetch({ "https://www.irishtimes.com/": () => new Response("blocked", { status: 403 }) });
    const { feeds, error } = await discoverFeeds("irishtimes.com", { fetchImpl });
    expect(error).toBeUndefined();
    expect(feeds.length).toBeGreaterThan(3);
    expect(feeds.every((f) => f.catalogId?.startsWith("ie-irishtimes-"))).toBe(true);
  });

  it("reports an error for invalid input or an unreachable page", async () => {
    expect(await discoverFeeds("not a url", { fetchImpl: vi.fn() })).toEqual({ feeds: [], error: "올바른 주소가 아닙니다" });
    const fetchImpl = fakeFetch({});
    const r = await discoverFeeds("down.example.com", { fetchImpl });
    expect(r.feeds).toEqual([]);
    expect(r.error).toContain("HTTP 404");
  });
});
