import { describe, expect, it } from "vitest";
import { EVENT_TYPES, RULES, type EventType } from "@/ontology/world";
import type { BoardActor, BoardArticle, BoardEvent, EventFact } from "@/types/world";
import { applyMultipliers, buildBoard, diffBoards, multipliersFromConfig, parseMultipliers, rankWorld, scoreEvent, triplesOf } from "./rules";

const NOW = new Date("2026-11-01T12:00:00Z");
const ago = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000).toISOString();

let seq = 0;
function art(country: string, source: string, hours = 1): BoardArticle {
  seq++;
  return { id: `a${seq}`, title: `기사 ${seq}`, link: `https://x.example/${seq}`, source, country, publishedAt: ago(hours) };
}

const actor = (id: string, nameKo: string, kind: BoardActor["kind"], role: BoardActor["role"]): BoardActor => ({ id, name: nameKo, nameKo, kind, role });

function fact(id: string, type: EventType, articles: BoardArticle[], extra: Partial<EventFact> = {}): EventFact {
  return { id, type, title: `제목 ${id}`, summary: `요약 ${id}`, flow: null, actors: [], occurs: [], firstSeenAt: ago(5), articles, ...extra };
}

/** n개 나라에서 각각 매체 하나씩 보도 */
const spread = (countries: string[], hours = 7) => countries.map((c, i) => art(c, `매체${c}${i}`, hours));
const stats = { articles: 100, clusters: 10, feedsOk: 10, feedsFailed: 0, extracted: 5 };
const ids = (events: { id: string }[]) => events.map((e) => e.id);

describe("scoreEvent", () => {
  it("점수 = (3×나라 + 2×대륙 + 매체(최대 10)) × 유형 배수 + 떠오름", () => {
    const s = scoreEvent({ countries: 4, continents: 2, outlets: 5, rising: false }, "tech", multipliersFromConfig());
    expect(s).toEqual({ countries: 4, continents: 2, outlets: 5, scale: 21, multiplier: 2, risingBonus: 0, total: 42 });
    const r = scoreEvent({ countries: 2, continents: 1, outlets: 30, rising: true }, "crime", multipliersFromConfig());
    expect(r.outlets).toBe(30);
    expect(r.scale).toBe(3 * 2 + 2 * 1 + RULES.outletCap);
    expect(r.total).toBe(18 + RULES.risingBonus);
  });

  it("같은 규모면 IT가 무력 충돌보다, 무력 충돌이 범죄보다 높다", () => {
    const m = multipliersFromConfig();
    const n = { countries: 5, continents: 3, outlets: 5, rising: false };
    expect(scoreEvent(n, "tech", m).total).toBeGreaterThan(scoreEvent(n, "armed-conflict", m).total);
    expect(scoreEvent(n, "armed-conflict", m).total).toBeGreaterThan(scoreEvent(n, "crime", m).total);
  });
});

describe("buildBoard: 세계 5", () => {
  it("2개 이상 나라가 보도한 사건만, 점수순", () => {
    const board = buildBoard(
      [
        fact("big", "armed-conflict", spread(["US", "GB", "JP", "KR"])),
        fact("small", "economy", spread(["US", "GB"])),
        fact("local", "politics", [art("KR", "연합", 7), art("KR", "한경", 7)]),
      ],
      NOW,
      stats,
    );
    expect(board.world).toEqual(["big", "small"]);
    expect(board.events.find((e) => e.id === "local")?.scope).toBe("country");
  });

  it("스포츠·연예는 아무리 커도 세계 5에 없다", () => {
    expect(EVENT_TYPES.sports.worldEligible).toBe(false);
    const board = buildBoard(
      [fact("kompany", "sports", spread(["US", "GB", "JP", "KR", "DE", "FR", "IT", "ES"])), fact("war", "armed-conflict", spread(["US", "GB"]))],
      NOW,
      stats,
    );
    expect(board.world).toEqual(["war"]);
  });

  it("최대 5개", () => {
    const many = Array.from({ length: 8 }, (_, i) => fact(`e${i}`, "economy", spread(["US", "GB", "JP"])));
    expect(buildBoard(many, NOW, stats).world).toHaveLength(RULES.worldLimit);
  });

  it("매체 1곳뿐인 사건은 자격 없음", () => {
    const board = buildBoard([fact("one", "tech", [art("US", "혼자", 7), art("US", "혼자", 7)])], NOW, stats);
    expect(board.events).toEqual([]);
  });

  it("12시간 넘게 새 기사가 없으면 내려간다", () => {
    const board = buildBoard([fact("old", "disaster", [art("US", "a", 13), art("GB", "b", 14)]), fact("live", "disaster", [art("US", "a", 11), art("GB", "b", 14)])], NOW, stats);
    expect(ids(board.events)).toEqual(["live"]);
  });

  it("최근 3시간 기사가 그 전 3시간의 2배 이상이면 떠오름", () => {
    const board = buildBoard(
      [
        fact("up", "economy", [art("US", "a", 1), art("GB", "b", 2), art("JP", "c", 4)]),
        fact("flat", "economy", [art("US", "a", 1), art("GB", "b", 4)]),
      ],
      NOW,
      stats,
    );
    const by = new Map(board.events.map((e) => [e.id, e]));
    expect(by.get("up")?.rising).toBe(true);
    expect(by.get("flat")?.rising).toBe(false);
  });
});

