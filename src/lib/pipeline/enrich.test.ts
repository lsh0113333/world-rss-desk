import { describe, expect, it } from "vitest";
import {
  buildEnrichPrompt,
  entityId,
  insightInputHash,
  parseEnrichment,
  selectForEnrichment,
  type EnrichInput,
} from "./enrich";

const NOW = new Date("2026-10-19T12:00:00Z");

const input: EnrichInput = {
  storyId: "s-1",
  articles: [
    { id: "art-gb", title: "Iran seizes tanker near Hormuz", source: "BBC", country: "GB", summary: "Navy confirms." },
    { id: "art-us", title: "Oil jumps after Hormuz seizure", source: "CNBC", country: "US" },
    { id: "art-me", title: "Tehran says tanker violated rules", source: "Al Jazeera", country: "ME" },
  ],
};

describe("insightInputHash", () => {
  it("기사 순서와 무관하게 같은 값", () => {
    expect(insightInputHash(["b", "a", "c"])).toBe(insightInputHash(["c", "b", "a"]));
    expect(insightInputHash(["a"])).not.toBe(insightInputHash(["a", "b"]));
  });
});

describe("selectForEnrichment", () => {
  const story = (id: string, score: number, ids = ["x", "y"]) => ({ id, score, articleIds: ids });

  it("AI 결과가 없는 사건을 점수순으로 고른다", () => {
    const picked = selectForEnrichment([story("a", 5), story("b", 9)], new Map(), NOW, { max: 1 });
    expect(picked.map((s) => s.id)).toEqual(["b"]);
  });

  it("기사가 바뀌지 않았으면 다시 돌리지 않는다", () => {
    const existing = new Map([["a", { inputHash: insightInputHash(["x", "y"]), generatedAt: "2026-10-18T00:00:00Z" }]]);
    expect(selectForEnrichment([story("a", 5)], existing, NOW)).toEqual([]);
  });

  it("기사가 바뀌었어도 최근(3시간 안)에 돌렸으면 건너뛴다", () => {
    const existing = new Map([["a", { inputHash: "old", generatedAt: "2026-10-19T11:00:00Z" }]]);
    expect(selectForEnrichment([story("a", 5)], existing, NOW)).toEqual([]);
  });

  it("기사가 바뀌고 오래됐으면 다시 돌린다", () => {
    const existing = new Map([["a", { inputHash: "old", generatedAt: "2026-10-19T06:00:00Z" }]]);
    expect(selectForEnrichment([story("a", 5)], existing, NOW).map((s) => s.id)).toEqual(["a"]);
  });
});

describe("buildEnrichPrompt", () => {
  it("사건 id와 기사 참조 번호, 나라, 매체를 담는다", () => {
    const prompt = buildEnrichPrompt([input]);
    expect(prompt).toContain("s-1");
    expect(prompt).toContain("[r1] (GB · BBC) Iran seizes tanker near Hormuz");
    expect(prompt).toContain("[r3] (ME · Al Jazeera)");
    expect(prompt).toContain("Navy confirms.");
    expect(prompt).toMatch(/한국어/);
  });
});

describe("parseEnrichment", () => {
  const good = {
    stories: [
      {
        id: "s-1",
        title_ko: "이란, 호르무즈 해협서 유조선 나포",
        summary_ko: ["이란이 유조선을 나포했다.", "유가가 올랐다.", "긴장이 커진다.", "넷째 줄은 버린다"],
        why_ko: "한국 원유 수입의 상당량이 지나는 길목이다.",
        perspectives: [
          { country: "US", angle_ko: "유가·시장 영향에 집중", refs: ["r2"] },
          { country: "ME", angle_ko: "이란 측 규정 위반 주장 전달", refs: ["r3", "r99"] },
          { country: "KR", angle_ko: "사건에 없는 나라", refs: ["r1"] },
          { country: "GB", angle_ko: "근거 없음", refs: ["r42"] },
        ],
        entities: [
          { name: "Iran", name_ko: "이란", type: "place" },
          { name: "Strait of Hormuz", type: "place" },
          { name: "Bad", type: "alien" },
        ],
      },
      { id: "s-unknown", title_ko: "모르는 사건" },
    ],
  };

  it("한국어 제목·요약(최대 3줄)·이유를 꺼낸다", () => {
    const out = parseEnrichment(good, [input]);
    const r = out.get("s-1")!;
    expect(r.title).toBe("이란, 호르무즈 해협서 유조선 나포");
    expect(r.summary).toHaveLength(3);
    expect(r.why).toContain("원유");
  });

  it("관점의 참조 번호를 실제 기사 id로 바꾸고, 없는 참조·사건에 없는 나라·근거 없는 관점은 버린다", () => {
    const r = parseEnrichment(good, [input]).get("s-1")!;
    expect(r.perspectives).toEqual([
      { country: "US", angle: "유가·시장 영향에 집중", articleIds: ["art-us"] },
      { country: "ME", angle: "이란 측 규정 위반 주장 전달", articleIds: ["art-me"] },
    ]);
  });

  it("엔티티는 알려진 종류만, id는 종류:소문자 이름", () => {
    const r = parseEnrichment(good, [input]).get("s-1")!;
    expect(r.entities).toEqual([
      { id: "place:iran", name: "Iran", nameKo: "이란", type: "place" },
      { id: "place:strait of hormuz", name: "Strait of Hormuz", type: "place" },
    ]);
  });

  it("입력에 없는 사건은 무시한다", () => {
    expect(parseEnrichment(good, [input]).has("s-unknown")).toBe(false);
  });

  it("제목이 없거나 형식이 틀리면 그 사건은 버린다", () => {
    expect(parseEnrichment({ stories: [{ id: "s-1", summary_ko: ["x"] }] }, [input]).size).toBe(0);
    expect(parseEnrichment("nonsense", [input]).size).toBe(0);
    expect(parseEnrichment(null, [input]).size).toBe(0);
  });
});

describe("entityId", () => {
  it("공백을 정리하고 소문자로", () => {
    expect(entityId("org", "  Bank  of Korea ")).toBe("org:bank of korea");
  });
});
