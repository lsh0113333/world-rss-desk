import { describe, expect, it } from "vitest";
import type { Article } from "@/types/article";
import type { Panel } from "@/types/layout";
import { ruleEngine, toStoryItems } from "./insights";

const art = (id: string, title: string, source: string): Article => ({ id, title, link: `https://example.com/${id}`, publishedAt: null, source });
const panel = (extra: Partial<Panel>): Panel => ({ id: "p", feedIds: [], customUrls: [], limit: 10, ...extra });

describe("toStoryItems", () => {
  it("tags articles with their panel, category and the outlet's catalog country", () => {
    const panels = [
      panel({ id: "kr", country: "KR", category: "economy", feedIds: ["kr-yonhap-economy"] }),
      // 사용자 구성 패널: 나라 없이 여러 나라 매체를 섞은 경우 매체의 카탈로그 나라를 쓴다
      panel({ id: "mix", feedIds: ["gb-bbc-top", "us-npr-top"] }),
    ];
    const items = toStoryItems(panels, {
      kr: [art("1", "환율 급등", "연합뉴스")],
      mix: [art("2", "UK news", "BBC News"), art("3", "Custom", "Unknown Blog")],
    });
    expect(items.map((i) => [i.article.id, i.panelId, i.country, i.category])).toEqual([
      ["1", "kr", "KR", "economy"],
      ["2", "mix", "GB", undefined],
      ["3", "mix", undefined, undefined],
    ]);
  });

  it("skips panels without loaded articles", () => {
    expect(toStoryItems([panel({ id: "a" })], {})).toEqual([]);
  });
});

describe("ruleEngine", () => {
  it("returns clusters and issues for the same items", () => {
    const result = ruleEngine([], new Date());
    expect(result).toEqual({ clusters: [], issues: [] });
  });
});
