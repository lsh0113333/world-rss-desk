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
    ["unknown category", { version: 1, panels: [{ id: "a", feedIds: [], customUrls: [], limit: 10, category: "poster" }] }],
    ["too many panels", { version: 1, panels: Array.from({ length: MAX_PANELS * 10 + 1 }, (_, i) => ({ id: `a${i}`, feedIds: [], customUrls: [], limit: 10 })) }],
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

describe("movePanelTo", () => {
  it("moves a panel to a target index", async () => {
    const { movePanelTo } = await import("./layout-store");
    const [a, b, c] = [panel(), panel(), panel()];
    expect(movePanelTo(layoutOf(a, b, c), c.id, 0).panels).toEqual([c, a, b]);
    expect(movePanelTo(layoutOf(a, b, c), a.id, 2).panels).toEqual([b, c, a]);
    const same = layoutOf(a, b);
    expect(movePanelTo(same, "missing", 0)).toBe(same);
  });
});

describe("boards", () => {
  it("treats a layout without boards as one default board", async () => {
    const { boardsOf, activeBoardId, panelsOnBoard, DEFAULT_BOARD } = await import("./layout-store");
    const l = layoutOf(panel(), panel());
    expect(boardsOf(l)).toEqual([DEFAULT_BOARD]);
    expect(activeBoardId(l)).toBe(DEFAULT_BOARD.id);
    expect(panelsOnBoard(l, DEFAULT_BOARD.id)).toHaveLength(2);
  });

  it("adds a board, switches to it, and assigns new panels to the active board", async () => {
    const { addBoard, activeBoardId, panelsOnBoard, DEFAULT_BOARD } = await import("./layout-store");
    const p1 = panel();
    let l = addBoard(layoutOf(p1), "경제", ids);
    const boardId = activeBoardId(l);
    expect(boardId).not.toBe(DEFAULT_BOARD.id);
    expect(l.boards?.map((b) => b.name)).toEqual(["내 화면", "경제"]);
    l = addPanel(l, panel());
    expect(panelsOnBoard(l, boardId)).toHaveLength(1);
    expect(panelsOnBoard(l, DEFAULT_BOARD.id).map((p) => p.id)).toEqual([p1.id]);
  });

  it("renames, switches and removes boards (removing its panels)", async () => {
    const { addBoard, renameBoard, setActiveBoard, removeBoard, boardsOf, activeBoardId, DEFAULT_BOARD } = await import("./layout-store");
    let l = addBoard(layoutOf(panel()), "테크", ids);
    const tech = activeBoardId(l);
    l = addPanel(l, panel());
    l = renameBoard(l, tech, "IT");
    expect(boardsOf(l)[1].name).toBe("IT");
    l = setActiveBoard(l, DEFAULT_BOARD.id);
    expect(activeBoardId(l)).toBe(DEFAULT_BOARD.id);
    l = removeBoard(l, tech);
    expect(boardsOf(l)).toHaveLength(1);
    expect(l.panels).toHaveLength(1);
  });

  it("never removes the last board", async () => {
    const { removeBoard, boardsOf, DEFAULT_BOARD } = await import("./layout-store");
    const l = layoutOf(panel());
    expect(boardsOf(removeBoard(l, DEFAULT_BOARD.id))).toHaveLength(1);
    expect(removeBoard(l, DEFAULT_BOARD.id).panels).toHaveLength(1);
  });

  it("validates boards and drops dangling board references", () => {
    const raw = {
      version: 1,
      boards: [{ id: "b1", name: "경제" }],
      activeBoardId: "nope",
      panels: [{ id: "a", feedIds: [], customUrls: [], limit: 10, boardId: "ghost" }],
    };
    const l = validateLayout(raw);
    expect(l?.boards).toEqual([{ id: "b1", name: "경제" }]);
    expect(l?.activeBoardId).toBeUndefined();
    expect(l?.panels[0].boardId).toBeUndefined();
    expect(validateLayout({ version: 1, panels: [], boards: [{ id: 1 }] })).toBeNull();
  });
});

describe("movePanel with boards", () => {
  it("swaps only with neighbours on the same board", async () => {
    const { addBoard, setActiveBoard, DEFAULT_BOARD } = await import("./layout-store");
    const a = panel();
    let l = addBoard(layoutOf(a), "B", ids);
    l = addPanel(l, panel());
    l = setActiveBoard(l, DEFAULT_BOARD.id);
    const c = panel();
    l = addPanel(l, c);
    // 순서: a(main), x(B), c(main) → c를 앞으로 옮기면 a와 바뀐다
    const moved = movePanel(l, c.id, -1);
    expect(moved.panels.map((p) => p.id)).toEqual([c.id, l.panels[1].id, a.id]);
  });
});

