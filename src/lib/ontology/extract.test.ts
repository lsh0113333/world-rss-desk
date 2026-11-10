import { describe, expect, it } from "vitest";
import { EVENT_TYPE_IDS, FLOW_IDS } from "@/ontology/world";
import { actorId, buildExtractPrompt, EXTRACT_SCHEMA, parseExtraction, type ExtractInput } from "./extract";

const inputs: ExtractInput[] = [
  {
    cluster: "c1",
    articles: [
      { id: "a1", title: "US sanctions Chinese chipmakers", source: "CNBC", country: "US" },
      { id: "a2", title: "China protests US chip sanctions", source: "SCMP", country: "CN" },
      { id: "a3", title: "Nvidia shares fall", source: "BBC", country: "GB" },
    ],
  },
  {
    cluster: "c2",
    articles: [
      { id: "b1", title: "Quake hits Peru", source: "BBC", country: "GB" },
      { id: "b2", title: "Peru earthquake kills 12", source: "CNN", country: "US" },
    ],
  },
];

const raw = (events: unknown[]) => ({ events });
const good = {
  cluster: "c1",
  type: "sanction",
  title: "미국, 중국 반도체 기업 제재",
  summary: "미국이 중국 반도체 기업을 제재했다.",
  flow: "chips",
  actors: [
    { name: "United States", nameKo: "미국", kind: "country", role: "subject", code: "US" },
    { name: "SMIC", nameKo: "SMIC", kind: "org", role: "target", code: "" },
  ],
  places: ["US", "CN"],
  evidence: ["a1", "a2", "a3"],
};

describe("buildExtractPrompt", () => {
  it("기사 id와 제목, 유형·흐름 목록을 넣고 사실만 옮기라고 지시한다", () => {
    const prompt = buildExtractPrompt(inputs);
    expect(prompt).toContain("(a1)");
    expect(prompt).toContain("US sanctions Chinese chipmakers");
    expect(prompt).toContain("[묶음 c2]");
    for (const id of EVENT_TYPE_IDS) expect(prompt).toContain(id);
    for (const id of FLOW_IDS) expect(prompt).toContain(id);
    expect(prompt).toContain("의견");
    // 사람·기관·집단은 소속 나라 코드 (국제기구·모르면 빈 문자열)
    expect(prompt).toContain("소속 나라");
  });
});

describe("EXTRACT_SCHEMA", () => {
  it("유형은 목록 안에서만", () => {
    const item = EXTRACT_SCHEMA.properties.events.items.properties;
    expect(item.type.enum).toEqual(EVENT_TYPE_IDS);
    expect(item.actors.items.properties.role.enum).toEqual(["subject", "target", "participant"]);
  });
});

describe("parseExtraction", () => {
  it("정상 응답을 묶음별 사건으로", () => {
    const result = parseExtraction(raw([good]), inputs);
    const [event] = result.get("c1")!;
    expect(event).toMatchObject({ type: "sanction", title: "미국, 중국 반도체 기업 제재", flow: "chips", places: ["US", "CN"], evidence: ["a1", "a2", "a3"] });
    expect(event.actors[0]).toEqual({ id: "country:US", name: "United States", nameKo: "미국", kind: "country", role: "subject" });
    expect(event.actors[1]).toEqual({ id: "actor:org:smic", name: "SMIC", nameKo: "SMIC", kind: "org", role: "target" });
  });

  it("사람·기관·집단의 code는 소속 나라. 모르는 코드는 버린다", () => {
    const actors = [
      { name: "Lee Jae-myung", nameKo: "이재명", kind: "person", role: "subject", code: "kr" },
      { name: "Samsung", nameKo: "삼성전자", kind: "org", role: "target", code: "KR" },
      { name: "NATO", nameKo: "나토", kind: "org", role: "participant", code: "ZZ" },
    ];
    const [event] = parseExtraction(raw([{ ...good, actors }]), inputs).get("c1")!;
    expect(event.actors.map((a) => a.country)).toEqual(["KR", "KR", undefined]);
    expect(event.actors[2]).not.toHaveProperty("country");
  });

  it("목록 밖 유형·입력에 없는 묶음·빈 제목은 버린다", () => {
    const result = parseExtraction(raw([{ ...good, type: "gossip" }, { ...good, cluster: "zzz" }, { ...good, title: " " }, "nonsense"]), inputs);
    expect(result.size).toBe(0);
  });

  it("입력에 없는 근거 기사는 지우고, 묶음이 하나의 사건이면 근거가 모자라도 전체 기사로 본다", () => {
    const result = parseExtraction(raw([{ ...good, evidence: ["a1", "fake"] }]), inputs);
    expect(result.get("c1")![0].evidence).toEqual(["a1", "a2", "a3"]);
  });

  it("한 묶음을 여러 사건으로 나누면 각자 근거 2건 이상일 때만 남긴다", () => {
    const result = parseExtraction(
      raw([
        { ...good, title: "사건 A", evidence: ["a1", "a2"] },
        { ...good, title: "사건 B", evidence: ["a3"] },
      ]),
      inputs,
    );
    expect(result.get("c1")!.map((e) => e.title)).toEqual(["사건 A"]);
  });

  it("같은 기사를 두 사건이 쓰면 앞 사건에 준다", () => {
    const result = parseExtraction(
      raw([
        { ...good, title: "사건 A", evidence: ["a1", "a2"] },
        { ...good, title: "사건 B", evidence: ["a2", "a3"] },
      ]),
      inputs,
    );
    expect(result.get("c1")!.map((e) => e.title)).toEqual(["사건 A"]);
  });

  it("모르는 나라 코드·흐름·행위자 종류를 정리한다", () => {
    const result = parseExtraction(
      raw([
        {
          ...good,
          flow: "aliens",
          places: ["us", "ZZ", "JO"],
          actors: [
            { name: "Atlantis", nameKo: "아틀란티스", kind: "country", role: "subject", code: "ZZ" },
            { name: "Bad", nameKo: "나쁨", kind: "martian", role: "subject", code: "" },
            { name: "Bad", nameKo: "나쁨", kind: "org", role: "king", code: "" },
            { name: "", nameKo: "", kind: "org", role: "subject", code: "" },
          ],
        },
      ]),
      inputs,
    );
    const [event] = result.get("c1")!;
    expect(event.flow).toBeNull();
    expect(event.places).toEqual(["US", "JO"]);
    expect(event.actors).toEqual([{ id: "actor:country:atlantis", name: "Atlantis", nameKo: "아틀란티스", kind: "country", role: "subject" }]);
  });

  it("응답 형식이 아니면 빈 결과", () => {
    expect(parseExtraction(null, inputs).size).toBe(0);
    expect(parseExtraction({ events: "x" }, inputs).size).toBe(0);
  });
});

describe("actorId", () => {
  it("나라는 코드로 합치고, 나머지는 영어 이름을 정리해 합친다", () => {
    expect(actorId("country", "United States", "US")).toBe("country:US");
    expect(actorId("person", "  Elon  MUSK. ", "")).toBe("actor:person:elon musk");
    expect(actorId("org", "U.N.", "")).toBe("actor:org:un");
  });
});
