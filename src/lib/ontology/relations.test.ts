import { describe, expect, it } from "vitest";
import type { BoardEvent } from "@/types/world";
import { interestMatrix, relationPairs, type RelationEventInput } from "./relations";

type A = Omit<RelationEventInput["actors"][number], "role">;
const US: A = { id: "country:US", nameKo: "미국", kind: "country" };
const CN: A = { id: "country:CN", nameKo: "중국", kind: "country" };
const KR: A = { id: "country:KR", nameKo: "한국", kind: "country" };
const UN: A = { id: "actor:org:un", nameKo: "유엔", kind: "org" };

let n = 0;
const ev = (type: RelationEventInput["type"], actors: RelationEventInput["actors"], lastSeenAt = "2026-11-07T00:00:00Z"): RelationEventInput => ({
  id: `event:${++n}`,
  title: `사건 ${n}`,
  type,
  lastSeenAt,
  actors,
});
const s = (a: A) => ({ ...a, role: "subject" as const });
const t = (a: A) => ({ ...a, role: "target" as const });
const p = (a: A) => ({ ...a, role: "participant" as const });

describe("relationPairs", () => {
  it("갈등·협력을 세고 행동을 말보다 무겁게 온도를 매긴다", () => {
    const pairs = relationPairs([
      ev("sanction", [s(US), t(CN)]), // 갈등 행동 2
      ev("verbal-conflict", [s(CN), t(US)]), // 갈등 말 1
      ev("diplomacy", [s(US), t(CN)]), // 협력 말 1
    ]);
    expect(pairs).toHaveLength(1);
    const [pair] = pairs;
    expect([pair.a.id, pair.b.id].sort()).toEqual(["country:CN", "country:US"]);
    expect(pair).toMatchObject({ conflict: 2, cooperation: 1 });
    // (1 - 3) / 4
    expect(pair.temperature).toBeCloseTo(-0.5);
    expect(pair.events).toHaveLength(3);
  });

  it("축이 없는 사건(경제·재난 등)은 세지 않고, 사건이 적은 쌍은 뺀다", () => {
    expect(relationPairs([ev("economy", [s(US), t(CN)]), ev("economy", [s(US), t(CN)])])).toEqual([]);
    expect(relationPairs([ev("sanction", [s(US), t(KR)])])).toEqual([]);
  });

  it("주체가 없으면 참여자끼리, 같은 행위자는 한 번만, 행위자가 너무 많은 사건은 뺀다", () => {
    const pairs = relationPairs([
      ev("cooperation", [p(KR), p(US), s(KR)]),
      ev("diplomacy", [p(KR), p(US)]),
      ev("armed-conflict", [s(US), t(CN), t(KR), t(UN), p({ ...UN, id: "a1" }), p({ ...UN, id: "a2" }), p({ ...UN, id: "a3" })]),
    ]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toMatchObject({ cooperation: 2, conflict: 0, temperature: 1 });
  });

  it("둘 다 주체(같은 편)인 쌍은 관계로 세지 않는다 — 트럼프 ↔ 미국 잡음", () => {
    const TRUMP: A = { id: "actor:person:donald trump", nameKo: "도널드 트럼프", kind: "person" };
    const pairs = relationPairs([ev("sanction", [s(TRUMP), s(US), t(CN)]), ev("sanction", [s(TRUMP), s(US), t(CN)])]);
    const names = pairs.map((x) => [x.a.nameKo, x.b.nameKo].sort().join("-"));
    expect(names).toContain("도널드 트럼프-중국");
    expect(names).toContain("미국-중국");
    expect(names).not.toContain("도널드 트럼프-미국");
  });

  it("무게가 큰 쌍이 먼저, 근거는 최신순으로 자른다", () => {
    const pairs = relationPairs([
      ev("verbal-conflict", [s(KR), t(UN)]),
      ev("verbal-conflict", [s(KR), t(UN)]),
      ev("armed-conflict", [s(US), t(CN)], "2026-11-01T00:00:00Z"),
      ev("armed-conflict", [s(US), t(CN)], "2026-11-06T00:00:00Z"),
    ]);
    expect(pairs.map((x) => x.a.id + x.b.id)).toEqual(["country:CNcountry:US", "actor:org:uncountry:KR"]);
    expect(pairs[0].events[0].lastSeenAt).toBe("2026-11-06T00:00:00Z");
  });
});

const be = (reporting: string[], occurs: string[]) => ({ reporting, occurs }) as Pick<BoardEvent, "reporting" | "occurs">;

describe("interestMatrix", () => {
  it("보도 나라 × 일어난 나라를 세고 자기 나라는 뺀다", () => {
    const m = interestMatrix([be(["KR", "JP", "US"], ["US"]), be(["KR"], ["US", "KR"]), be(["KR", "US"], ["JP"])]);
    const at = (r: string, c: string) => m.counts[m.reporters.indexOf(r)][m.targets.indexOf(c)];
    expect(m.reporters[0]).toBe("KR");
    expect(m.targets[0]).toBe("US");
    expect(at("KR", "US")).toBe(2);
    expect(at("KR", "JP")).toBe(1);
    expect(at("JP", "US")).toBe(1);
    expect(at("US", "JP")).toBe(1);
    expect(m.targets).not.toContain("KR");
  });

  it("한국 매체 줄은 상위에 없어도 항상 넣는다 (보는 사람이 한국)", () => {
    const codes = "AA BB CC DD EE FF GG HH".split(" ");
    const m = interestMatrix([...codes.flatMap((c) => [be([c], ["ZZ"]), be([c], ["YY"])]), be(["KR"], ["ZZ"])]);
    expect(m.reporters).toHaveLength(8);
    expect(m.reporters).toContain("KR");
    expect(m.counts[m.reporters.indexOf("KR")][m.targets.indexOf("ZZ")]).toBe(1);
  });

  it("나라 수를 규칙 숫자로 자른다", () => {
    const codes = "AA BB CC DD EE FF GG HH II JJ".split(" ");
    const m = interestMatrix(codes.map((c) => be([c], ["ZZ"])));
    expect(m.reporters).toHaveLength(8);
    expect(m.targets).toEqual(["ZZ"]);
  });
});
