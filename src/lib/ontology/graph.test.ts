import { describe, expect, it } from "vitest";
import { inList, isValidLink, nodeTypeOf } from "./graph";

describe("nodeTypeOf", () => {
  it("id 앞부분으로 종류를 안다", () => {
    expect(nodeTypeOf("event:20261101-ab")).toBe("event");
    expect(nodeTypeOf("actor:person:elon musk")).toBe("actor");
    expect(nodeTypeOf("article:abc")).toBe("article");
    expect(nodeTypeOf("country:KR")).toBe("country");
    expect(nodeTypeOf("weird")).toBeNull();
    expect(nodeTypeOf("alien:x")).toBeNull();
  });
});

describe("isValidLink", () => {
  it("설정에 맞는 관계만 통과", () => {
    expect(isValidLink("reports", "article:1", "event:2")).toBe(true);
    expect(isValidLink("subject", "event:1", "country:US")).toBe(true);
    expect(isValidLink("subject", "event:1", "actor:org:un")).toBe(true);
    expect(isValidLink("part_of", "event:1", "flow:ukraine")).toBe(true);
    expect(isValidLink("reports", "event:1", "article:2")).toBe(false);
    expect(isValidLink("occurs_in", "event:1", "actor:org:un")).toBe(false);
    expect(isValidLink("nonsense", "event:1", "event:2")).toBe(false);
  });
});

describe("inList", () => {
  it("공백·따옴표가 있어도 안전한 PostgREST in 필터", () => {
    expect(inList(["event:1", "actor:person:elon musk"])).toBe(`in.(${encodeURIComponent('"event:1"')},${encodeURIComponent('"actor:person:elon musk"')})`);
    expect(inList(['a"b'])).toContain(encodeURIComponent('"a\\"b"'));
  });
});
