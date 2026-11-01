import { describe, expect, it } from "vitest";
import { advanceVisit, BOARD_PREFS_KEY, isNewSince, LocalStorageBoardPrefsRepository } from "./board-prefs";

const at = (min: number) => new Date(Date.UTC(2026, 10, 1, 12, min)).toISOString();

function memory(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
  };
}

describe("advanceVisit", () => {
  it("첫 방문은 비교 기준이 없다", () => {
    expect(advanceVisit({ lastVisitAt: null, previousVisitAt: null }, new Date(at(0)))).toEqual({ lastVisitAt: at(0), previousVisitAt: null });
  });

  it("30분 넘게 지나 다시 오면 지난 방문이 비교 기준이 된다", () => {
    const next = advanceVisit({ lastVisitAt: at(0), previousVisitAt: null }, new Date(at(40)));
    expect(next).toEqual({ lastVisitAt: at(40), previousVisitAt: at(0) });
  });

  it("새로고침(30분 안)은 기준을 유지한다", () => {
    const state = { lastVisitAt: at(0), previousVisitAt: at(-60) };
    expect(advanceVisit(state, new Date(at(10)))).toBe(state);
  });
});

describe("isNewSince", () => {
  it("기준 이후 처음 본 사건만 새 사건", () => {
    expect(isNewSince(at(10), at(0))).toBe(true);
    expect(isNewSince(at(-10), at(0))).toBe(false);
    expect(isNewSince(at(10), null)).toBe(false);
  });
});

describe("LocalStorageBoardPrefsRepository", () => {
  it("저장한 값을 다시 읽는다", async () => {
    const store = memory();
    const repo = new LocalStorageBoardPrefsRepository(store);
    expect(await repo.load()).toEqual({ lastVisitAt: null, previousVisitAt: null });
    await repo.save({ lastVisitAt: at(0), previousVisitAt: null });
    expect(JSON.parse(store.data[BOARD_PREFS_KEY]).lastVisitAt).toBe(at(0));
    expect((await repo.load()).lastVisitAt).toBe(at(0));
  });

  it("깨진 값이나 쓸 수 없는 저장소는 조용히 넘어간다", async () => {
    expect(await new LocalStorageBoardPrefsRepository(memory({ [BOARD_PREFS_KEY]: "{oops" })).load()).toEqual({ lastVisitAt: null, previousVisitAt: null });
    expect(await new LocalStorageBoardPrefsRepository(memory({ [BOARD_PREFS_KEY]: JSON.stringify({ lastVisitAt: 3 }) })).load()).toEqual({ lastVisitAt: null, previousVisitAt: null });
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    const repo = new LocalStorageBoardPrefsRepository(broken);
    expect(await repo.load()).toEqual({ lastVisitAt: null, previousVisitAt: null });
    await expect(repo.save({ lastVisitAt: at(0), previousVisitAt: null })).resolves.toBeUndefined();
  });
});
