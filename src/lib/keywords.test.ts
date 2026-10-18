import { describe, expect, it } from "vitest";
import { extractTerms, tokenize } from "./keywords";

describe("tokenize", () => {
  it("keeps the original spelling for display and a lowercase key", () => {
    expect(tokenize("Iran closes Strait of Hormuz")).toEqual([
      { key: "iran", display: "Iran" },
      { key: "closes", display: "closes" },
      { key: "strait", display: "Strait" },
      { key: "hormuz", display: "Hormuz" },
    ]);
  });

  it("drops headline stopwords, numbers and short words", () => {
    const keys = tokenize("Live: What we know so far about the 2026 vote in US").map((t) => t.key);
    expect(keys).toEqual(["vote"]);
  });

  it("keeps two-letter acronyms written in capitals", () => {
    const keys = tokenize("EU and UN warn on AI rules").map((t) => t.key);
    expect(keys).toEqual(["eu", "un", "warn", "ai", "rules"]);
  });

  it("strips possessives and trailing punctuation", () => {
    expect(tokenize("Nvidia's results — 'record' quarter").map((t) => t.key)).toEqual(["nvidia", "results", "record", "quarter"]);
  });

  it("strips Korean particles and drops common Korean headline words", () => {
    const keys = tokenize("[속보] 호르무즈 해협 봉쇄에 유가가 급등했다").map((t) => t.key);
    expect(keys).toEqual(["호르무즈", "해협", "봉쇄", "유가", "급등"]);
  });

  it("does not strip a particle-like ending from a two-syllable word", () => {
    expect(tokenize("미국 대통령").map((t) => t.key)).toEqual(["미국", "대통령"]);
  });
});

describe("extractTerms", () => {
  it("returns unique keys in order", () => {
    expect(extractTerms("Iran says Iran will reopen Hormuz")).toEqual(["iran", "reopen", "hormuz"]);
  });
});
