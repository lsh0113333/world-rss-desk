import { describe, expect, it } from "vitest";
import type { Article } from "@/types/article";
import { pickTopStories } from "./top-stories";

const a = (id: string): Article => ({ id, title: id, link: `https://x.com/${id}`, publishedAt: null, source: "S" });

describe("pickTopStories", () => {
  it("picks each panel's first article in panel order", () => {
    expect(pickTopStories(["p1", "p2"], { p1: [a("a"), a("b")], p2: [a("c")] }).map((t) => [t.panelId, t.article?.id])).toEqual([
      ["p1", "a"],
      ["p2", "c"],
    ]);
  });

  it("skips articles already shown by an earlier panel (same link)", () => {
    const shared = a("shared");
    expect(pickTopStories(["p1", "p2"], { p1: [shared, a("b")], p2: [{ ...shared, id: "other-id" }, a("d")] }).map((t) => t.article?.id)).toEqual([
      "shared",
      "d",
    ]);
  });

  it("skips articles about a story already shown when a story key is given", () => {
    const storyOf: Record<string, string> = { a: "hormuz", c: "hormuz" };
    const key = (x: Article) => storyOf[x.id] ?? x.id;
    expect(pickTopStories(["p1", "p2"], { p1: [a("a")], p2: [a("c"), a("d")] }, key).map((t) => t.article?.id)).toEqual(["a", "d"]);
  });

  it("keeps a placeholder for panels without data yet", () => {
    expect(pickTopStories(["p1"], {})).toEqual([{ panelId: "p1", article: null }]);
  });
});
