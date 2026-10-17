// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("@/services/discover", () => ({ discoverFeeds: vi.fn(async () => ({ feeds: [{ url: "https://a.com/rss", title: "A", articleCount: 3 }] })) }));
vi.mock("@/lib/url-guard", () => ({ assertSafeUrl: vi.fn() }));
const { discoverFeeds } = await import("@/services/discover");
const { assertSafeUrl } = await import("@/lib/url-guard");
const { GET } = await import("./route");

describe("GET /api/discover", () => {
  it("returns discovered feeds using the url guard", async () => {
    const res = await GET(new Request("http://localhost/api/discover?url=a.com"));
    expect(res.status).toBe(200);
    expect((await res.json()).feeds).toHaveLength(1);
    expect(discoverFeeds).toHaveBeenCalledWith("a.com", { checkUrl: assertSafeUrl });
  });

  it("returns 400 without url", async () => {
    expect((await GET(new Request("http://localhost/api/discover"))).status).toBe(400);
  });
});
