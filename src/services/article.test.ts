// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { FeedFetchError } from "@/lib/errors";
import { extractReader, viewArticle } from "./article";

const html = readFileSync(join(__dirname, "__fixtures__", "article.html"), "utf8");
const pageUrl = "https://news.example.com/2026/10/markets";

describe("extractReader", () => {
  const doc = extractReader(html, pageUrl);

  it("extracts title, site name, byline and date", () => {
    expect(doc).not.toBeNull();
    expect(doc?.title).toBe("Markets rally as rates fall");
    expect(doc?.siteName).toBe("Example News");
    expect(doc?.byline).toContain("Jane Doe");
    expect(doc?.publishedAt).toBe("2026-10-17T08:00:00Z");
  });

  it("turns the article body into plain blocks", () => {
    const types = doc!.blocks.map((b) => b.type);
    expect(types).toContain("p");
    expect(types).toContain("h2");
    expect(types).toContain("blockquote");
    expect(doc!.blocks.filter((b) => b.type === "li").map((b) => ("text" in b ? b.text : ""))).toEqual(["Tech shares up 4%", "Property shares up 2.5%"]);
    const text = doc!.blocks.map((b) => ("text" in b ? b.text : "")).join(" ");
    expect(text).toContain("surprised many investors");
    expect(text).not.toContain("alert");
    expect(text).not.toContain("Buy now");
    expect(text).not.toContain("Copyright");
  });

  it("resolves image urls and drops non-http images", () => {
    const images = doc!.blocks.filter((b) => b.type === "img");
    expect(images).toEqual([{ type: "img", src: "https://news.example.com/images/chart.png", alt: "Index chart" }]);
  });

  it("returns null when there is not enough text", () => {
    expect(extractReader("<html><body><p>Too short.</p></body></html>", pageUrl)).toBeNull();
  });
});

describe("viewArticle", () => {
  const page = (body: string, headers: Record<string, string> = {}) =>
    new Response(body, { status: 200, headers: { "content-type": "text/html; charset=utf-8", ...headers } });

  it("returns frame mode when the page allows embedding", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(page(html));
    expect(await viewArticle(pageUrl, { fetchImpl })).toEqual({ mode: "frame", url: pageUrl });
  });

  it("uses the final url after redirects", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: "https://www.example.com/a" } }))
      .mockResolvedValueOnce(page(html));
    expect(await viewArticle(pageUrl, { fetchImpl })).toEqual({ mode: "frame", url: "https://www.example.com/a" });
  });

  it("returns reader mode when framing is blocked", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(page(html, { "x-frame-options": "DENY" }));
    const view = await viewArticle(pageUrl, { fetchImpl });
    expect(view.mode).toBe("reader");
    expect(view).toMatchObject({ url: pageUrl, title: "Markets rally as rates fall" });
  });

  it("returns link mode when framing is blocked and no article text is found", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(page("<html><body>Subscribe to read</body></html>", { "x-frame-options": "SAMEORIGIN" }));
    expect(await viewArticle(pageUrl, { fetchImpl })).toEqual({ mode: "link", url: pageUrl, reason: "본문을 찾지 못했습니다 (유료 기사이거나 구조가 특이한 페이지)" });
  });

  it("returns link mode with the reason when the page cannot be fetched", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("no", { status: 403 }));
    expect(await viewArticle(pageUrl, { fetchImpl })).toEqual({ mode: "link", url: pageUrl, reason: "사이트가 접근을 막았습니다 (HTTP 403)" });
  });

  it("propagates url guard rejections as errors", async () => {
    const checkUrl = vi.fn().mockRejectedValue(new FeedFetchError("차단된 주소입니다"));
    await expect(viewArticle("http://127.0.0.1/", { checkUrl, fetchImpl: vi.fn() })).rejects.toThrow("차단된 주소입니다");
  });

  it("returns link mode for non-html responses", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("%PDF-1.4", { headers: { "content-type": "application/pdf" } }));
    expect(await viewArticle(pageUrl, { fetchImpl })).toEqual({ mode: "link", url: pageUrl, reason: "웹 페이지가 아닙니다" });
  });
});
