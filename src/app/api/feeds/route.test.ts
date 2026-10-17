// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FeedFetchError } from "@/lib/errors";
import type { FeedsResponse } from "@/types/article";

vi.mock("@/services/rss", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/rss")>();
  return { ...actual, loadFeed: vi.fn() };
});
vi.mock("@/lib/url-guard", () => ({ assertSafeUrl: vi.fn() }));

const { loadFeed } = await import("@/services/rss");
const { assertSafeUrl } = await import("@/lib/url-guard");
const { GET } = await import("./route");

const mockedLoadFeed = vi.mocked(loadFeed);

function call(query: string) {
  return GET(new Request(`http://localhost/api/feeds?${query}`));
}

function feedOf(source: string, links: [string, string | null][]) {
  return {
    title: source,
    articles: links.map(([link, publishedAt]) => ({ id: link, title: link, link, publishedAt, source })),
  };
}

const recent = new Date(Date.now() - 60 * 60 * 1000).toISOString();
const older = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

beforeEach(() => {
  mockedLoadFeed.mockReset();
});

describe("GET /api/feeds", () => {
  it("loads catalog feeds by id with their catalog name and url", async () => {
    mockedLoadFeed.mockResolvedValue(feedOf("연합뉴스", [["https://www.yna.co.kr/view/1", recent]]));
    const res = await call("ids=kr-yonhap-top");
    expect(res.status).toBe(200);
    const body = (await res.json()) as FeedsResponse;
    expect(body.articles).toHaveLength(1);
    expect(body.errors).toEqual([]);
    expect(typeof body.fetchedAt).toBe("string");

    const [url, opts] = mockedLoadFeed.mock.calls[0];
    expect(url).toBe("https://www.yna.co.kr/rss/news.xml");
    expect(opts).toMatchObject({ source: "연합뉴스", fresh: false });
    expect(opts?.checkUrl).toBe(assertSafeUrl);
  });

  it("loads custom urls with the url guard and no fixed source name", async () => {
    mockedLoadFeed.mockResolvedValue(feedOf("Custom", [["https://custom.example.com/1", recent]]));
    const target = "https://custom.example.com/feed?a=1,2";
    const res = await call(`urls=${encodeURIComponent(target)}`);
    expect(res.status).toBe(200);
    const [url, opts] = mockedLoadFeed.mock.calls[0];
    expect(url).toBe(target);
    expect(opts?.source).toBeUndefined();
    expect(opts?.checkUrl).toBe(assertSafeUrl);
  });

  it("merges several feeds newest first and applies limit", async () => {
    mockedLoadFeed
      .mockResolvedValueOnce(feedOf("A", [["https://a.com/1", older], ["https://a.com/2", recent]]))
      .mockResolvedValueOnce(feedOf("B", [["https://b.com/1", recent], ["https://a.com/2?utm_source=b", recent]]));
    const res = await call("ids=kr-yonhap-top,kr-hankyung-top&limit=2");
    const body = (await res.json()) as FeedsResponse;
    expect(body.articles.map((a) => a.link)).toEqual(["https://a.com/2", "https://b.com/1"]);
  });

  it("returns partial results with per-feed errors", async () => {
    mockedLoadFeed
      .mockResolvedValueOnce(feedOf("A", [["https://a.com/1", recent]]))
      .mockRejectedValueOnce(new FeedFetchError("HTTP 403"))
      .mockRejectedValueOnce(new Error("boom"));
    const target = "https://x.example.com/rss";
    const res = await call(`ids=kr-yonhap-top,kr-hankyung-top&urls=${encodeURIComponent(target)}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as FeedsResponse;
    expect(body.articles).toHaveLength(1);
    expect(body.errors).toEqual([
      { feed: "kr-hankyung-top", message: "HTTP 403" },
      { feed: target, message: "불러오기 실패" },
    ]);
  });

  it("reports unknown catalog ids without fetching them", async () => {
    const res = await call("ids=no-such-feed");
    const body = (await res.json()) as FeedsResponse;
    expect(res.status).toBe(200);
    expect(body.errors).toEqual([{ feed: "no-such-feed", message: "더 이상 제공되지 않는 매체입니다" }]);
    expect(mockedLoadFeed).not.toHaveBeenCalled();
  });

  it("deduplicates repeated ids and urls", async () => {
    mockedLoadFeed.mockResolvedValue(feedOf("A", []));
    await call("ids=kr-yonhap-top,kr-yonhap-top&urls=https%3A%2F%2Fa.com%2Frss&urls=https%3A%2F%2Fa.com%2Frss");
    expect(mockedLoadFeed).toHaveBeenCalledTimes(2);
  });

  it("uses CDN cache headers by default and no-store when fresh=1", async () => {
    mockedLoadFeed.mockResolvedValue(feedOf("A", []));
    const cached = await call("ids=kr-yonhap-top");
    expect(cached.headers.get("cache-control")).toBe("public, s-maxage=120, stale-while-revalidate=600");

    const fresh = await call("ids=kr-yonhap-top&fresh=1");
    expect(fresh.headers.get("cache-control")).toBe("no-store");
    expect(mockedLoadFeed.mock.calls[1][1]).toMatchObject({ fresh: true });
  });

  it("filters out articles older than maxAgeHours", async () => {
    const stale = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
    mockedLoadFeed.mockResolvedValue(feedOf("A", [["https://a.com/new", recent], ["https://a.com/stale", stale]]));
    const body = (await (await call("ids=kr-yonhap-top&maxAgeHours=3")).json()) as FeedsResponse;
    expect(body.articles.map((a) => a.link)).toEqual(["https://a.com/new"]);
  });

  describe("validation", () => {
    it.each([
      ["no feeds", ""],
      ["too many feeds", `ids=${Array.from({ length: 13 }, (_, i) => `x-${i}-top`).join(",")}`],
      ["limit too high", "ids=kr-yonhap-top&limit=51"],
      ["limit not a number", "ids=kr-yonhap-top&limit=abc"],
      ["limit zero", "ids=kr-yonhap-top&limit=0"],
      ["maxAgeHours too high", "ids=kr-yonhap-top&maxAgeHours=1000"],
    ])("returns 400 for %s", async (_label, query) => {
      const res = await call(query);
      expect(res.status).toBe(400);
      expect(await res.json()).toHaveProperty("error");
      expect(mockedLoadFeed).not.toHaveBeenCalled();
    });
  });
});
