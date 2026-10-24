import { describe, expect, it } from "vitest";
import type { StoryItem } from "@/types/insights";
import { findEvents } from "./events";

const NOW = new Date("2026-10-19T12:00:00Z");
let seq = 0;
function item(title: string, source: string, country: string): StoryItem {
  seq++;
  return {
    article: { id: `i${seq}`, title, link: `https://${source}.example/${seq}`, publishedAt: new Date(NOW.getTime() - seq * 60_000).toISOString(), source },
    panelId: "p",
    country,
  };
}

const haines = [
  item("Australian MP Helen Haines critical after ramming attack", "abc", "AU"),
  item("Helen Haines: suspect arrested after car hits MP", "guardian", "GB"),
  item("Albanese condemns attack on Helen Haines", "nzherald", "NZ"),
  item("Independent MP Helen Haines in hospital", "straits", "SG"),
];
// "AI"는 많이 나오지만 서로 다른 일 → 사건 아님
const ai = [
  item("Democrats think cracking down on AI could give them an edge", "politico", "US"),
  item("AI startup raises funding in Bangalore", "et", "IN"),
  item("Korean firms bet on AI chips", "yna", "KR"),
  item("AI tutors arrive in Irish schools", "rte", "IE"),
  item("Gulf states race to build AI data centres", "national", "AE"),
];
const marseille = [
  item("Marseille bans protests as riots spread", "france24", "FR"),
  item("Riots: Marseille bans gatherings, curfew considered", "bbc", "GB"),
  item("Marseille protests ban after nights of riots", "aljazeera", "ME"),
];

describe("findEvents", () => {
  it("구체적인 단어 쌍을 함께 쓰는 여러 나라 기사를 사건으로 묶는다", () => {
    const events = findEvents([...haines, ...ai, ...marseille], NOW);
    const h = events.find((e) => e.terms.includes("haines"))!;
    expect(h.items.map((i) => i.article.id).sort()).toEqual(haines.map((i) => i.article.id).sort());
    expect(h.countries).toHaveLength(4);
    expect(h.label.toLowerCase()).toContain("haines");
  });

  it("흔한 단어 하나만 겹치는 서로 다른 기사는 사건이 아니다", () => {
    const events = findEvents([...haines, ...ai, ...marseille], NOW);
    expect(events.some((e) => e.items.some((i) => ai.includes(i)))).toBe(false);
  });

  it("기사 하나는 사건 하나에만 들어간다", () => {
    const events = findEvents([...haines, ...ai, ...marseille], NOW);
    const ids = events.flatMap((e) => e.items.map((i) => i.article.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("나라가 많은 사건이 앞에 온다", () => {
    const events = findEvents([...marseille, ...haines], NOW);
    expect(events.map((e) => e.terms.includes("haines"))).toEqual([true, false]);
  });

  it("매체 3곳 미만이면 사건이 아니다", () => {
    expect(findEvents(haines.slice(0, 2), NOW)).toEqual([]);
  });

  it("같은 링크는 한 번만", () => {
    const dup = { ...haines[0], panelId: "q" };
    const [e] = findEvents([...haines, dup], NOW);
    expect(e.items).toHaveLength(4);
  });
});

describe("findEvents 흔한 단어", () => {
  it("둘 다 흔한 단어인 쌍으로는 서로 다른 일을 묶지 않는다", () => {
    // "bomb"+"threat"가 들어간 서로 다른 사건 + 흔하게 만들 배경 기사
    const background = Array.from({ length: 30 }, (_, i) => [
      item(`Bomb disposal team trains recruits ${i}`, `bg${i}`, "US"),
      item(`Threat level unchanged says agency ${i}`, `bh${i}`, "GB"),
    ]).flat();
    const mixed = [
      item("Bomb threat diverts Austrian flight to Sofia", "dw", "DE"),
      item("Schools receive bomb threat emails in Belfast", "rte", "IE"),
      item("Bomb threat at Mumbai airport", "toi", "IN"),
    ];
    const events = findEvents([...background, ...mixed], NOW);
    expect(events.some((e) => e.items.some((i) => mixed.includes(i)))).toBe(false);
  });

  it("나라 사건: 기준을 낮추면 한 나라 매체 2곳이 함께 쓴 사건도 찾는다 (온톨로지 v0)", () => {
    const domestic = [
      item("Seoul subway fare hike approved by city council", "yna", "KR"),
      item("City council approves Seoul subway fare hike", "koreaherald", "KR"),
    ];
    expect(findEvents(domestic, NOW).length).toBe(0);
    const events = findEvents(domestic, NOW, { minSources: 2, minCountries: 1 });
    expect(events).toHaveLength(1);
    expect(events[0].countries).toEqual(["KR"]);
  });
});