describe("buildBoard: IT 5·대륙별", () => {
  it("IT 5는 세계 5와 겹치지 않고 국내 IT도 들어간다", () => {
    const board = buildBoard(
      [
        fact("t1", "tech", spread(["US", "GB", "JP", "KR", "DE"])),
        ...Array.from({ length: 5 }, (_, i) => fact(`w${i}`, "armed-conflict", spread(["US", "GB", "JP", "KR", "DE", "FR", "IT"]))),
        fact("t2", "tech", [art("KR", "전자신문", 7), art("KR", "한경", 7)]),
      ],
      NOW,
      stats,
    );
    expect(board.world).toHaveLength(5);
    expect(board.it).toContain("t2");
    for (const id of board.it) expect(board.world).not.toContain(id);
  });

  it("대륙별은 일어난 곳 기준. 세계 5·IT 5에 나온 사건 다음 것을 올린다", () => {
    const board = buildBoard(
      [
        fact("jo", "armed-conflict", spread(["US", "GB"]), { occurs: ["JO"] }),
        fact("kr1", "politics", [art("KR", "a", 7), art("KR", "b", 7)], { occurs: ["KR"] }),
        fact("kr2", "crime", [art("KR", "a", 7), art("KR", "b", 7)], { occurs: ["KR"] }),
        fact("nowhere", "economy", spread(["US", "GB"])),
      ],
      NOW,
      stats,
    );
    expect(board.continents.find((c) => c.id === "asia")?.top).toEqual(["kr1", "kr2"]);
    // jo는 세계 5에 있으므로 중동 상위에서 빠진다
    expect(board.world).toContain("jo");
    expect(board.continents.find((c) => c.id === "middle-east")?.top).toEqual([]);
    const korea = board.continents.find((c) => c.id === "asia")?.countries.find((c) => c.code === "KR");
    expect(korea?.name).toBe("한국");
    expect(korea?.eventIds).toEqual(["kr1", "kr2"]);
    // 대륙 7개 모두 나온다 (비어 있어도)
    expect(board.continents.map((c) => c.id)).toEqual(["asia", "europe", "north-america", "south-america", "middle-east", "africa", "oceania"]);
    expect(board.continents.find((c) => c.id === "middle-east")?.countries[0].eventIds).toEqual(["jo"]);
  });
});

describe("buildBoard: 같은 사건 합치기", () => {
  it("제목이 거의 같으면 하나로: 기사·행위자·장소를 합치고 처음 본 시각은 더 이른 쪽", () => {
    const iran = actor("country:IR", "이란", "country", "subject");
    const us = actor("country:US", "미국", "country", "target");
    const a = art("US", "CNN", 7);
    const big = fact("big", "tech", [a, art("GB", "BBC", 7), art("JP", "NHK", 7)], { title: "FBI, 바이낸스 암호화폐 해킹 배후로 북한 지목", actors: [iran], occurs: ["KP"], firstSeenAt: ago(3) });
    const small = fact("small", "tech", [a, art("KR", "연합", 7)], { title: "FBI, 바이낸스 해킹 배후로 북한 지목", actors: [iran, us], occurs: ["US"], firstSeenAt: ago(9) });
    const board = buildBoard([small, big], NOW, stats);
    expect(ids(board.events)).toEqual(["big"]);
    const merged = board.events[0];
    expect(merged.articleCount).toBe(4);
    expect(merged.reporting.sort()).toEqual(["GB", "JP", "KR", "US"]);
    expect(merged.actors.map((x) => x.id)).toEqual(["country:IR", "country:US"]);
    expect(merged.occurs).toEqual(["KP", "US"]);
    expect(merged.firstSeenAt).toBe(ago(9));
  });

  it("제목이 다른 사건은 합치지 않는다", () => {
    const board = buildBoard(
      [
        fact("a", "tech", spread(["US", "GB"]), { title: "바이낸스, 해킹 피해 자산의 90% 보전" }),
        fact("b", "tech", spread(["US", "GB"]), { title: "FBI, 바이낸스 해킹 배후로 북한 지목" }),
        fact("c", "protest", spread(["US", "GB"]), { title: "프랑스 전역에서 생활고 시위" }),
        fact("d", "protest", spread(["US", "GB"]), { title: "독일 전역에서 생활고 시위" }),
      ],
      NOW,
      stats,
    );
    expect(board.events).toHaveLength(4);
  });
});

