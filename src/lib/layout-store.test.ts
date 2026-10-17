import { describe, expect, it } from "vitest";
import type { Layout, Panel } from "@/types/layout";
import { feedsFor } from "./catalog";
import {
  addPanel,
  createPanel,
  defaultLayout,
  LIMIT_DEFAULT,
  markAllSeen,
  markSeen,
  MAX_FEEDS_PER_PANEL,
  MAX_PANELS,
  migrate,
  movePanel,
  parseImportedLayout,
  removePanel,
  restorePanel,
  serializeLayout,
  staleFeedIds,
  updatePanel,
  validateLayout,
} from "./layout-store";

let seq = 0;
const ids = () => `p${++seq}`;

function panel(extra: Partial<Panel> = {}): Panel {
  return { id: ids(), feedIds: [], customUrls: [], limit: 10, ...extra };
}

function layoutOf(...panels: Panel[]): Layout {
  return { version: 1, panels };
}

describe("createPanel", () => {
  it("selects catalog feeds for the country and category", () => {
    const p = createPanel({ country: "KR", category: "economy" }, ids);
    expect(p.feedIds).toEqual(feedsFor("KR", "economy").map((f) => f.id));
    expect(p).toMatchObject({ country: "KR", category: "economy", customUrls: [], limit: LIMIT_DEFAULT });
    expect(p.lastSeenAt).toBeUndefined();
  });

  it("keeps explicit feedIds and clamps limit", () => {
    const p = createPanel({ feedIds: ["kr-yonhap-top"], limit: 99 }, ids);
    expect(p.feedIds).toEqual(["kr-yonhap-top"]);
    expect(p.limit).toBe(30);
  });

  it(`caps feeds at ${MAX_FEEDS_PER_PANEL}`, () => {
    const p = createPanel({ category: "tech" }, ids);
    expect(p.feedIds.length).toBeLessThanOrEqual(MAX_FEEDS_PER_PANEL);
  });

  it("generates an id by default", () => {
    expect(createPanel({ country: "KR" }).id).toMatch(/.+/);
  });
});

describe("defaultLayout", () => {
  it("has the eight preset panels in order, each with feeds", () => {
    const layout = defaultLayout(ids);
    expect(layout.version).toBe(1);
    expect(layout.panels.map((p) => [p.country, p.category])).toEqual([
      ["KR", "top"],
      ["KR", "economy"],
      ["US", "top"],
      ["US", "tech"],
      ["JP", "top"],
      ["CN", "top"],
      ["EU", "top"],
      ["WORLD", "world"],
    ]);
    for (const p of layout.panels) expect(p.feedIds.length).toBeGreaterThan(0);
  });
});

describe("validateLayout / migrate", () => {
  it("accepts a valid layout", () => {
    const layout = layoutOf(panel({ country: "KR", category: "top", lastSeenAt: "2026-10-17T00:00:00.000Z" }));
    expect(validateLayout(layout)).toEqual(layout);
  });

  it.each([
    ["null", null],
    ["a string", "x"],
    ["wrong version", { version: 2, panels: [] }],
    ["panels not an array", { version: 1, panels: {} }],
    ["panel without id", { version: 1, panels: [{ feedIds: [], customUrls: [], limit: 10 }] }],
    ["feedIds with non-strings", { version: 1, panels: [{ id: "a", feedIds: [1], customUrls: [], limit: 10 }] }],
    ["unknown category", { version: 1, panels: [{ id: "a", feedIds: [], customUrls: [], limit: 10, category: "sports" }] }],
    ["too many panels", { version: 1, panels: Array.from({ length: MAX_PANELS + 1 }, (_, i) => ({ id: `a${i}`, feedIds: [], customUrls: [], limit: 10 })) }],
    ["duplicate panel ids", { version: 1, panels: [{ id: "a", feedIds: [], customUrls: [], limit: 10 }, { id: "a", feedIds: [], customUrls: [], limit: 10 }] }],
  ])("rejects %s", (_label, raw) => {
    expect(validateLayout(raw)).toBeNull();
  });

  it("keeps a valid view and wide flag, drops invalid ones", () => {
    const ok = validateLayout({ version: 1, panels: [{ id: "a", feedIds: [], customUrls: [], limit: 10, view: "card", wide: true }] });
    expect(ok?.panels[0]).toMatchObject({ view: "card", wide: true });
    const bad = validateLayout({ version: 1, panels: [{ id: "a", feedIds: [], customUrls: [], limit: 10, view: "poster", wide: "yes" }] });
    expect(bad?.panels[0].view).toBeUndefined();
    expect(bad?.panels[0].wide).toBeUndefined();
  });

  it("clamps limit and drops invalid lastSeenAt", () => {
    const result = validateLayout({ version: 1, panels: [{ id: "a", feedIds: [], customUrls: [], limit: 100, lastSeenAt: "nope" }] });
    expect(result?.panels[0].limit).toBe(30);
    expect(result?.panels[0].lastSeenAt).toBeUndefined();
  });

  it("migrate validates version 1 and rejects unknown versions", () => {
    const layout = layoutOf(panel());
    expect(migrate(layout)).toEqual(layout);
    expect(migrate({ version: 99, panels: [] })).toBeNull();
  });
});

