// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FeedFetchError } from "@/lib/errors";
import type { CatalogFeed } from "@/types/catalog";

vi.mock("./rss", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./rss")>();
  return { ...actual, loadFeed: vi.fn() };
});
vi.mock("@/lib/url-guard", () => ({ assertSafeUrl: vi.fn() }));

const { loadFeed } = await import("./rss");
const { assertSafeUrl } = await import("@/lib/url-guard");
const { loadFront } = await import("./front");
const mocked = vi.mocked(loadFeed);

const catalog: CatalogFeed[] = [
  { id: "kr-a-top", name: "A일보", url: "https://a.example.com/rss", homepage: "https://a.example.com", continent: "asia", country: "KR", category: "top", language: "ko" },
  { id: "jp-b-top", name: "B Times", url: "https://b.example.com/rss", homepage: "https://b.example.com", continent: "asia", country: "JP", category: "top", language: "en" },
];

beforeEach(() => {
  mocked.mockReset();
});

describe("loadFront", () => {
  it("매체별 대표 피드를 url-guard와 매체명으로 받아 대륙 구조로 돌려준다", async () => {
    mocked.mockImplementation(async (url) => ({
      title: null,
      articles: [{ id: String(url), title: "기사", link: "https://a.example.com/1", publishedAt: "2026-10-22T00:00:00Z", source: "x" }],
    }));
    const res = await loadFront({ catalog });
    expect(mocked).toHaveBeenCalledTimes(2);
    expect(mocked.mock.calls[0][1]).toMatchObject({ source: "A일보", checkUrl: assertSafeUrl });
    expect(res.continents[0].countries.map((c) => c.code).sort()).toEqual(["JP", "KR"]);
    expect(res.errors).toEqual([]);
    expect(typeof res.fetchedAt).toBe("string");
  });

  it("피드 하나가 실패해도 나머지는 보여 주고, 실패는 errors에 담는다", async () => {
    mocked.mockImplementation(async (url) => {
      if (String(url).includes("b.example")) throw new FeedFetchError("응답 없음");
      return { title: null, articles: [{ id: "1", title: "기사", link: "https://a.example.com/1", publishedAt: null, source: "x" }] };
    });
    const res = await loadFront({ catalog });
    expect(res.continents[0].countries.map((c) => c.code)).toEqual(["KR"]);
    expect(res.errors).toEqual([{ feed: "jp-b-top", message: "응답 없음" }]);
  });
});
