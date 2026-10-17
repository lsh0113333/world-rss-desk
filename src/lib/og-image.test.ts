import { describe, expect, it } from "vitest";
import { extractOgImage } from "./og-image";

const page = "https://news.example.com/2026/10/a";

describe("extractOgImage", () => {
  it("reads og:image in either attribute order", () => {
    expect(extractOgImage(`<meta property="og:image" content="https://img.example.com/a.jpg">`, page)).toBe("https://img.example.com/a.jpg");
    expect(extractOgImage(`<meta content="https://img.example.com/b.jpg" property="og:image" />`, page)).toBe("https://img.example.com/b.jpg");
  });

  it("prefers og:image over twitter:image and falls back to it", () => {
    const both = `<meta name="twitter:image" content="https://img.example.com/t.jpg"><meta property="og:image" content="https://img.example.com/o.jpg">`;
    expect(extractOgImage(both, page)).toBe("https://img.example.com/o.jpg");
    expect(extractOgImage(`<meta name="twitter:image" content="https://img.example.com/t.jpg">`, page)).toBe("https://img.example.com/t.jpg");
  });

  it("resolves relative urls and decodes entities", () => {
    expect(extractOgImage(`<meta property="og:image" content="/img/c.jpg?w=1&amp;h=2">`, page)).toBe("https://news.example.com/img/c.jpg?w=1&h=2");
  });

  it("returns null for missing or unsafe images", () => {
    expect(extractOgImage(`<title>x</title>`, page)).toBeNull();
    expect(extractOgImage(`<meta property="og:image" content="javascript:alert(1)">`, page)).toBeNull();
    expect(extractOgImage(`<meta property="og:image" content="">`, page)).toBeNull();
  });
});
