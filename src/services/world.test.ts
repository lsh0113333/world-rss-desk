// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { Db } from "./supabase";
import { readActor, readBoard } from "./world";

function fakeDb(handler: (table: string, query: string) => unknown[]): Db {
  return {
    select: vi.fn(async (table: string, query: string) => handler(table, query)) as Db["select"],
    upsert: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    count: vi.fn(),
  };
}

describe("readBoard", () => {
  it("가장 최근 상황판 하나만 읽는다", async () => {
    const board = { generatedAt: "2026-11-01T00:00:00Z", events: [] };
    const db = fakeDb(() => [{ payload: board }]);
    expect(await readBoard(db)).toBe(board);
    expect(db.select).toHaveBeenCalledWith("board_snapshots", "select=payload&order=generated_at.desc&limit=1");
  });

  it("아직 없으면 null", async () => {
    expect(await readBoard(fakeDb(() => []))).toBeNull();
  });
});

describe("readActor", () => {
  const eventProps = (title: string) => ({ eventType: "sanction", title, summary: `${title} 요약` });

  it("행위자의 사건과 함께 나온 행위자를 모은다", async () => {
    const db = fakeDb((table, query) => {
      if (table === "links" && query.includes("dst=")) {
        return [
          { src: "event:1", type: "subject", dst: "country:US", props: { name: "United States", nameKo: "미국", kind: "country" } },
          { src: "event:2", type: "target", dst: "country:US", props: { name: "United States", nameKo: "미국", kind: "country" } },
        ];
      }
      if (table === "links") {
        return [
          { src: "event:1", type: "subject", dst: "country:US", props: { nameKo: "미국", kind: "country" } },
          { src: "event:1", type: "target", dst: "country:CN", props: { nameKo: "중국", kind: "country" } },
          { src: "event:2", type: "subject", dst: "country:CN", props: { nameKo: "중국", kind: "country" } },
          { src: "event:2", type: "participant", dst: "actor:org:un", props: { nameKo: "유엔", kind: "org" } },
        ];
      }
      return [
        { id: "event:1", last_seen: "2026-11-01T00:00:00Z", props: eventProps("옛 사건") },
        { id: "event:2", last_seen: "2026-11-01T05:00:00Z", props: eventProps("새 사건") },
      ];
    });
    const profile = await readActor(db, "country:US");
    expect(profile).toMatchObject({ id: "country:US", name: "United States", nameKo: "미국", kind: "country" });
    expect(profile?.events.map((e) => [e.title, e.role])).toEqual([
      ["새 사건", "target"],
      ["옛 사건", "subject"],
    ]);
    expect(profile?.together).toEqual([
      { id: "country:CN", nameKo: "중국", kind: "country", count: 2 },
      { id: "actor:org:un", nameKo: "유엔", kind: "org", count: 1 },
    ]);
  });

  it("소속 나라는 가장 최근 소속 관계에서", async () => {
    const db = fakeDb((table, query) => {
      if (table === "links" && query.includes("type=eq.affiliated_with")) return [{ dst: "country:KR" }];
      if (table === "links" && query.includes("dst=")) return [{ src: "event:1", type: "target", dst: "actor:org:samsung", props: { name: "Samsung", nameKo: "삼성전자", kind: "org" } }];
      if (table === "links") return [];
      return [{ id: "event:1", last_seen: "2026-11-01T00:00:00Z", props: eventProps("사건") }];
    });
    const profile = await readActor(db, "actor:org:samsung");
    expect(profile?.country).toBe("KR");
    expect(vi.mocked(db.select).mock.calls.some(([, q]) => q.includes("src=eq.actor%3Aorg%3Asamsung") && q.includes("order=observed_at.desc&limit=1"))).toBe(true);
  });

  it("없는 행위자는 null", async () => {
    expect(await readActor(fakeDb(() => []), "actor:org:none")).toBeNull();
  });

  it("id의 공백·특수문자를 안전하게 넣는다", async () => {
    const db = fakeDb(() => []);
    await readActor(db, "actor:person:elon musk&x=1");
    expect(vi.mocked(db.select).mock.calls[0][1]).toContain(encodeURIComponent("actor:person:elon musk&x=1"));
  });
});