describe("buildBoard: 장소", () => {
  it("장소가 없어도 한 나라 안 사건이면 그 나라, 여러 나라가 보도했으면 모름", () => {
    const board = buildBoard([fact("kr", "politics", [art("KR", "a", 7), art("KR", "b", 7)]), fact("w", "economy", spread(["US", "GB"]))], NOW, stats);
    expect(board.events.find((e) => e.id === "kr")?.occurs).toEqual(["KR"]);
    expect(board.events.find((e) => e.id === "w")?.occurs).toEqual([]);
  });
});

describe("buildBoard: 큰 흐름", () => {
  it("흐름마다 사건을 점수순으로, 추세는 최근 6시간 ÷ 그 전 6시간", () => {
    const board = buildBoard(
      [
        fact("a1", "tech", [art("US", "a", 1), art("GB", "b", 2), art("JP", "c", 3)], { flow: "ai-race" }),
        fact("a2", "tech", [art("US", "a", 8)], { flow: "ai-race" }),
        fact("u1", "armed-conflict", [art("UA", "a", 1), art("GB", "b", 7), art("US", "c", 8), art("DE", "d", 9)], { flow: "ukraine" }),
      ],
      NOW,
      stats,
    );
    const flow = (id: string) => board.flows.find((f) => f.id === id)!;
    expect(board.flows).toHaveLength(8);
    expect(flow("ai-race")).toMatchObject({ eventIds: ["a1"], trend: "up", recentArticles: 3, previousArticles: 0 });
    expect(flow("ukraine")).toMatchObject({ trend: "down", recentArticles: 1, previousArticles: 3 });
    expect(flow("korea")).toMatchObject({ eventIds: [], trend: "quiet" });
  });
});

describe("buildBoard: 연관", () => {
  const us = actor("country:US", "미국", "country", "subject");
  const iran = actor("country:IR", "이란", "country", "target");
  const un = actor("actor:org:un", "유엔", "org", "participant");

  it("같은 큰 흐름이면 연관. 다른 대륙을 우선, 최대 2개", () => {
    const board = buildBoard(
      [
        fact("a", "armed-conflict", spread(["US", "GB"]), { flow: "ukraine", occurs: ["UA"] }),
        fact("b", "diplomacy", spread(["US", "GB"]), { flow: "ukraine", occurs: ["RU"] }),
        fact("c", "sanction", spread(["US", "GB"]), { flow: "ukraine", occurs: ["US"] }),
        fact("d", "economy", spread(["US", "GB"]), { flow: "ukraine", occurs: ["DE"] }),
      ],
      NOW,
      stats,
    );
    const related = board.events.find((e) => e.id === "a")!.related;
    expect(related).toHaveLength(RULES.relatedLimit);
    expect(related[0]).toMatchObject({ id: "c", crossContinent: true, why: "우크라이나 전쟁" });
  });

  it("나라·기관 행위자 공유도 연관, 사람 행위자는 아니다", () => {
    const person = actor("actor:person:x", "엑스", "person", "subject");
    const board = buildBoard(
      [
        fact("a", "sanction", spread(["US", "GB"]), { actors: [iran, person] }),
        fact("b", "diplomacy", spread(["US", "GB"]), { actors: [iran] }),
        fact("c", "economy", spread(["US", "GB"]), { actors: [person] }),
        fact("d", "economy", spread(["US", "GB"])),
        fact("e", "economy", spread(["US", "GB"])),
        fact("f", "economy", spread(["US", "GB"])),
        fact("g", "economy", spread(["US", "GB"])),
        fact("h", "economy", spread(["US", "GB"])),
        fact("i", "economy", spread(["US", "GB"])),
        fact("j", "economy", spread(["US", "GB"])),
        fact("k", "economy", spread(["US", "GB"])),
        fact("l", "economy", spread(["US", "GB"])),
      ],
      NOW,
      stats,
    );
    expect(board.events.find((e) => e.id === "a")!.related.map((r) => [r.id, r.why])).toEqual([["b", "이란"]]);
  });

  it("어디에나 나오는 행위자 하나만 겹치면 연관이 아니지만, 2개 겹치면 연관", () => {
    const board = buildBoard(
      [
        fact("a", "sanction", spread(["US", "GB"]), { actors: [us, un] }),
        fact("b", "diplomacy", spread(["US", "GB"]), { actors: [us] }),
        fact("c", "economy", spread(["US", "GB"]), { actors: [us] }),
        fact("d", "economy", spread(["US", "GB"]), { actors: [us, un] }),
      ],
      NOW,
      stats,
    );
    const related = (id: string) => board.events.find((e) => e.id === id)!.related.map((r) => r.id);
    expect(related("b")).toEqual([]);
    expect(related("a")).toEqual(["d"]);
  });
});

