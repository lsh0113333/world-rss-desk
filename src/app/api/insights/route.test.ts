// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/world-insights", () => ({ readWorldInsights: vi.fn() }));
const { readWorldInsights } = await import("@/services/world-insights");
const { GET } = await import("./route");

afterEach(() => {
  vi.unstubAllEnvs();
  vi.mocked(readWorldInsights).mockReset();
});

describe("GET /api/insights", () => {
  it("Supabase 설정이 없으면 빈 결과", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    const res = await GET();
    expect(await res.json()).toEqual({ updatedAt: null, stories: [], countries: {} });
    expect(readWorldInsights).not.toHaveBeenCalled();
  });

  it("결과를 JSON으로, CDN 5분 캐시", async () => {
    vi.stubEnv("SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "pk");
    vi.mocked(readWorldInsights).mockResolvedValue({ updatedAt: "t", stories: [], countries: { KR: 1 } });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ updatedAt: "t", countries: { KR: 1 } });
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=300");
  });

  it("읽기 실패는 502", async () => {
    vi.stubEnv("SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "pk");
    vi.mocked(readWorldInsights).mockRejectedValue(new Error("Supabase stories 503: paused"));
    const res = await GET();
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "세계 흐름을 불러오지 못했습니다" });
  });
});
