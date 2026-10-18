import { describe, expect, it } from "vitest";
import { googleNewsUrl, isGoogleNewsLink } from "./google-news";

describe("googleNewsUrl", () => {
  it("searches Korean news for queries with Hangul", () => {
    const url = new URL(googleNewsUrl("반도체 수출"));
    expect(url.origin + url.pathname).toBe("https://news.google.com/rss/search");
    expect(url.searchParams.get("q")).toBe("반도체 수출 when:2d");
    expect(url.searchParams.get("hl")).toBe("ko");
    expect(url.searchParams.get("gl")).toBe("KR");
    expect(url.searchParams.get("ceid")).toBe("KR:ko");
  });

  it("searches English news otherwise", () => {
    const url = new URL(googleNewsUrl("  Hormuz "));
    expect(url.searchParams.get("q")).toBe("Hormuz when:2d");
    expect(url.searchParams.get("hl")).toBe("en-US");
    expect(url.searchParams.get("ceid")).toBe("US:en");
  });
});

describe("isGoogleNewsLink", () => {
  it("detects Google News article links", () => {
    expect(isGoogleNewsLink("https://news.google.com/rss/articles/CBMi?oc=5")).toBe(true);
    expect(isGoogleNewsLink("https://www.bbc.com/news/1")).toBe(false);
    expect(isGoogleNewsLink("not a url")).toBe(false);
  });
});