describe("rankWorld: 규칙 실험", () => {
  it("배수를 바꾸면 순위가 바뀐다", () => {
    const board = buildBoard([fact("tech", "tech", spread(["US", "GB"])), fact("war", "armed-conflict", spread(["US", "GB"]))], NOW, stats);
    expect(ids(rankWorld(board.events, multipliersFromConfig()))).toEqual(["tech", "war"]);
    const flipped = { ...multipliersFromConfig(), tech: 0.5 };
    expect(ids(rankWorld(board.events, flipped))).toEqual(["war", "tech"]);
  });
});

describe("applyMultipliers: 내 기준", () => {
  const board = () =>
    buildBoard(
      [
        fact("tech", "tech", spread(["US", "GB"]), { flow: "ai-race", occurs: ["US"] }),
        fact("tech2", "tech", spread(["KR", "JP"]), { flow: "ai-race", occurs: ["US"] }),
        fact("war", "armed-conflict", spread(["US", "GB"]), { occurs: ["US"] }),
        fact("sport", "sports", spread(["US", "GB", "FR", "DE"]), { occurs: ["DE"] }),
      ],
      NOW,
      stats,
    );

  it("세계 5, 점수, 사건 순서를 다시 계산한다", () => {
    const original = board();
    const mine = applyMultipliers(original, { ...multipliersFromConfig(), tech: 0.25 });
    expect(mine.world[0]).toBe("war");
    expect(mine.events.find((e) => e.id === "tech")!.score.multiplier).toBe(0.25);
    expect(mine.generatedAt).toBe(original.generatedAt);
    expect(original.world[0]).not.toBe("war");
  });

  it("스포츠는 배수를 올려도 세계 5에 들어오지 않는다", () => {
    const mine = applyMultipliers(board(), { ...multipliersFromConfig(), sports: 3 });
    expect(mine.world).not.toContain("sport");
    expect(mine.events[0].id).toBe("sport");
  });

  it("IT 5와 흐름, 대륙별도 새 기준을 따른다", () => {
    const wide = ["US", "GB", "FR", "DE", "KR", "JP"];
    const full = buildBoard(
      [
        ...Array.from({ length: 5 }, (_, i) => fact(`politics${i}`, "politics", spread(wide), { occurs: ["KR"] })),
        fact("small-tech", "tech", spread(["US", "GB"]), { occurs: ["US"] }),
        fact("big-tech", "tech", spread(["US", "GB", "FR", "DE"]), { occurs: ["US"] }),
        fact("war", "armed-conflict", spread(["UA", "PL"]), { flow: "ukraine", occurs: ["UA"] }),
        fact("talks", "diplomacy", spread(["UA", "PL"]), { flow: "ukraine", occurs: ["UA"] }),
      ],
      NOW,
      stats,
    );
    expect(full.it).toEqual(["big-tech", "small-tech"]);
    expect(full.flows.find((f) => f.id === "ukraine")!.eventIds).toEqual(["war", "talks"]);

    const mine = applyMultipliers(full, { ...multipliersFromConfig(), tech: 3, "armed-conflict": 0 });
    expect(mine.world).toContain("big-tech");
    expect(mine.it).not.toContain("big-tech");
    expect(mine.flows.find((f) => f.id === "ukraine")!.eventIds).toEqual(["talks", "war"]);
    expect(mine.continents.find((c) => c.id === "europe")!.top).toEqual(["talks", "war"]);
  });
});

