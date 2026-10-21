import { describe, expect, it } from "vitest";
import type { Article } from "@/types/article";
import type { CatalogFeed } from "@/types/catalog";
import type { FrontCountry } from "@/types/front";
import { CATALOG } from "./catalog";
import { NEWSSTAND_CONTINENTS, buildFront, countryMeta, leadOf, selectOutlets } from "./newsstand";

function feed(p: Partial<CatalogFeed> & Pick<CatalogFeed, "id" | "name" | "country" | "continent" | "category">): CatalogFeed {
  return { url: `https://${p.id}.example.com/rss`, homepage: `https://${p.id}.example.com`, language: "en", ...p };
}

function article(id: string, publishedAt: string | null): Article {
  return { id, title: `제목 ${id}`, link: `https://news.example.com/${id}`, publishedAt, source: "매체" };
}

describe("selectOutlets", () => {
  it("매체(나라 + 이름)마다 피드 하나만 고르고, 종합 → 국제 → 정치 순으로 우선한다", () => {
    const picks = selectOutlets([
      feed({ id: "kr-a-economy", name: "A일보", country: "KR", continent: "asia", category: "economy" }),
      feed({ id: "kr-a-top", name: "A일보", country: "KR", continent: "asia", category: "top" }),
      feed({ id: "kr-b-politics", name: "B경제", country: "KR", continent: "asia", category: "politics" }),
      feed({ id: "kr-b-world", name: "B경제", country: "KR", continent: "asia", category: "world" }),
    ]);
    expect(picks.map((p) => p.feed.id)).toEqual(["kr-a-top", "kr-b-world"]);
    expect(picks[0]).toMatchObject({ continent: "asia", country: "KR", name: "A일보" });
  });

  it("국제 구역 매체는 뺀다", () => {
    const picks = selectOutlets([
      feed({ id: "world-bbc-world", name: "BBC News", country: "WORLD", continent: "global", category: "world" }),
      feed({ id: "world-wired-tech", name: "WIRED", country: "WORLD", continent: "global", category: "tech" }),
    ]);
    expect(picks).toEqual([]);
  });

  it("묶음 지역 매체는 본사 나라로 옮기고, 그 나라에 이미 있으면 합친다", () => {
    const picks = selectOutlets([
      feed({ id: "me-aljazeera-top", name: "Al Jazeera", country: "ME", continent: "middle-east", category: "top" }),
      feed({ id: "eu-politico-politics", name: "Politico Europe", country: "EU", continent: "europe", category: "politics" }),
      feed({ id: "eu-politico-tech", name: "POLITICO Europe", country: "EU", continent: "europe", category: "tech" }),
      feed({ id: "de-dw-top", name: "DW", country: "DE", continent: "europe", category: "top" }),
      feed({ id: "eu-dw-top", name: "DW", country: "EU", continent: "europe", category: "top" }),
      feed({ id: "africa-bbc-top", name: "BBC News", country: "AFRICA", continent: "africa", category: "top" }),
    ]);
    // 원래 그 나라 피드를 먼저 고르고, 옮겨 온 매체는 뒤에
    expect(picks.map((p) => [p.feed.id, p.country, p.continent])).toEqual([
      ["de-dw-top", "DE", "europe"],
      ["me-aljazeera-top", "QA", "middle-east"],
      ["eu-politico-politics", "BE", "europe"],
    ]);
  });

  it("실제 카탈로그: 국제·묶음 지역 코드가 남지 않고, 모든 나라에 이름과 시간대가 있다", () => {
    const picks = selectOutlets(CATALOG);
    expect(picks.length).toBeGreaterThan(100);
    for (const p of picks) {
      expect(["WORLD", "EU", "ME", "ASIA", "LATAM", "AFRICA"]).not.toContain(p.country);
      expect(p.continent).not.toBe("global");
      const meta = countryMeta(p.country);
      expect(meta?.name, p.country).toBeTruthy();
      expect(meta?.timeZone, p.country).toBeTruthy();
    }
    const keys = picks.map((p) => `${p.country}|${p.name.toLowerCase()}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("NEWSSTAND_CONTINENTS", () => {
  it("대륙 7개, 국제 없음", () => {
    expect(NEWSSTAND_CONTINENTS.map((c) => c.id)).toEqual(["asia", "europe", "north-america", "south-america", "middle-east", "africa", "oceania"]);
  });
});

describe("buildFront", () => {
  const picks = selectOutlets([
    feed({ id: "kr-a-top", name: "A일보", country: "KR", continent: "asia", category: "top" }),
    feed({ id: "jp-b-top", name: "B Times", country: "JP", continent: "asia", category: "top" }),
    feed({ id: "jp-c-top", name: "C News", country: "JP", continent: "asia", category: "top" }),
    feed({ id: "us-d-top", name: "D Post", country: "US", continent: "north-america", category: "top" }),
  ]);

  it("대륙 → 나라 → 매체로 묶고, 매체가 많은 나라부터, 제목은 최신순으로 정해진 개수만", () => {
    const results = new Map<string, Article[]>([
      ["kr-a-top", [article("k1", "2026-10-22T01:00:00Z"), article("k2", "2026-10-22T03:00:00Z"), article("k3", null)]],
      ["jp-b-top", [article("b1", "2026-10-22T02:00:00Z")]],
      ["jp-c-top", [article("c1", "2026-10-22T02:30:00Z")]],
      ["us-d-top", []],
    ]);
    const front = buildFront(picks, results, 2);
    expect(front.map((c) => c.id)).toEqual(["asia"]);
    const asia = front[0];
    expect(asia.label).toBe("아시아");
    expect(asia.countries.map((c) => c.code)).toEqual(["JP", "KR"]);
    expect(asia.countries[1]).toMatchObject({ name: "한국", timeZone: "Asia/Seoul" });
    expect(asia.countries[1].outlets[0].items.map((i) => i.id)).toEqual(["k2", "k1"]);
    expect(asia.countries[1].outlets[0]).toMatchObject({ name: "A일보", homepage: "https://kr-a-top.example.com", language: "en" });
  });

  it("실패했거나 기사가 없는 매체는 빼고, 매체가 하나도 없는 나라·대륙도 뺀다", () => {
    const front = buildFront(picks, new Map([["kr-a-top", [article("k1", null)]]]), 3);
    expect(front).toHaveLength(1);
    expect(front[0].countries.map((c) => c.code)).toEqual(["KR"]);
  });
});

describe("leadOf", () => {
  it("나라 매체들의 첫 기사 중 가장 최근 것을 1면으로", () => {
    const country: FrontCountry = {
      code: "JP",
      name: "일본",
      timeZone: "Asia/Tokyo",
      outlets: [
        { name: "B", homepage: "", language: "en", items: [{ id: "b1", title: "b1", link: "https://x/b1", publishedAt: "2026-10-22T02:00:00Z" }] },
        { name: "C", homepage: "", language: "en", items: [{ id: "c1", title: "c1", link: "https://x/c1", publishedAt: "2026-10-22T02:30:00Z" }] },
      ],
    };
    expect(leadOf(country)).toEqual({ outlet: "C", item: country.outlets[1].items[0] });
  });

  it("날짜가 없으면 첫 매체의 첫 기사", () => {
    const country: FrontCountry = {
      code: "KR",
      name: "한국",
      timeZone: "Asia/Seoul",
      outlets: [{ name: "A", homepage: "", language: "ko", items: [{ id: "a1", title: "a1", link: "https://x/a1", publishedAt: null }] }],
    };
    expect(leadOf(country)?.item.id).toBe("a1");
  });
});
