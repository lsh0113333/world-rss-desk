// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  decodeFeedBody,
  detectCharset,
  FeedFetchError,
  fetchFeedText,
  loadFeed,
  parseFeed,
  USER_AGENT,
} from "./rss";

const fixture = (name: string) => readFileSync(join(__dirname, "__fixtures__", name));
const now = new Date("2026-10-17T12:00:00Z");

describe("detectCharset", () => {
  it("prefers the Content-Type charset", () => {
    expect(detectCharset("application/xml; charset=EUC-KR", new Uint8Array())).toBe("euc-kr");
  });

  it("falls back to the XML declaration, then utf-8", () => {
    expect(detectCharset("text/xml", new TextEncoder().encode(`<?xml version="1.0" encoding="Shift_JIS"?>`))).toBe("shift_jis");
    expect(detectCharset(null, new TextEncoder().encode("<rss/>"))).toBe("utf-8");
  });
});

describe("decodeFeedBody", () => {
  it("decodes EUC-KR bytes using the XML declaration", () => {
    const text = decodeFeedBody(new Uint8Array(fixture("euckr.xml")), "application/xml");
    expect(text).toContain("경제 성장률 발표");
  });

  it("falls back to utf-8 for unknown charsets", () => {
    expect(decodeFeedBody(new TextEncoder().encode("한글"), "text/xml; charset=bogus-1")).toBe("한글");
  });
});

describe("parseFeed — RSS 2.0", () => {
  const { title, articles } = parseFeed(fixture("rss2.xml").toString("utf8"), { now });
  const byLink = (suffix: string) => articles.find((a) => a.link.endsWith(suffix));

  it("reads the channel title and uses it as the default source", () => {
    expect(title).toBe("Sample News");
    expect(articles.every((a) => a.source === "Sample News")).toBe(true);
  });

  it("cleans titles and summaries to plain text", () => {
    const a = byLink("/a?utm_source=rss&id=1");
    expect(a?.title).toBe("Markets rally & bonds fall");
    expect(a?.summary).toBe("Stocks rose sharply.");
    expect(byLink("/b")?.title).toBe("Second ‘quoted’ story");
    expect(byLink("/b")?.summary).toBe("Encoded & html");
  });

  it("parses pubDate and dc:date, null when missing or invalid", () => {
    expect(byLink("/a?utm_source=rss&id=1")?.publishedAt).toBe("2026-10-17T09:25:43.000Z");
    expect(byLink("/b")?.publishedAt).toBe("2026-10-17T08:00:00.000Z");
    expect(byLink("/c")?.publishedAt).toBeNull();
    expect(byLink("/d")?.publishedAt).toBeNull();
  });

  it("uses a permalink guid when link is missing", () => {
    expect(byLink("/d")?.title).toBe("Guid permalink story");
  });

  it("drops items with non-http links or empty titles", () => {
    expect(articles.some((a) => a.link.startsWith("javascript:"))).toBe(false);
    expect(byLink("/untitled")).toBeUndefined();
  });

  it("clamps future dates and keeps numeric-looking titles as strings", () => {
    expect(byLink("/future")?.publishedAt).toBe(now.toISOString());
    expect(byLink("/numeric")?.title).toBe("2026");
  });

  it("gives every article a stable id", () => {
    const ids = articles.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(parseFeed(fixture("rss2.xml").toString("utf8"), { now }).articles.map((a) => a.id)).toEqual(ids);
  });

  it("uses the given source name over the channel title", () => {
    const parsed = parseFeed(fixture("rss2.xml").toString("utf8"), { source: "연합뉴스", now });
    expect(parsed.articles[0].source).toBe("연합뉴스");
  });
});

