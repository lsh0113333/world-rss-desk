/**
 * Gemini API (무료 티어) 구조화 출력 호출. 파이프라인(GitHub Actions)에서만 쓴다 — 키는 서버 비밀값.
 * 한도(429)·일시 오류(5xx)는 잠깐 기다렸다 재시도하고, 그래도 안 되면 다음 모델(별도 한도)로 넘어간다.
 */

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const TIMEOUT_MS = 90_000;
const RETRIES = 2;
const RETRY_DELAY_MS = 20_000;

/** 무료 티어 Flash-Lite 계열. GEMINI_MODELS(쉼표 구분)로 바꿀 수 있다 */
export const DEFAULT_MODELS = ["gemini-flash-lite-latest", "gemini-2.5-flash-lite", "gemini-flash-latest"];

export interface GenerateOptions {
  apiKey: string;
  models: string[];
  prompt: string;
  schema: object;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
}

class RetryableError extends Error {}

export async function generateJson(opts: GenerateOptions): Promise<{ value: unknown; model: string }> {
  const { apiKey, models, prompt, schema, fetch: fetchImpl = fetch } = opts;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let lastError: Error = new Error("Gemini: 모델이 없습니다");

  for (const model of models) {
    for (let attempt = 0; attempt <= RETRIES; attempt++) {
      try {
        return { value: await call(model), model };
      } catch (err) {
        lastError = err as Error;
        if (!(err instanceof RetryableError)) throw err;
        if (attempt < RETRIES) await sleep(RETRY_DELAY_MS * (attempt + 1));
      }
    }
  }
  throw lastError;

  async function call(model: string): Promise<unknown> {
    const res = await fetchImpl(`${ENDPOINT}/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, responseMimeType: "application/json", responseSchema: schema },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 300);
      const message = `Gemini ${model} ${res.status}: ${detail}`;
      // 429는 다른 모델로 넘어갈 수 있게 재시도 대상
      if (res.status === 429 || res.status >= 500) throw new RetryableError(message);
      throw new Error(message);
    }
    const data = (await res.json()) as GeminiResponse;
    const text = (data.candidates?.[0]?.content?.parts ?? [])
      .filter((p) => !p.thought && typeof p.text === "string")
      .map((p) => p.text)
      .join("");
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Gemini ${model}: JSON이 아닌 응답`);
    }
  }
}
