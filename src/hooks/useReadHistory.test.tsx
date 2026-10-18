import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReadHistoryRepository } from "@/lib/read-history";
import type { ReadEvent } from "@/lib/recommend";
import { useReadHistory } from "./useReadHistory";

function memoryRepo(ids: string[] = [], events: ReadEvent[] = []): ReadHistoryRepository {
  return {
    load: vi.fn().mockResolvedValue(ids),
    save: vi.fn().mockResolvedValue(undefined),
    loadEvents: vi.fn().mockResolvedValue(events),
    saveEvents: vi.fn().mockResolvedValue(undefined),
  };
}

const event: ReadEvent = { id: "b", at: "2026-10-18T00:00:00Z", source: "BBC", terms: ["iran"] };

describe("useReadHistory", () => {
  it("loads saved ids and events", async () => {
    const repo = memoryRepo(["a"], [{ ...event, id: "a" }]);
    const { result } = renderHook(() => useReadHistory(repo));
    await waitFor(() => expect(result.current.readSet.has("a")).toBe(true));
    expect(result.current.events).toHaveLength(1);
  });

  it("records the id and the event when an article is opened", async () => {
    const repo = memoryRepo();
    const { result } = renderHook(() => useReadHistory(repo));
    await waitFor(() => expect(repo.loadEvents).toHaveBeenCalled());
    act(() => result.current.markRead("b", event));
    expect(result.current.readSet.has("b")).toBe(true);
    expect(result.current.events).toEqual([event]);
    expect(repo.save).toHaveBeenCalledWith(["b"]);
    expect(repo.saveEvents).toHaveBeenCalledWith([event]);
  });

  it("records only the id when no event is given", async () => {
    const repo = memoryRepo();
    const { result } = renderHook(() => useReadHistory(repo));
    await waitFor(() => expect(repo.loadEvents).toHaveBeenCalled());
    act(() => result.current.markRead("c"));
    expect(result.current.readSet.has("c")).toBe(true);
    expect(repo.saveEvents).not.toHaveBeenCalled();
  });
});
