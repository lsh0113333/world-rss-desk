import { describe, expect, it } from "vitest";
import { CATALOG } from "@/lib/catalog";
import { allCountryCodes, continentOfCountry, CONTINENTS, countryName, isKnownCountry } from "./countries";
import { baseCountry } from "./outlets";
import { EVENT_TYPES, EVENT_TYPE_IDS, FLOWS, LINK_TYPES, OBJECT_TYPES, RULES } from "./world";

describe("온톨로지 설정", () => {
  it("사건 유형 13개. IT가 가장 높고 스포츠·연예는 세계 5 제외", () => {
    expect(EVENT_TYPE_IDS).toHaveLength(13);
    const top = Math.max(...EVENT_TYPE_IDS.map((id) => EVENT_TYPES[id].multiplier));
    expect(EVENT_TYPES.tech.multiplier).toBe(top);
    expect(EVENT_TYPE_IDS.filter((id) => !EVENT_TYPES[id].worldEligible)).toEqual(["sports"]);
  });

  it("큰 흐름 8개, IT 흐름이 앞", () => {
    expect(FLOWS.map((f) => f.id)).toEqual(["ai-race", "chips", "cyber", "bigtech", "ukraine", "mideast", "us-china", "korea"]);
  });

  it("관계의 출발·도착은 정의된 객체 종류만", () => {
    const known = new Set<string>([...Object.keys(OBJECT_TYPES), "article"]);
    for (const link of Object.values(LINK_TYPES)) {
      for (const t of [...link.from, ...link.to]) expect(known.has(t)).toBe(true);
    }
  });

  it("규칙 숫자가 양수", () => {
    expect(RULES.countryWeight).toBeGreaterThan(0);
    expect(RULES.worldLimit).toBe(5);
  });
});

describe("나라·대륙", () => {
  it("대륙 7개, 국제 없음", () => {
    expect(CONTINENTS.map((c) => c.id)).toEqual(["asia", "europe", "north-america", "south-america", "middle-east", "africa", "oceania"]);
  });

  it("매체 없는 나라도 대륙을 안다 (요르단, 베네수엘라)", () => {
    expect(continentOfCountry("JO")).toBe("middle-east");
    expect(continentOfCountry("VE")).toBe("south-america");
    expect(continentOfCountry("MX")).toBe("south-america");
    expect(continentOfCountry("KR")).toBe("asia");
    expect(isKnownCountry("ZZ")).toBe(false);
  });

  it("한국어 이름", () => {
    expect(countryName("KR")).toBe("한국");
    expect(countryName("US")).toBe("미국");
    expect(countryName("JO")).toBe("요르단");
  });

  it("나라 코드가 대륙 하나에만 속한다", () => {
    const codes = allCountryCodes();
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes.length).toBeGreaterThan(180);
  });
});

describe("매체 본사 나라", () => {
  it("묶음·국제 매체를 본사 나라로", () => {
    expect(baseCountry({ country: "ME", name: "Al Jazeera" })).toBe("QA");
    expect(baseCountry({ country: "WORLD", name: "WIRED" })).toBe("US");
    expect(baseCountry({ country: "ASIA", name: "BBC News" })).toBe("GB");
    expect(baseCountry({ country: "KR", name: "연합뉴스" })).toBe("KR");
  });

  it("나라의 시각이 아닌 매체는 null", () => {
    expect(baseCountry({ country: "WORLD", name: "UN News" })).toBeNull();
    expect(baseCountry({ country: "AFRICA", name: "AllAfrica" })).toBeNull();
  });

  it("카탈로그 매체 대부분이 나라를 갖고, 빠지는 것은 정해진 곳뿐", () => {
    const dropped = [...new Set(CATALOG.filter((f) => !baseCountry(f)).map((f) => f.name))].sort();
    expect(dropped).toEqual(["AllAfrica", "UN News"]);
  });
});
