// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/world", () => ({ readBoard: vi.fn(), readerDb: vi.fn(() => ({})) }));

const { readBoard } = await import("@/services/world");
const { GET } = await import("./route");
const mocked = vi.mocked(readBoard);

beforeEach(() => {
  mocked.mockReset();
});

describe("GET /api/world", () => {
  it("상황판을 JSON으로, CDN 1분 캐시", async () => {
    const board = { generatedAt: "2026-11-01T00:00:00Z" };
    mocked.mockResolvedValue(board as never);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(board);
    expect(res.headers.get("Cache-Control")).toBe("public, s-maxage=60, stale-while-revalidate=600");
  });

  it("아직 없으면 503, 캐시 30초", async () => {
    mocked.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(503);
    expect(res.headers.get("Cache-Control")).toBe("public, s-maxage=30");
  });

  it("실패하면 502, 캐시하지 않는다", async () => {
    mocked.mockImplementation(async () => {
      throw new Error("boom");
    });
    const res = await GET();
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "세계 상황을 불러오지 못했습니다" });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});
