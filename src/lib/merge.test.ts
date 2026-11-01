import { describe, expect, it } from "vitest";
import { normalizeLink } from "./merge";

describe("normalizeLink", () => {
  it("removes utm_* and fragment, keeps other params", () => {
    expect(normalizeLink("https://Example.com/a?utm_source=rss&id=1&utm_medium=x#top")).toBe("https://example.com/a?id=1");
  });

  it("ignores trailing slash and http vs https", () => {
    expect(normalizeLink("http://example.com/a/")).toBe(normalizeLink("https://example.com/a"));
  });

  it("returns the input when it is not a valid URL", () => {
    expect(normalizeLink("not a url")).toBe("not a url");
  });
});