describe("import / export", () => {
  it("round-trips through serialize and parse", () => {
    const layout = defaultLayout(ids);
    const result = parseImportedLayout(serializeLayout(layout));
    expect(result).toEqual({ ok: true, layout });
  });

  it("reports invalid JSON and invalid structure", () => {
    expect(parseImportedLayout("{oops")).toEqual({ ok: false, error: "JSON 형식이 아닙니다" });
    expect(parseImportedLayout(`{"version":1}`)).toEqual({ ok: false, error: "World RSS Desk 설정 파일이 아닙니다" });
  });
});

describe("layout operations", () => {
  it("addPanel appends and refuses beyond the max", () => {
    const a = panel();
    expect(addPanel(layoutOf(), a).panels).toEqual([a]);
    const full = layoutOf(...Array.from({ length: MAX_PANELS }, () => panel()));
    expect(addPanel(full, panel())).toBe(full);
  });

  it("updatePanel patches one panel immutably", () => {
    const a = panel();
    const b = panel();
    const before = layoutOf(a, b);
    const after = updatePanel(before, b.id, { title: "새 제목", limit: 50 });
    expect(after.panels[1]).toMatchObject({ id: b.id, title: "새 제목", limit: 30 });
    expect(after.panels[0]).toBe(a);
    expect(before.panels[1].title).toBeUndefined();
  });

  it("removePanel returns the removed panel and index for undo", () => {
    const a = panel();
    const b = panel();
    const c = panel();
    const result = removePanel(layoutOf(a, b, c), b.id);
    expect(result.layout.panels).toEqual([a, c]);
    expect(result.removed).toEqual({ panel: b, index: 1 });
    expect(restorePanel(result.layout, b, 1).panels).toEqual([a, b, c]);
  });

  it("removePanel on a missing id changes nothing", () => {
    const layout = layoutOf(panel());
    expect(removePanel(layout, "missing")).toEqual({ layout, removed: null });
  });

  it("movePanel swaps with the neighbour and ignores the edges", () => {
    const a = panel();
    const b = panel();
    const c = panel();
    const layout = layoutOf(a, b, c);
    expect(movePanel(layout, b.id, -1).panels).toEqual([b, a, c]);
    expect(movePanel(layout, b.id, 1).panels).toEqual([a, c, b]);
    expect(movePanel(layout, a.id, -1)).toBe(layout);
    expect(movePanel(layout, c.id, 1)).toBe(layout);
  });

  it("markSeen and markAllSeen set lastSeenAt", () => {
    const a = panel();
    const b = panel();
    const at = "2026-10-17T12:00:00.000Z";
    expect(markSeen(layoutOf(a, b), a.id, at).panels.map((p) => p.lastSeenAt)).toEqual([at, undefined]);
    expect(markAllSeen(layoutOf(a, b), at).panels.every((p) => p.lastSeenAt === at)).toBe(true);
  });
});

describe("staleFeedIds", () => {
  it("lists ids that are no longer in the catalog", () => {
    expect(staleFeedIds(panel({ feedIds: ["kr-yonhap-top", "cn-globaltimes-top"] }))).toEqual(["cn-globaltimes-top"]);
  });
});
