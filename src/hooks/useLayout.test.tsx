import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { LayoutRepository } from "@/lib/layout-repository";
import type { Layout } from "@/types/layout";
import { useLayout } from "./useLayout";

function memoryRepo(initial: Layout | null = null) {
  let stored = initial;
  const repo: LayoutRepository & { saved: () => Layout | null } = {
    load: vi.fn(async () => stored),
    save: vi.fn(async (l: Layout) => {
      stored = l;
    }),
    saved: () => stored,
  };
  return repo;
}

const saved: Layout = {
  version: 1,
  panels: [
    { id: "a", country: "KR", category: "top", feedIds: ["kr-yonhap-top"], customUrls: [], limit: 10 },
    { id: "b", country: "US", category: "top", feedIds: ["us-nyt-top"], customUrls: [], limit: 10 },
  ],
};

async function setup(initial: Layout | null = saved) {
  const repo = memoryRepo(initial);
  const hook = renderHook(() => useLayout(repo));
  await waitFor(() => expect(hook.result.current.layout).not.toBeNull());
  return { repo, ...hook };
}

describe("useLayout", () => {
  it("starts empty, then loads the saved layout", async () => {
    const repo = memoryRepo(saved);
    const { result } = renderHook(() => useLayout(repo));
    expect(result.current.layout).toBeNull();
    await waitFor(() => expect(result.current.layout).toEqual(saved));
  });

  it("falls back to the preset when nothing is saved, and saves it", async () => {
    const { result, repo } = await setup(null);
    expect(result.current.layout?.panels).toHaveLength(8);
    await waitFor(() => expect(repo.saved()?.panels).toHaveLength(8));
  });

  it("adds, updates and moves panels, saving each change", async () => {
    const { result, repo } = await setup();
    act(() => result.current.add({ country: "JP", category: "top" }));
    expect(result.current.layout?.panels.map((p) => p.country)).toEqual(["KR", "US", "JP"]);

    act(() => result.current.update("a", { title: "내 한국" }));
    expect(result.current.layout?.panels[0].title).toBe("내 한국");

    act(() => result.current.move("b", -1));
    expect(result.current.layout?.panels.map((p) => p.id).slice(0, 2)).toEqual(["b", "a"]);

    await waitFor(() => expect(repo.saved()?.panels.map((p) => p.id).slice(0, 2)).toEqual(["b", "a"]));
  });

  it("removes a panel and can undo it", async () => {
    const { result } = await setup();
    act(() => result.current.remove("a"));
    expect(result.current.layout?.panels.map((p) => p.id)).toEqual(["b"]);
    expect(result.current.lastRemoved?.panel.id).toBe("a");

    act(() => result.current.undoRemove());
    expect(result.current.layout?.panels.map((p) => p.id)).toEqual(["a", "b"]);
    expect(result.current.lastRemoved).toBeNull();
  });

  it("clearRemoved forgets the undo target", async () => {
    const { result } = await setup();
    act(() => result.current.remove("a"));
    act(() => result.current.clearRemoved());
    expect(result.current.lastRemoved).toBeNull();
  });

  it("marks one or all panels as seen", async () => {
    const { result } = await setup();
    act(() => result.current.markSeen("a"));
    expect(result.current.layout?.panels[0].lastSeenAt).toEqual(expect.any(String));
    expect(result.current.layout?.panels[1].lastSeenAt).toBeUndefined();
    act(() => result.current.markAllSeen());
    expect(result.current.layout?.panels.every((p) => p.lastSeenAt)).toBe(true);
  });

  it("replaces the whole layout and resets to the preset", async () => {
    const { result } = await setup();
    const other: Layout = { version: 1, panels: [saved.panels[1]] };
    act(() => result.current.replace(other));
    expect(result.current.layout).toEqual(other);
    act(() => result.current.resetToPreset());
    expect(result.current.layout?.panels).toHaveLength(8);
  });
});
