import { describe, expect, it } from "vitest";
import { CONTINENTS } from "./constants";

describe("CONTINENTS", () => {
  it("includes every continent with a Korean label", () => {
    expect(CONTINENTS.map((c) => c.id)).toEqual([
      "asia",
      "europe",
      "north-america",
      "south-america",
      "middle-east",
      "africa",
      "oceania",
      "global",
    ]);
    for (const c of CONTINENTS) expect(c.label).not.toBe("");
  });
});