describe("parseMultipliers", () => {
  it("모든 유형이 범위 안의 숫자일 때만 받는다", () => {
    const base = multipliersFromConfig();
    expect(parseMultipliers({ ...base, sports: 3 })).toEqual({ ...base, sports: 3 });
    expect(parseMultipliers(base)).toBeNull();
    expect(parseMultipliers({ ...base, sports: RULES.multiplierMax + 1 })).toBeNull();
    expect(parseMultipliers({ ...base, sports: -1 })).toBeNull();
    expect(parseMultipliers({ ...base, sports: "3" })).toBeNull();
    expect(parseMultipliers(null)).toBeNull();
    expect(parseMultipliers({ sports: 3 })).toBeNull();
  });
});

describe("diffBoards: 어제와 달라진 것", () => {
  const previous = (over: Partial<Parameters<typeof diffBoards>[1]> = {}) => ({ world: [], it: [], events: [], ...over });

  it("상위권에 새로 들어온 일과 내려간 일", () => {
    const today = buildBoard([fact("new", "politics", spread(["US", "GB"])), fact("kept", "politics", spread(["FR", "DE"]))], NOW, stats);
    const changes = diffBoards(today, previous({ world: ["kept", "gone"], events: [{ id: "kept", title: "유지", reporting: ["FR", "DE"] }, { id: "gone", title: "어제의 일", reporting: ["KR"] }] }), ago(24));
    expect(changes.comparedTo).toBe(ago(24));
    expect(changes.appeared).toEqual(["new"]);
    expect(changes.faded).toEqual([{ id: "gone", title: "어제의 일" }]);
  });

  it("보도한 나라가 기준만큼 늘면 커진 일, 많이 는 순서로", () => {
    const today = buildBoard(
      [
        fact("small", "politics", spread(["US", "GB", "FR", "DE"])),
        fact("big", "politics", spread(["US", "GB", "FR", "DE", "KR", "JP"])),
        fact("same", "politics", spread(["US", "GB"])),
        fact("sport", "sports", spread(["US", "GB", "FR", "DE", "KR", "JP"])),
      ],
      NOW,
      stats,
    );
    const was = (id: string, reporting: string[]) => ({ id, title: id, reporting });
    const changes = diffBoards(today, previous({ world: today.world, it: today.it, events: [was("small", ["US"]), was("big", ["US"]), was("same", ["US"]), was("sport", ["US"])] }), ago(24));
    expect(changes.grew).toEqual([
      { id: "big", countriesBefore: 1 },
      { id: "small", countriesBefore: 1 },
    ]);
    expect(RULES.changeGrowCountries).toBe(3);
  });

  it("새로 오른 일은 커진 일에 겹쳐 나오지 않고, 칸마다 개수를 제한한다", () => {
    const facts = Array.from({ length: 6 }, (_, i) => fact(`e${i}`, "politics", spread(["US", "GB", "FR", "DE"])));
    const today = buildBoard(facts, NOW, stats);
    const changes = diffBoards(today, previous({ events: facts.map((f) => ({ id: f.id, title: f.id, reporting: ["US"] })) }), ago(24));
    expect(changes.appeared).toHaveLength(RULES.changeLimit);
    expect(changes.grew.every((g) => !today.world.includes(g.id))).toBe(true);
    expect(changes.grew.map((g) => g.id)).toEqual([today.events[5].id]);
  });
});

describe("triplesOf: 관계로 보기", () => {
  const base = { type: "sanction" } as BoardEvent;
  it("주체 → 유형 → 대상", () => {
    const event = { ...base, actors: [actor("country:US", "미국", "country", "subject"), actor("country:CN", "중국", "country", "target"), actor("actor:org:eu", "EU", "org", "participant")] };
    expect(triplesOf(event)).toEqual([
      { from: "미국", relation: "제재·압박", to: "중국" },
      { from: "EU", relation: "참여", to: null },
    ]);
  });

  it("대상이 없으면 주체만", () => {
    expect(triplesOf({ ...base, actors: [actor("country:US", "미국", "country", "subject")] })).toEqual([{ from: "미국", relation: "제재·압박", to: null }]);
  });
});
