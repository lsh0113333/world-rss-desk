import { describe, expect, it } from "vitest";
import { cleanText, decodeEntities, hashId, parseFeedDate, truncate } from "./text";

describe("decodeEntities", () => {
  it("decodes named and numeric entities", () => {
    expect(decodeEntities("a &amp; b &lt;c&gt; &quot;d&quot; &#39;e&#39;")).toBe(`a & b <c> "d" 'e'`);
    expect(decodeEntities("&#8216;x&#8217; &#x2014; &hellip;")).toBe("‘x’ — …");
  });

  it("leaves unknown entities untouched", () => {
    expect(decodeEntities("&unknown; &#xZZ;")).toBe("&unknown; &#xZZ;");
  });
});

describe("cleanText", () => {
  it("strips tags, drops script/style content and collapses whitespace", () => {
    expect(cleanText("<p>Hello <b>world</b></p>\n\n<script>alert(1)</script><style>p{}</style>")).toBe("Hello world");
  });

  it("decodes entities and strips html that was entity-encoded", () => {
    expect(cleanText("&lt;p&gt;Encoded &amp;amp; html&lt;/p&gt;")).toBe("Encoded & html");
    expect(cleanText("Stocks rose&nbsp;sharply.")).toBe("Stocks rose sharply.");
  });

  it("accepts parser values that are not strings", () => {
    expect(cleanText(2026)).toBe("2026");
    expect(cleanText({ "#text": "  inner  " })).toBe("inner");
    expect(cleanText(undefined)).toBe("");
    expect(cleanText(null)).toBe("");
  });
});

describe("truncate", () => {
  it("keeps short text and cuts long text with an ellipsis", () => {
    expect(truncate("short", 10)).toBe("short");
    expect(truncate("abcdefghij", 5)).toBe("abcd…");
  });
});

describe("hashId", () => {
  it("is deterministic and differs for different input", () => {
    expect(hashId("https://a.com/1")).toBe(hashId("https://a.com/1"));
    expect(hashId("https://a.com/1")).not.toBe(hashId("https://a.com/2"));
    expect(hashId("x")).toMatch(/^[0-9a-z]+$/);
  });
});

describe("parseFeedDate", () => {
  const now = new Date("2026-10-17T12:00:00Z");

  it("parses RFC 822 and ISO 8601 dates to ISO strings", () => {
    expect(parseFeedDate("Sat, 17 Oct 2026 18:25:43 +09:00", now)).toBe("2026-10-17T09:25:43.000Z");
    expect(parseFeedDate("Fri, 16 Oct 2026 10:01:55 GMT", now)).toBe("2026-10-16T10:01:55.000Z");
    expect(parseFeedDate("2026-10-16T19:36:26-04:00", now)).toBe("2026-10-16T23:36:26.000Z");
  });

  it("treats timezone-less dates as UTC", () => {
    expect(parseFeedDate("2026-10-17 06:00:00", now)).toBe("2026-10-17T06:00:00.000Z");
  });

  it("returns null for missing or invalid dates", () => {
    expect(parseFeedDate(undefined, now)).toBeNull();
    expect(parseFeedDate("not a date", now)).toBeNull();
  });

  it("clamps dates more than 15 minutes in the future to now", () => {
    expect(parseFeedDate("2026-10-17T12:10:00Z", now)).toBe("2026-10-17T12:10:00.000Z");
    expect(parseFeedDate("2026-10-17T20:00:00Z", now)).toBe(now.toISOString());
  });
});
