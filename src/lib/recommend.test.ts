import { describe, expect, it } from "vitest";
import type { StoryItem } from "@/types/insights";
import type { Panel } from "@/types/layout";
import { addReadEvent, buildProfile, MAX_READ_EVENTS, MIN_EVENTS_FOR_PROFILE, readEventOf, recommend, suggestPanels, type ReadEvent } from "./recommend";

const now = new Date("2026-10-18T12:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();

function story(id: string, title: string, source: string, country?: string, category?: StoryItem["category"], published = hoursAgo(1)): StoryItem {
  return { article: { id, title, link: `https://example.com/${id}`, publishedAt: published, source }, panelId: "p", country, category };
}

function event(over: Partial<ReadEvent> = {}): ReadEvent {
  return { id: Math.random().toString(36), at: hoursAgo(2), source: "BBC", country: "GB", category: "world", terms: ["iran", "hormuz"], ...over };
}

describe("readEventOf / addReadEvent", () => {
  it("captures source, country, category and title keywords", () => {
    const e = readEventOf(story("x", "Iran closes Hormuz", "BBC", "GB", "world"), now);
    expect(e).toEqual({ id: "x", at: now.toISOString(), source: "BBC", country: "GB", category: "world", terms: ["iran", "closes", "hormuz"] });
  });

  it("replaces an older event for the same article and caps the list", () => {
    const list = Array.from({ length: MAX_READ_EVENTS }, (_, i) => event({ id: `e${i}` }));
    const next = addReadEvent(list, event({ id: "e0" }));
    expect(next).toHaveLength(MAX_READ_EVENTS);
    expect(next.at(-1)?.id).toBe("e0");
    expect(addReadEvent(next, event({ id: "new" }))).toHaveLength(MAX_READ_EVENTS);
  });
});

describe("buildProfile", () => {
  it("is not ready until enough articles have been read", () => {
    const events = Array.from({ length: MIN_EVENTS_FOR_PROFILE - 1 }, () => event());
    expect(buildProfile(events, now).ready).toBe(false);
  });

  it("weights recent reads more than old ones", () => {
    const events = [
      ...Array.from({ length: 3 }, () => event({ source: "Old Times", at: hoursAgo(24 * 28) })),
      ...Array.from({ length: 3 }, () => event({ source: "BBC", at: hoursAgo(1) })),
    ];
    const profile = buildProfile(events, now);
    expect(profile.ready).toBe(true);
    expect(profile.sources.get("BBC")!).toBeGreaterThan(profile.sources.get("Old Times")!);
  });
});

describe("recommend", () => {
  const profile = buildProfile(Array.from({ length: 6 }, () => event()), now);

  it("ranks unread articles matching the reader's interests first, with a reason", () => {
    const items = [
      story("1", "Football results", "ESPN", "US", "sports"),
      story("2", "Iran Hormuz tanker standoff", "Al Jazeera", "ME", "world"),
      story("3", "BBC analysis of world markets", "BBC", "GB", "world"),
    ];
    const recs = recommend(profile, items, new Set(), now);
    expect(recs[0].item.article.id).toBe("2");
    expect(recs[0].reason).toContain("Iran");
    expect(recs.map((r) => r.item.article.id)).not.toContain("1");
  });

  it("skips read and stale articles and duplicates", () => {
    const fresh = story("2", "Iran Hormuz standoff", "Al Jazeera", "ME", "world");
    const items = [fresh, { ...fresh, panelId: "q" }, story("4", "Iran Hormuz history", "BBC", "GB", "world", hoursAgo(50)), story("5", "Iran talks", "BBC", "GB", "world")];
    const recs = recommend(profile, items, new Set(["5"]), now);
    expect(recs.map((r) => r.item.article.id)).toEqual(["2"]);
  });

  it("returns nothing when the profile is not ready", () => {
    expect(recommend(buildProfile([], now), [story("2", "Iran Hormuz", "BBC", "GB")], new Set(), now)).toEqual([]);
  });
});

describe("suggestPanels", () => {
  it("suggests countries in a continent the reader follows but has no panel for", () => {
    const events = Array.from({ length: 6 }, () => event({ country: "AE", source: "The National" }));
    const panels: Panel[] = [{ id: "p", country: "AE", category: "top", feedIds: [], customUrls: [], limit: 10 }];
    const suggestions = suggestPanels(buildProfile(events, now), panels);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.every((s) => s.country !== "AE")).toBe(true);
    expect(suggestions[0]).toMatchObject({ category: "top" });
    expect(suggestions[0].reason).toContain("중동");
  });

  it("suggests nothing for a reader without a profile", () => {
    expect(suggestPanels(buildProfile([], now), [])).toEqual([]);
  });
});
