import { describe, expect, it } from "vitest";
import { commonFeedUrls, extractFeedLinks, normalizeSiteInput } from "./feed-discovery";

const page = "https://news.example.com/section/";

describe("extractFeedLinks", () => {
  it("reads RSS/Atom alternate links with titles, resolving relative urls", () => {
    const html = `
      <link rel="alternate" type="application/rss+xml" title="Top stories" href="/rss/top.xml">
      <link type="application/atom+xml" rel="alternate" href="https://news.example.com/atom">
      <link rel="stylesheet" href="/style.css">
      <link rel="alternate" hreflang="ko" href="/ko/">`;
    expect(extractFeedLinks(html, page)).toEqual([
      { url: "https://news.example.com/rss/top.xml", title: "Top stories" },
      { url: "https://news.example.com/atom" },
    ]);
  });

  it("also picks anchors that look like feeds on the same site", () => {
    const html = `<a href="/rss/world.xml">World RSS</a><a href="https://other.com/feed">x</a><a href="/about">About</a>`;
    expect(extractFeedLinks(html, page)).toEqual([{ url: "https://news.example.com/rss/world.xml", title: "World RSS" }]);
  });

  it("dedupes and ignores non-http urls", () => {
    const html = `<link rel="alternate" type="application/rss+xml" href="/feed"><a href="/feed">Feed</a><link rel="alternate" type="application/rss+xml" href="javascript:x">`;
    expect(extractFeedLinks(html, page)).toEqual([{ url: "https://news.example.com/feed" }]);
  });
});

describe("normalizeSiteInput / commonFeedUrls", () => {
  it("adds https to bare domains and keeps full urls", () => {
    expect(normalizeSiteInput("bbc.com")).toBe("https://bbc.com/");
    expect(normalizeSiteInput(" https://x.com/a ")).toBe("https://x.com/a");
    expect(normalizeSiteInput("not a url !!")).toBeNull();
  });

  it("lists conventional feed paths on the site origin", () => {
    const urls = commonFeedUrls("https://blog.example.com/posts/1");
    expect(urls).toContain("https://blog.example.com/feed");
    expect(urls).toContain("https://blog.example.com/rss.xml");
    expect(urls.every((u) => u.startsWith("https://blog.example.com/"))).toBe(true);
  });
});