describe("parseFeed — Atom", () => {
  const { title, articles } = parseFeed(fixture("atom.xml").toString("utf8"), { now });

  it("reads title, alternate link, published date and summary", () => {
    expect(title).toBe("Atom Tech");
    expect(articles[0]).toMatchObject({
      title: "AI chips ship",
      link: "https://atom.example.com/1",
      publishedAt: "2026-10-16T23:36:26.000Z",
      summary: "Summary text",
    });
  });

  it("falls back to updated and content", () => {
    expect(articles[1]).toMatchObject({
      link: "https://atom.example.com/2",
      publishedAt: "2026-10-17T02:00:00.000Z",
      summary: "Content body",
    });
  });
});

describe("parseFeed — RSS 1.0 (RDF)", () => {
  const { title, articles } = parseFeed(fixture("rdf.xml").toString("utf8"), { now });

  it("reads items outside the channel and dc:date", () => {
    expect(title).toBe("RDF Daily");
    expect(articles[0]).toMatchObject({
      title: "RDF headline",
      link: "https://rdf.example.com/x",
      publishedAt: "2026-10-17T08:45:09.000Z",
      summary: "RDF summary",
    });
  });

  it("uses rdf:about when link is missing", () => {
    expect(articles[1].link).toBe("https://rdf.example.com/y");
  });
});

describe("parseFeed — invalid input", () => {
  it("throws FeedFetchError for HTML pages", () => {
    expect(() => parseFeed("<!DOCTYPE html><html><head><title>Just a moment...</title></head></html>")).toThrow(FeedFetchError);
  });

  it("throws FeedFetchError for garbage", () => {
    expect(() => parseFeed("not xml at all")).toThrow("RSS 형식이 아닙니다");
  });

  it("truncates long summaries to 300 characters", () => {
    const long = "x".repeat(500);
    const xml = `<rss><channel><title>T</title><item><title>t</title><link>https://e.com/1</link><description>${long}</description></item></channel></rss>`;
    expect(parseFeed(xml).articles[0].summary).toHaveLength(300);
  });
});

function response(body: BodyInit, init: ResponseInit = {}) {
  return new Response(body, { status: 200, headers: { "content-type": "application/rss+xml" }, ...init });
}

describe("fetchFeedText", () => {
  it("sends the reader user agent and returns decoded text", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(new Uint8Array(fixture("euckr.xml")).buffer));
    const text = await fetchFeedText("https://kr.example.com/rss", { fetchImpl });
    expect(text).toContain("경제 성장률 발표");
    const [, init] = fetchImpl.mock.calls[0];
    expect(new Headers(init.headers).get("user-agent")).toBe(USER_AGENT);
    expect(init.redirect).toBe("manual");
  });

  it("uses no-store when fresh, revalidate otherwise", async () => {
    const fetchImpl = vi.fn().mockImplementation(() => Promise.resolve(response("<rss/>")));
    await fetchFeedText("https://e.com/rss", { fetchImpl, fresh: true });
    await fetchFeedText("https://e.com/rss", { fetchImpl });
    expect(fetchImpl.mock.calls[0][1].cache).toBe("no-store");
    expect(fetchImpl.mock.calls[1][1].next).toEqual({ revalidate: 120 });
  });

  it("follows redirects and checks every hop", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: "/moved" } }))
      .mockResolvedValueOnce(response("<rss/>"));
    const checkUrl = vi.fn().mockResolvedValue(undefined);
    await fetchFeedText("https://e.com/rss", { fetchImpl, checkUrl });
    expect(checkUrl.mock.calls.map(([u]) => u.toString())).toEqual(["https://e.com/rss", "https://e.com/moved"]);
    expect(fetchImpl.mock.calls[1][0]).toBe("https://e.com/moved");
  });

  it("rejects when a redirect target fails the check", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "http://127.0.0.1/" } }));
    const checkUrl = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new FeedFetchError("차단된 주소입니다"));
    await expect(fetchFeedText("https://e.com/rss", { fetchImpl, checkUrl })).rejects.toThrow("차단된 주소입니다");
  });

  it("gives up after too many redirects", async () => {
    const fetchImpl = vi.fn().mockImplementation(() => Promise.resolve(new Response(null, { status: 302, headers: { location: "/again" } })));
    await expect(fetchFeedText("https://e.com/rss", { fetchImpl })).rejects.toThrow("리다이렉트가 너무 많습니다");
  });

  it("rejects non-2xx responses with the status code", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("nope", { status: 403 }));
    await expect(fetchFeedText("https://e.com/rss", { fetchImpl })).rejects.toThrow("HTTP 403");
  });

  it("rejects bodies larger than maxBytes", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response("x".repeat(2000)));
    await expect(fetchFeedText("https://e.com/rss", { fetchImpl, maxBytes: 1000 })).rejects.toThrow("응답이 너무 큽니다");
  });

  it("maps timeouts to a readable error", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new DOMException("timed out", "TimeoutError"));
    await expect(fetchFeedText("https://e.com/rss", { fetchImpl })).rejects.toThrow("시간 초과");
  });

  it("maps network failures to a readable error", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    await expect(fetchFeedText("https://e.com/rss", { fetchImpl })).rejects.toThrow("연결 실패");
  });
});

