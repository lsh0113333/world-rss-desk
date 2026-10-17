// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { detectCharset, fetchText } from "./http";

const enc = (s: string) => new TextEncoder().encode(s);

describe("detectCharset", () => {
  it("reads an HTML meta charset when header and XML declaration are absent", () => {
    expect(detectCharset("text/html", enc(`<html><head><meta charset="euc-kr">`))).toBe("euc-kr");
    expect(detectCharset(null, enc(`<meta http-equiv="Content-Type" content="text/html; charset=Shift_JIS">`))).toBe("shift_jis");
  });
});

describe("fetchText", () => {
  it("returns text, response headers and the final url after redirects", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: "https://b.example.com/final" } }))
      .mockResolvedValueOnce(new Response("<html>ok</html>", { status: 200, headers: { "x-frame-options": "DENY", "content-type": "text/html" } }));
    const result = await fetchText("https://a.example.com/start", { timeoutMs: 1000, maxBytes: 1000, fetchImpl });
    expect(result.text).toBe("<html>ok</html>");
    expect(result.url).toBe("https://b.example.com/final");
    expect(result.headers.get("x-frame-options")).toBe("DENY");
  });

  it("sends the accept header and skips the data cache option when no revalidate is given", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("x"));
    await fetchText("https://a.example.com/", { timeoutMs: 1000, maxBytes: 1000, accept: "text/html", fetchImpl });
    const init = fetchImpl.mock.calls[0][1];
    expect(new Headers(init.headers).get("accept")).toBe("text/html");
    expect(init.next).toBeUndefined();
    expect(init.cache).toBeUndefined();
  });
});