describe("buildStarterLayout", () => {
  it("creates a panel per country × category that has feeds, in the given order", async () => {
    const { buildStarterLayout } = await import("./layout-store");
    const l = buildStarterLayout(["KR", "BR"], ["top", "economy"], ids);
    // 브라질은 경제 피드가 없어서 종합만
    expect(l.panels.map((p) => [p.country, p.category])).toEqual([
      ["KR", "top"],
      ["KR", "economy"],
      ["BR", "top"],
    ]);
    expect(l.panels.every((p) => p.feedIds.length > 0)).toBe(true);
  });

  it("uses the world category for WORLD and caps at MAX_PANELS", async () => {
    const { buildStarterLayout } = await import("./layout-store");
    expect(buildStarterLayout(["WORLD"], ["top"], ids).panels.map((p) => p.category)).toEqual(["world"]);
    const many = buildStarterLayout(["KR", "US", "JP", "CN", "IN", "GB", "DE", "FR", "EU", "AU"], ["top", "world", "politics", "economy", "tech", "science"], ids);
    expect(many.panels.length).toBeLessThanOrEqual(MAX_PANELS);
  });
});

describe("board view (panels / headline wall)", () => {
  it("sets the view of a board, materializing the default board", async () => {
    const { setBoardView, boardsOf, DEFAULT_BOARD } = await import("./layout-store");
    const l = setBoardView(layoutOf(panel()), DEFAULT_BOARD.id, "wall");
    expect(boardsOf(l)).toEqual([{ ...DEFAULT_BOARD, view: "wall" }]);
    expect(boardsOf(setBoardView(l, DEFAULT_BOARD.id, "panels"))[0].view).toBe("panels");
    // 세계 흐름이 기본이라 저장하지 않는다
    expect(boardsOf(setBoardView(l, DEFAULT_BOARD.id, "world"))[0].view).toBeUndefined();
  });

  it("keeps a valid board view on load and drops an invalid one", () => {
    const l = validateLayout({ version: 1, panels: [], boards: [{ id: "b1", name: "x", view: "wall" }, { id: "b2", name: "y", view: "poster" }, { id: "b3", name: "z", view: "panels" }] });
    expect(l?.boards).toEqual([{ id: "b1", name: "x", view: "wall" }, { id: "b2", name: "y" }, { id: "b3", name: "z", view: "panels" }]);
  });

  it("보드 보기를 고른 적이 없으면 세계 흐름", async () => {
    const { boardViewOf } = await import("./layout-store");
    expect(boardViewOf({ id: "a", name: "a" })).toBe("world");
    expect(boardViewOf(undefined)).toBe("world");
    expect(boardViewOf({ id: "a", name: "a", view: "panels" })).toBe("panels");
  });

  it("테마: 기본 어둡게, 밝게만 저장·검증", async () => {
    const { setTheme, validateLayout } = await import("./layout-store");
    const light = setTheme(layoutOf(), "light");
    expect(light.theme).toBe("light");
    expect(setTheme(light, "dark").theme).toBeUndefined();
    expect(validateLayout({ version: 1, panels: [], theme: "light" })?.theme).toBe("light");
    expect(validateLayout({ version: 1, panels: [], theme: "neon" })?.theme).toBeUndefined();
  });
});

describe("watch keywords", () => {
  it("normalizes and stores keywords", async () => {
    const { setWatchKeywords } = await import("./layout-store");
    expect(setWatchKeywords(layoutOf(), [" 반도체 ", "Iran", "iran", ""]).watchKeywords).toEqual(["반도체", "Iran"]);
    expect(setWatchKeywords(layoutOf(), []).watchKeywords).toBeUndefined();
  });

  it("keeps only string keywords on load", () => {
    expect(validateLayout({ version: 1, panels: [], watchKeywords: ["환율", 3, " "] })?.watchKeywords).toEqual(["환율"]);
    expect(validateLayout({ version: 1, panels: [], watchKeywords: "x" })?.watchKeywords).toBeUndefined();
  });
});

describe("keyword panels", () => {
  it("creates a keyword panel without catalog feeds", () => {
    const p = createPanel({ query: "  반도체 수출 " }, ids);
    expect(p).toMatchObject({ query: "반도체 수출", feedIds: [], customUrls: [] });
  });

  it("keeps a string query on load and drops an empty one", () => {
    const ok = validateLayout({ version: 1, panels: [{ id: "a", feedIds: [], customUrls: [], limit: 10, query: "Hormuz" }] });
    expect(ok?.panels[0].query).toBe("Hormuz");
    const bad = validateLayout({ version: 1, panels: [{ id: "a", feedIds: [], customUrls: [], limit: 10, query: "  " }] });
    expect(bad?.panels[0].query).toBeUndefined();
  });
});