describe("loadFeed", () => {
  it("fetches and parses in one call", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(fixture("rss2.xml").toString("utf8")));
    const feed = await loadFeed("https://news.example.com/rss", { fetchImpl, source: "Sample", now });
    expect(feed.articles.length).toBeGreaterThan(0);
    expect(feed.articles[0].source).toBe("Sample");
  });
});

describe("parseFeed — images", () => {
  const { articles } = parseFeed(fixture("media.xml").toString("utf8"), { now });
  const imageOf = (suffix: string) => articles.find((a) => a.link.endsWith(suffix))?.image;

  it("reads media:thumbnail", () => {
    expect(imageOf("/thumb")).toBe("https://img.example.com/thumb240.jpg");
  });

  it("picks the widest media:content", () => {
    expect(imageOf("/sizes")).toBe("https://img.example.com/a.jpg?width=460&q=85");
  });

  it("reads image enclosures and media:group", () => {
    expect(imageOf("/enclosure")).toBe("https://img.example.com/enc.jpg");
    expect(imageOf("/group")).toBe("https://img.example.com/group.jpg");
  });

  it("ignores video and audio media", () => {
    expect(imageOf("/video")).toBeUndefined();
  });

  it("falls back to the first img in the description", () => {
    expect(imageOf("/desc")).toBe("https://img.example.com/inline.png");
  });

  it("drops non-http images and leaves articles without images unset", () => {
    expect(imageOf("/unsafe")).toBeUndefined();
    expect(imageOf("/none")).toBeUndefined();
  });

  it("reads images from Atom content", () => {
    const xml = `<feed xmlns="http://www.w3.org/2005/Atom"><title>A</title><entry><title>t</title><link href="https://a.example.com/1"/><content type="html">&lt;img src="https://img.example.com/atom.jpg"&gt;</content></entry></feed>`;
    expect(parseFeed(xml).articles[0].image).toBe("https://img.example.com/atom.jpg");
  });
});

describe("parseFeed — item <source> (Google News)", () => {
  const xml = fixture("google-news.xml").toString("utf8");

  it("uses the item source as the outlet and strips it from the title", () => {
    const { articles } = parseFeed(xml, { now });
    expect(articles[0]).toMatchObject({ source: "NewsNation", title: "Oil tanker explodes in Strait of Hormuz" });
    expect(articles[1]).toMatchObject({ source: "Reuters", title: "Iran - US talks: what's next - analysis" });
  });

  it("still prefers an explicit source name", () => {
    const { articles } = parseFeed(xml, { now, source: "Catalog Name" });
    expect(articles[0].source).toBe("Catalog Name");
    expect(articles[0].title).toBe("Oil tanker explodes in Strait of Hormuz - NewsNation");
  });
});
