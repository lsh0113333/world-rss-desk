// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { FeedFetchError } from "@/lib/errors";

vi.mock("@/services/article", () => ({ viewArticle: vi.fn() }));
vi.mock("@/lib/url-guard", () => ({ assertSafeUrl: vi.fn() }));

const { viewArticle } = await import("@/services/article");
const { assertSafeUrl } = await import("@/lib/url-guard");
const { GET } = await import("./route");
const mocked = vi.mocked(viewArticle);

const call = (query: string) => GET(new Request(`http://localhost/api/article?${query}`));
const target = "https://news.example.com/a?x=1";



describe("GET /api/article", () => {
  it("returns the article view with a long CDN cache", async () => {
    mocked.mockResolvedValue({ mode: "frame", url: target });
    const res = await call(`url=${encodeURIComponent(target)}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ mode: "frame", url: target });
    expect(res.headers.get("cache-control")).toBe("public, s-maxage=3600, stale-while-revalidate=86400");
    expect(mocked).toHaveBeenCalledWith(target, { checkUrl: assertSafeUrl });
  });

  it("returns 400 without a url", async () => {
    const res = await call("");
    expect(res.status).toBe(400);
    expect(mocked).not.toHaveBeenCalled();
  });

  it("returns 400 with the guard message for unsafe urls", async () => {
    mocked.mockImplementation(async () => {
      throw new FeedFetchError("차단된 주소입니다");
    });
    const res = await call(`url=${encodeURIComponent("http://127.0.0.1/")}`);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "차단된 주소입니다" });
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("returns 500 for unexpected errors", async () => {
    mocked.mockImplementation(async () => {
      throw new Error("boom");
    });
    const res = await call(`url=${encodeURIComponent(target)}`);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "원문을 불러오는 중 오류가 발생했습니다" });
  });
});
