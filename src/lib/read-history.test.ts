import { describe, expect, it } from "vitest";
import { addRead, LocalStorageReadHistoryRepository, MAX_READ_IDS, READ_KEY } from "./read-history";

class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
}

describe("addRead", () => {
  it("appends new ids, moves repeats to the end and caps the size", () => {
    expect(addRead(["a", "b"], "c")).toEqual(["a", "b", "c"]);
    expect(addRead(["a", "b"], "a")).toEqual(["b", "a"]);
    const full = Array.from({ length: MAX_READ_IDS }, (_, i) => `id${i}`);
    const next = addRead(full, "new");
    expect(next).toHaveLength(MAX_READ_IDS);
    expect(next[0]).toBe("id1");
    expect(next.at(-1)).toBe("new");
  });
});

describe("LocalStorageReadHistoryRepository", () => {
  it("round-trips ids and ignores corrupt data", async () => {
    const storage = new MemoryStorage();
    const repo = new LocalStorageReadHistoryRepository(storage);
    expect(await repo.load()).toEqual([]);
    await repo.save(["a", "b"]);
    expect(await repo.load()).toEqual(["a", "b"]);
    storage.setItem(READ_KEY, "{bad");
    expect(await repo.load()).toEqual([]);
    storage.setItem(READ_KEY, JSON.stringify([1, "x"]));
    expect(await repo.load()).toEqual(["x"]);
  });
});
