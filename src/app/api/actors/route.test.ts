// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/world", () => ({ readActor: vi.fn(), readerDb: vi.fn(() => ({})) }));

const { readActor } = await import("@/services/world");
const { GET } = await import("./route");
const mocked = vi.mocked(readActor);
const call = (query: string) => GET(new Request(`http://localhost/api/actors${query}`));

beforeEach(() => {
  mocked.mockReset();
});

describe("GET /api/actors", () => {
  it("행위자를 JSON으로", async () => {
    mocked.mockResolvedValue({ id: "country:US" } as never);
    const res = await call(`?id=${encodeURIComponent("country:US")}`);
    expect(res.status).toBe(200);
    expect(mocked.mock.calls[0][1]).toBe("country:US");
    expect(res.headers.get("Cache-Control")).toBe("public, s-maxage=300, stale-while-revalidate=900");
  });

  it("id가 없거나 형식이 틀리면 400", async () => {
    expect((await call("")).status).toBe(400);
    expect((await call("?id=event:1")).status).toBe(400);
    expect((await call(`?id=actor:${"x".repeat(300)}`)).status).toBe(400);
    expect(mocked).not.toHaveBeenCalled();
  });

  it("없으면 404", async () => {
    mocked.mockResolvedValue(null);
    expect((await call("?id=actor:org:none")).status).toBe(404);
  });

  it("실패하면 502", async () => {
    mocked.mockImplementation(async () => {
      throw new Error("boom");
    });
    expect((await call("?id=actor:org:un")).status).toBe(502);
  });
});
