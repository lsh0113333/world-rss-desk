import { describe, expect, it } from "vitest";
import { LocalStorageNewsstandPrefsRepository, NEWSSTAND_PREFS_KEY } from "./newsstand-prefs";

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

describe("LocalStorageNewsstandPrefsRepository", () => {
  it("처음에는 접힌 대륙이 없다", async () => {
    expect(await new LocalStorageNewsstandPrefsRepository(memory()).load()).toEqual({ folded: [] });
  });

  it("저장한 접힌 대륙을 다시 읽는다", async () => {
    const store = memory();
    const repo = new LocalStorageNewsstandPrefsRepository(store);
    await repo.save({ folded: ["europe", "africa"] });
    expect(JSON.parse(store.data[NEWSSTAND_PREFS_KEY])).toEqual({ folded: ["europe", "africa"] });
    expect(await repo.load()).toEqual({ folded: ["europe", "africa"] });
  });

  it("깨진 값이나 모르는 대륙은 버린다", async () => {
    expect(await new LocalStorageNewsstandPrefsRepository(memory({ [NEWSSTAND_PREFS_KEY]: "{oops" })).load()).toEqual({ folded: [] });
    const odd = memory({ [NEWSSTAND_PREFS_KEY]: JSON.stringify({ folded: ["asia", "mars", 3] }) });
    expect(await new LocalStorageNewsstandPrefsRepository(odd).load()).toEqual({ folded: ["asia"] });
  });

  it("저장소를 못 쓰면 조용히 넘어간다", async () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    const repo = new LocalStorageNewsstandPrefsRepository(broken);
    expect(await repo.load()).toEqual({ folded: [] });
    await expect(repo.save({ folded: ["asia"] })).resolves.toBeUndefined();
  });
});
