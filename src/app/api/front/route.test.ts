// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FrontResponse } from "@/types/front";

vi.mock("@/services/front", () => ({ loadFront: vi.fn() }));

const { loadFront } = await import("@/services/front");
const { GET } = await import("./route");
const mocked = vi.mocked(loadFront);

const body: FrontResponse = {
  fetchedAt: "2026-10-22T00:00:00.000Z",
  errors: [],
  continents: [
    {
      id: "asia",
      label: "아시아",
      countries: [{ code: "KR", name: "한국", timeZone: "Asia/Seoul", outlets: [{ name: "A일보", homepage: "https://a.example.com", language: "ko", items: [] }] }],
    },
  ],
};

beforeEach(() => {
  mocked.mockReset();
});

describe("GET /api/front", () => {
  it("가판대 데이터를 JSON으로, CDN에 10분 캐시하고 하루 동안은 이전 결과로 즉시 응답", async () => {
    mocked.mockResolvedValue(body);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(body);
    expect(res.headers.get("Cache-Control")).toBe("public, s-maxage=600, stale-while-revalidate=86400");
  });

  it("매체를 하나도 못 받으면 502, 캐시하지 않는다", async () => {
    mocked.mockResolvedValue({ ...body, continents: [] });
    const res = await GET();
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "뉴스를 불러오지 못했습니다" });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("예상 못 한 오류도 502", async () => {
    mocked.mockImplementation(async () => {
      throw new Error("boom");
    });
    const res = await GET();
    expect(res.status).toBe(502);
  });
});
