// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  unstable_cache: (fn: () => unknown) => fn,
  revalidateTag: vi.fn(),
}));
vi.mock("@/services/feed-health", () => ({ checkFeeds: vi.fn() }));
vi.mock("@/lib/url-guard", () => ({ assertSafeUrl: vi.fn() }));

const { revalidateTag } = await import("next/cache");
const { checkFeeds } = await import("@/services/feed-health");
const { GET, maxDuration } = await import("./route");

const report = { checkedAt: "2026-10-18T00:00:00.000Z", total: 2, ok: 1, stale: [], failed: [{ id: "x", name: "X", detail: "HTTP 404" }] };

beforeEach(() => {
  vi.mocked(checkFeeds).mockResolvedValue(report);
  vi.mocked(revalidateTag).mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/feed-health", () => {
  it("returns the catalog health report without caching in the browser", async () => {
    const res = await GET(new Request("http://localhost/api/feed-health"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(report);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(revalidateTag).not.toHaveBeenCalled();
    expect(maxDuration).toBe(300);
  });

  it("re-checks when called by the cron job with the secret", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    await GET(new Request("http://localhost/api/feed-health", { headers: { authorization: "Bearer s3cret" } }));
    expect(revalidateTag).toHaveBeenCalledWith("feed-health");
  });

  it("ignores a wrong secret", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    await GET(new Request("http://localhost/api/feed-health", { headers: { authorization: "Bearer nope" } }));
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});
