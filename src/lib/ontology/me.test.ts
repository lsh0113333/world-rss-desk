import { describe, expect, it } from "vitest";
import type { BoardEvent } from "@/types/world";
import { activeTrips, adviseMe, parseMe } from "./me";

const ev = (id: string, over: Partial<BoardEvent>): BoardEvent =>
  ({
    id,
    type: "society",
    title: id,
    summary: "",
    flow: null,
    actors: [],
    occurs: [],
    reporting: ["KR", "US", "JP"],
    score: { total: 10 },
    ...over,
  }) as BoardEvent;

const EVENTS = [
  ev("protest-fr", { type: "protest", title: "파리 연금 개혁 반대 시위", occurs: ["FR"], score: { total: 20 } as BoardEvent["score"] }),
  ev("hack", { type: "tech", flow: "cyber", title: "대형 해킹", occurs: ["KR"], score: { total: 40 } as BoardEvent["score"] }),
  ev("ai", { type: "tech", flow: "ai-race", title: "새 AI 모델 공개", occurs: ["US"], score: { total: 30 } as BoardEvent["score"] }),
  ev("econ-fr", { type: "economy", title: "프랑스 금리", occurs: ["FR"], score: { total: 50 } as BoardEvent["score"] }),
  ev("war-ua", { type: "armed-conflict", title: "공습", occurs: ["UA"], score: { total: 90 } as BoardEvent["score"] }),
];

describe("parseMe", () => {
  it("알 수 없는 상황·나라·날짜는 버리고, 상황이 없으면 null", () => {
    expect(parseMe({ situations: ["travel", "nope", "travel"], trips: [{ country: "FR", until: "2026-12-01" }, { country: "XX" }, { country: "JP", until: "내일" }] })).toEqual({
      situations: ["travel"],
      trips: [{ country: "FR", until: "2026-12-01" }, { country: "JP" }],
    });
    expect(parseMe({ situations: [], trips: [] })).toBeNull();
    expect(parseMe("이상한 값")).toBeNull();
  });
});

describe("activeTrips", () => {
  it("돌아오는 날이 지난 일정은 뺀다", () => {
    expect(activeTrips([{ country: "FR", until: "2026-11-07" }, { country: "JP", until: "2026-11-08" }, { country: "DE" }], "2026-11-08").map((t) => t.country)).toEqual(["JP", "DE"]);
  });
});

describe("adviseMe", () => {
  it("해외 일정: 일정 나라에서 일어난 위험 유형만 걸리고, 안전이 업무보다 먼저", () => {
    const list = adviseMe({ situations: ["travel", "it-work"], trips: [{ country: "FR" }] }, EVENTS, "2026-11-08");
    expect(list.map((a) => a.eventId)).toEqual(["protest-fr", "hack", "ai"]);
    expect(list[0]).toMatchObject({ ruleId: "travel-protest", situation: "travel" });
    expect(list[0].sentence).toBe("가시는 프랑스에서 파리 연금 개혁 반대 시위 소식이 있어요(3개 나라 보도). 시위 지역을 피해 동선을 짜 보세요.");
    expect(list[0].why).toContain("해외 일정(프랑스)");
    expect(list[0].why).toContain("시위·소요");
  });

  it("IT 업무: 큰 흐름에 맞는 문장 틀, 점수 높은 순", () => {
    const list = adviseMe({ situations: ["it-work"], trips: [] }, EVENTS, "2026-11-08");
    expect(list.map((a) => a.ruleId)).toEqual(["it-cyber", "it-ai"]);
    expect(list[0].sentence).toBe("사이버 보안: 대형 해킹 소식이 있어요(3개 나라 보도). 연계 시스템의 접속 기록과 인증서를 점검해 보세요.");
  });

  it("일정이 끝났거나 걸리는 일이 없으면 빈 목록", () => {
    expect(adviseMe({ situations: ["travel"], trips: [{ country: "FR", until: "2026-11-01" }] }, EVENTS, "2026-11-08")).toEqual([]);
    expect(adviseMe({ situations: ["travel"], trips: [{ country: "BR" }] }, EVENTS, "2026-11-08")).toEqual([]);
  });
});
