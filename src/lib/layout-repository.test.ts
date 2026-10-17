import { beforeEach, describe, expect, it } from "vitest";
import type { Layout } from "@/types/layout";
import { BACKUP_KEY, LAYOUT_KEY, LocalStorageLayoutRepository } from "./layout-repository";

const layout: Layout = { version: 1, panels: [{ id: "a", feedIds: ["kr-yonhap-top"], customUrls: [], limit: 10 }] };

class MemoryStorage implements Pick<Storage, "getItem" | "setItem"> {
  data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

describe("LocalStorageLayoutRepository", () => {
  let storage: MemoryStorage;
  let repo: LocalStorageLayoutRepository;

  beforeEach(() => {
    storage = new MemoryStorage();
    repo = new LocalStorageLayoutRepository(storage);
  });

  it("returns null when nothing is saved", async () => {
    expect(await repo.load()).toBeNull();
  });

  it("saves and loads a layout", async () => {
    await repo.save(layout);
    expect(storage.getItem(LAYOUT_KEY)).toBe(JSON.stringify(layout));
    expect(await repo.load()).toEqual(layout);
  });

  it("backs up corrupt data and returns null", async () => {
    storage.setItem(LAYOUT_KEY, "{broken");
    expect(await repo.load()).toBeNull();
    expect(storage.getItem(BACKUP_KEY)).toBe("{broken");
  });

  it("backs up structurally invalid data and returns null", async () => {
    storage.setItem(LAYOUT_KEY, JSON.stringify({ version: 1, panels: "nope" }));
    expect(await repo.load()).toBeNull();
    expect(storage.getItem(BACKUP_KEY)).toContain("nope");
  });

  it("survives storage that throws (private mode)", async () => {
    const throwing = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    };
    const r = new LocalStorageLayoutRepository(throwing);
    expect(await r.load()).toBeNull();
    await expect(r.save(layout)).resolves.toBeUndefined();
  });

  it("uses window.localStorage by default", async () => {
    window.localStorage.clear();
    await new LocalStorageLayoutRepository().save(layout);
    expect(window.localStorage.getItem(LAYOUT_KEY)).toBe(JSON.stringify(layout));
  });
});
