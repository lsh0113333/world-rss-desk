// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { generateJson } from "./gemini";

const ok = (text: string) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "생각", thought: true }, { text }] } }] }), { status: 200 });

describe("generateJson", () => {
  it("모델 엔드포인트에 JSON 스키마 출력으로 요청하고 결과 JSON을 돌려준다", async () => {
    const fetchMock = vi.fn(async () => ok('{"stories":[]}'));
    const out = await generateJson({ apiKey: "key", models: ["m1"], prompt: "p", schema: { type: "OBJECT" }, fetch: fetchMock });
    expect(out).toEqual({ value: { stories: [] }, model: "m1" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/m1:generateContent");
    expect(init.headers["x-goog-api-key"]).toBe("key");
    const body = JSON.parse(init.body as string);
    expect(body.contents[0].parts[0].text).toBe("p");
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig.responseSchema).toEqual({ type: "OBJECT" });
  });

  it("429·503은 잠시 기다렸다 다시 시도한다", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response("busy", { status: 503 })).mockResolvedValueOnce(ok("{}"));
    const sleep = vi.fn(async () => {});
    const out = await generateJson({ apiKey: "k", models: ["m1"], prompt: "p", schema: {}, fetch: fetchMock, sleep });
    expect(out.model).toBe("m1");
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it("한 모델의 한도가 다 차면 다음 모델로 넘어간다", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => (String(url).includes("/m1:") ? new Response("quota", { status: 429 }) : ok('{"a":1}')));
    const out = await generateJson({ apiKey: "k", models: ["m1", "m2"], prompt: "p", schema: {}, fetch: fetchMock, sleep: async () => {} });
    expect(out).toEqual({ value: { a: 1 }, model: "m2" });
  });

  it("400 같은 요청 오류는 재시도하지 않고 던진다 (키는 메시지에 넣지 않는다)", async () => {
    const fetchMock = vi.fn(async () => new Response("bad request", { status: 400 }));
    await expect(generateJson({ apiKey: "secret-key", models: ["m1"], prompt: "p", schema: {}, fetch: fetchMock })).rejects.toThrow(
      /Gemini m1 400/,
    );
    await expect(generateJson({ apiKey: "secret-key", models: ["m1"], prompt: "p", schema: {}, fetch: fetchMock })).rejects.not.toThrow(
      /secret-key/,
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("JSON이 아닌 응답은 오류", async () => {
    const fetchMock = vi.fn(async () => ok("not json"));
    await expect(generateJson({ apiKey: "k", models: ["m1"], prompt: "p", schema: {}, fetch: fetchMock })).rejects.toThrow(/JSON/);
  });
});
