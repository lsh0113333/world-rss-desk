import { describe, expect, it } from "vitest";
import type { StoryItem } from "@/types/insights";
import { findIssues } from "./trending";

const now = new Date("2026-10-18T12:00:00Z");
let seq = 0;
function item(title: string, source: string, country: string, minutesAgo = 120): StoryItem {
  seq += 1;
  return {
    article: {
      id: `a${seq}`,
      title,
      link: `https://example.com/${seq}`,
      publishedAt: new Date(now.getTime() - minutesAgo * 60_000).toISOString(),
      source,
    },
    panelId: "p",
    country,
  };
}

const filler = [
  item("Local bakery wins regional prize", "Paper A", "NZ"),
  item("Rugby coach signs new contract", "Paper B", "IE"),
  item("City council approves park budget", "Paper C", "CA"),
  item("Museum opens dinosaur exhibit", "Paper D", "AU"),
  item("Farmers expect strong harvest", "Paper E", "BR"),
  item("Airline adds route to Lisbon", "Paper F", "PT"),
];

describe("findIssues", () => {
  it("ranks keywords covered by several countries and outlets", () => {
    const items = [
      item("Iran closes Hormuz to tankers", "BBC", "GB", 30),
      item("Oil spikes as Hormuz shut by Iran", "CNBC", "US"),
      item("Hormuz closure: Gulf states react to Iran", "The National", "AE"),
      item("Nvidia earnings beat forecasts", "CNBC", "US"),
      item("Nvidia shares jump after earnings", "Yonhap", "KR"),
      ...filler,
    ];
    const issues = findIssues(items, now);
    expect(issues[0].terms).toEqual(expect.arrayContaining(["hormuz", "iran"]));
    expect(issues[0].label).toMatch(/Hormuz|Iran/);
    expect(issues[0].countries).toEqual(expect.arrayContaining(["GB", "US", "AE"]));
    expect(issues[0].sources).toHaveLength(3);
    expect(issues[0].items).toHaveLength(3);
    expect(issues[0].recent).toBe(1);
    expect(issues[1].terms).toEqual(expect.arrayContaining(["nvidia", "earnings"]));
  });

  it("merges keywords that appear in the same articles into one issue", () => {
    const items = [
      item("Iran closes Hormuz", "BBC", "GB"),
      item("Hormuz shut by Iran", "CNBC", "US"),
      item("Iran Hormuz closure", "The National", "AE"),
      ...filler,
    ];
    const issues = findIssues(items, now);
    expect(issues).toHaveLength(1);
    expect(issues[0].label.split(" · ")).toHaveLength(2);
  });

  it("ignores keywords from a single outlet", () => {
    const items = [item("Hormuz update one", "BBC", "GB"), item("Hormuz update two", "BBC", "GB"), ...filler];
    expect(findIssues(items, now)).toEqual([]);
  });

  it("ignores the same article appearing in two panels", () => {
    const a = item("Hormuz closure deepens", "BBC", "GB");
    const copy = { ...a, panelId: "other", country: "US" };
    expect(findIssues([a, copy, ...filler], now)).toEqual([]);
  });

  it("respects the limit", () => {
    const items = [
      item("Iran closes Hormuz", "BBC", "GB"),
      item("Hormuz shut by Iran", "CNBC", "US"),
      item("Nvidia earnings beat", "CNBC", "US"),
      item("Nvidia earnings surge", "Yonhap", "KR"),
      ...filler,
    ];
    expect(findIssues(items, now, { limit: 1 })).toHaveLength(1);
  });
});
