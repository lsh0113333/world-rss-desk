// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createDb } from "./supabase";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("createDb", () => {
  it("select: REST 경로·쿼리·키 헤더로 요청한다", async () => {
    const fetchMock = vi.fn(async () => json([{ id: "a" }]));
    const db = createDb({ url: "https://x.supabase.co", key: "k", fetch: fetchMock });
    const rows = await db.select("stories", "select=id&order=score.desc");
    expect(rows).toEqual([{ id: "a" }]);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://x.supabase.co/rest/v1/stories?select=id&order=score.desc");
    expect((init.headers as Record<string, string>).apikey).toBe("k");
  });

  it("select all: 1000개 단위 Range로 끝까지 받는다", async () => {
    const page = (n: number) => Array.from({ length: n }, (_, i) => ({ i }));
    const fetchMock = vi.fn().mockResolvedValueOnce(json(page(1000))).mockResolvedValueOnce(json(page(3)));
    const db = createDb({ url: "https://x.supabase.co", key: "k", fetch: fetchMock });
    const rows = await db.select("articles", "select=id", { all: true });
    expect(rows).toHaveLength(1003);
    const ranges = fetchMock.mock.calls.map((c) => (c[1] as RequestInit & { headers: Record<string, string> }).headers.Range);
    expect(ranges).toEqual(["0-999", "1000-1999"]);
  });

  it("upsert: 500개씩 나눠 POST하고 충돌 처리 방식을 붙인다", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 201 }));
    const db = createDb({ url: "https://x.supabase.co", key: "k", fetch: fetchMock });
    const rows = Array.from({ length: 1200 }, (_, i) => ({ id: String(i) }));
    await db.upsert("articles", rows, { ignoreDuplicates: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe("https://x.supabase.co/rest/v1/articles");
    expect(init.method).toBe("POST");
    expect(init.headers.Prefer).toContain("resolution=ignore-duplicates");
    expect(JSON.parse(init.body as string)).toHaveLength(500);
  });

  it("upsert onConflict: 쿼리에 on_conflict를 붙이고 병합한다", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 201 }));
    const db = createDb({ url: "https://x.supabase.co", key: "k", fetch: fetchMock });
    await db.upsert("story_articles", [{ story_id: "s", article_id: "a" }], { onConflict: "story_id,article_id" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe("https://x.supabase.co/rest/v1/story_articles?on_conflict=story_id,article_id");
    expect(init.headers.Prefer).toContain("resolution=merge-duplicates");
  });

  it("빈 upsert는 요청하지 않는다", async () => {
    const fetchMock = vi.fn();
    await createDb({ url: "https://x.supabase.co", key: "k", fetch: fetchMock }).upsert("t", []);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("remove·insert", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(json([{ id: 7 }], 201));
    const db = createDb({ url: "https://x.supabase.co", key: "k", fetch: fetchMock });
    await db.remove("articles", "published_at=lt.2026-10-01");
    const inserted = await db.insert<{ id: number }>("pipeline_runs", { stats: {} });
    expect(inserted).toEqual({ id: 7 });
    expect(fetchMock.mock.calls[0][0]).toBe("https://x.supabase.co/rest/v1/articles?published_at=lt.2026-10-01");
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe("DELETE");
  });

  it("실패 응답은 테이블 이름과 함께 오류로 던진다", async () => {
    const fetchMock = vi.fn(async () => json({ message: "permission denied" }, 401));
    const db = createDb({ url: "https://x.supabase.co", key: "k", fetch: fetchMock });
    await expect(db.select("stories", "select=id")).rejects.toThrow(/stories.*401.*permission denied/);
  });
});
