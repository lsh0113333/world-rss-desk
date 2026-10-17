import { describe, expect, it } from "vitest";
import manifest from "./manifest";

describe("web app manifest", () => {
  it("describes an installable standalone app", () => {
    const m = manifest();
    expect(m).toMatchObject({ name: "World RSS Desk", short_name: "RSS Desk", start_url: "/", display: "standalone", lang: "ko" });
  });

  it("provides 192px and 512px png icons", () => {
    const sizes = manifest().icons?.filter((i) => i.type === "image/png").map((i) => i.sizes);
    expect(sizes).toEqual(expect.arrayContaining(["192x192", "512x512"]));
  });
});
