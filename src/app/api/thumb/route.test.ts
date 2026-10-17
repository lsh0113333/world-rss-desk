// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { FeedFetchError } from "@/lib/errors";

vi.mock("@/services/http", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/services/http")>()), fetchText: vi.fn() }));
vi.mock("@/lib/url-guard", () => ({ assertSafeUrl: vi.fn() }));

const { fetchText } = await import("@/services/http");
const { assertSafeUrl } = await import("@/lib/url-guard");
const { GET } = await import("./route");
const mocked = vi.mocked(fetchText);
const call = (q: string) => GET(new Request(`http://localhost/api/thumb?${q}`));
const article = "https://news.example.com/a";

describe("GET /api/thumb", () => {
  it("redirects to the page's og:image with a day-long cache", async () => {
    mocked.mockResolvedValue({ text: `<meta property="og:image" content="/i.jpg">`, headers: new Headers(), url: article });
    const res = await call(`url=${encodeURIComponent(article)}`);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://news.example.com/i.jpg");
    expect(res.headers.get("cache-control")).toBe("public, s-maxage=86400, stale-while-revalidate=604800");
    expect(mocked.mock.calls[0][1]).toMatchObject({ checkUrl: assertSafeUrl });
  });

  it("returns a cached 404 when the page has no image", async () => {
    mocked.mockResolvedValue({ text: "<title>x</title>", headers: new Headers(), url: article });
    const res = await call(`url=${encodeURIComponent(article)}`);
    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBe("public, s-maxage=86400, stale-while-revalidate=604800");
  });

  it("returns 404 when the page cannot be fetched", async () => {
    mocked.mockImplementation(async () => {
      throw new FeedFetchError("HTTP 403");
    });
    expect((await call(`url=${encodeURIComponent(article)}`)).status).toBe(404);
  });

  it("returns 400 without a url", async () => {
    expect((await call("")).status).toBe(400);
  });
});
