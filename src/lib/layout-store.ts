import type { Category, CountryCode } from "@/types/catalog";
import type { Board, BoardView, Layout, Panel, PanelView } from "@/types/layout";
import { feedsFor, getFeedById } from "./catalog";
import { CATEGORIES } from "./constants";
import { normalizeKeywords } from "./watch";

export const LIMIT_MIN = 5;
export const LIMIT_MAX = 30;
export const LIMIT_DEFAULT = 10;
/** 보드 하나당 최대 패널 수 */
export const MAX_PANELS = 24;
export const MAX_BOARDS = 10;
const MAX_TOTAL_PANELS = MAX_PANELS * MAX_BOARDS;
export const DEFAULT_BOARD: Board = { id: "main", name: "내 화면" };
/** /api/feeds의 요청당 최대 피드 수와 같다 */
export const MAX_FEEDS_PER_PANEL = 12;
export const MAX_QUERY_LENGTH = 80;

export type IdFactory = () => string;

/** crypto.randomUUID는 보안 컨텍스트(https/localhost)에서만 있으므로 대체 구현을 둔다 */
export const newId: IdFactory = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const clampLimit = (n: number) => Math.min(LIMIT_MAX, Math.max(LIMIT_MIN, Math.round(n)));

export interface PanelInput {
  title?: string;
  country?: CountryCode;
  category?: Category;
  feedIds?: string[];
  customUrls?: string[];
  limit?: number;
  query?: string;
}

/** feedIds를 안 주면 나라·분야에 맞는 카탈로그 피드를 자동 선택 (키워드 패널은 피드 없이 검색어만) */
export function createPanel(input: PanelInput, makeId: IdFactory = newId): Panel {
  const query = input.query?.trim().slice(0, MAX_QUERY_LENGTH);
  const feedIds = input.feedIds ?? (query && !input.country && !input.category ? [] : feedsFor(input.country, input.category).map((f) => f.id));
  return {
    id: makeId(),
    ...(input.title ? { title: input.title } : {}),
    ...(query ? { query } : {}),
    ...(input.country ? { country: input.country } : {}),
    ...(input.category ? { category: input.category } : {}),
    feedIds: feedIds.slice(0, MAX_FEEDS_PER_PANEL),
    customUrls: input.customUrls ?? [],
    limit: clampLimit(input.limit ?? LIMIT_DEFAULT),
  };
}

const PRESET: [CountryCode, Category][] = [
  ["KR", "top"],
  ["KR", "economy"],
  ["US", "top"],
  ["US", "tech"],
  ["JP", "top"],
  ["CN", "top"],
  ["EU", "top"],
  ["WORLD", "world"],
];

/**
 * 온보딩: 고른 나라 × 분야 중 피드가 있는 조합으로 패널을 만든다 (나라 순서 → 분야 순서, 최대 MAX_PANELS).
 * 국제(WORLD)는 분야와 관계없이 '국제' 패널 하나.
 */
export function buildStarterLayout(countries: CountryCode[], categories: Category[], makeId: IdFactory = newId): Layout {
  const panels: Panel[] = [];
  for (const country of countries) {
    const cats = country === "WORLD" ? (["world"] as Category[]) : categories;
    for (const category of cats) {
      if (panels.length >= MAX_PANELS) break;
      if (feedsFor(country, category).length === 0) continue;
      panels.push(createPanel({ country, category }, makeId));
    }
  }
  return { version: 1, panels };
}

export function defaultLayout(makeId: IdFactory = newId): Layout {
  return { version: 1, panels: PRESET.map(([country, category]) => createPanel({ country, category }, makeId)) };
}

// ---------------------------------------------------------------------------
// 검증 / 마이그레이션
// ---------------------------------------------------------------------------

const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");
const categoryIds = new Set<string>(CATEGORIES.map((c) => c.id));
const VIEWS: PanelView[] = ["card", "list", "text"];

function validatePanel(raw: unknown): Panel | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.id !== "string" || !p.id) return null;
  if (!isStringArray(p.feedIds) || !isStringArray(p.customUrls)) return null;
  if (typeof p.limit !== "number" || !Number.isFinite(p.limit)) return null;
  if (p.title !== undefined && typeof p.title !== "string") return null;
  if (p.country !== undefined && typeof p.country !== "string") return null;
  if (p.category !== undefined && !(typeof p.category === "string" && categoryIds.has(p.category))) return null;

  const query = typeof p.query === "string" ? p.query.trim().slice(0, MAX_QUERY_LENGTH) : "";
  const lastSeenAt = typeof p.lastSeenAt === "string" && !Number.isNaN(Date.parse(p.lastSeenAt)) ? p.lastSeenAt : undefined;
  return {
    id: p.id,
    ...(p.title ? { title: p.title as string } : {}),
    ...(p.country ? { country: p.country as string } : {}),
    ...(p.category ? { category: p.category as Category } : {}),
    feedIds: p.feedIds,
    customUrls: p.customUrls,
    ...(query ? { query } : {}),
    limit: clampLimit(p.limit),
    ...(lastSeenAt ? { lastSeenAt } : {}),
    ...(VIEWS.includes(p.view as PanelView) ? { view: p.view as PanelView } : {}),
    ...(p.wide === true ? { wide: true } : {}),
    ...(typeof p.boardId === "string" && p.boardId ? { boardId: p.boardId } : {}),
  };
}

function validateBoards(raw: unknown): Board[] | null | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_BOARDS) return null;
  const boards: Board[] = [];
  for (const b of raw) {
    if (!b || typeof b !== "object") return null;
    const { id, name, view } = b as Record<string, unknown>;
    if (typeof id !== "string" || !id || typeof name !== "string") return null;
    boards.push({ id, name, ...(view === "wall" || view === "world" ? { view: view as BoardView } : {}) });
  }
  return new Set(boards.map((b) => b.id)).size === boards.length ? boards : null;
}

/** 구조가 맞으면 정리된 Layout, 아니면 null */
export function validateLayout(raw: unknown): Layout | null {
  if (!raw || typeof raw !== "object") return null;
  const l = raw as Record<string, unknown>;
  if (l.version !== 1 || !Array.isArray(l.panels) || l.panels.length > MAX_TOTAL_PANELS) return null;
  const panels = l.panels.map(validatePanel);
  if (panels.some((p) => p === null)) return null;
  let valid = panels as Panel[];
  if (new Set(valid.map((p) => p.id)).size !== valid.length) return null;

  const boards = validateBoards(l.boards);
  if (boards === null) return null;
  const boardIds = new Set((boards ?? [DEFAULT_BOARD]).map((b) => b.id));
  // 없는 보드를 가리키는 패널은 첫 보드 소속으로
  valid = valid.map((p) => {
    if (!p.boardId || boardIds.has(p.boardId)) return p;
    const rest = { ...p };
    delete rest.boardId;
    return rest;
  });
  const active = typeof l.activeBoardId === "string" && boardIds.has(l.activeBoardId) ? l.activeBoardId : undefined;
  const watch = Array.isArray(l.watchKeywords) ? normalizeKeywords(l.watchKeywords.filter((k): k is string => typeof k === "string")) : [];
  return {
    version: 1,
    panels: valid,
    ...(boards ? { boards } : {}),
    ...(active ? { activeBoardId: active } : {}),
    ...(watch.length ? { watchKeywords: watch } : {}),
  };
}

/** 저장된 데이터를 현재 버전으로 올린다. 새 버전이 생기면 여기에 단계별 변환을 추가 */
export function migrate(raw: unknown): Layout | null {
  return validateLayout(raw);
}

// ---------------------------------------------------------------------------
// 내보내기 / 가져오기
// ---------------------------------------------------------------------------

export function serializeLayout(layout: Layout): string {
  return JSON.stringify(layout, null, 2);
}

export type ImportResult = { ok: true; layout: Layout } | { ok: false; error: string };

export function parseImportedLayout(text: string): ImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "JSON 형식이 아닙니다" };
  }
  const layout = migrate(raw);
  return layout ? { ok: true, layout } : { ok: false, error: "World RSS Desk 설정 파일이 아닙니다" };
}

// ---------------------------------------------------------------------------
// 레이아웃 조작 (모두 새 객체를 반환)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 보드
// ---------------------------------------------------------------------------

export function boardsOf(layout: Layout): Board[] {
  return layout.boards?.length ? layout.boards : [DEFAULT_BOARD];
}

export function activeBoardId(layout: Layout): string {
  const boards = boardsOf(layout);
  return layout.activeBoardId && boards.some((b) => b.id === layout.activeBoardId) ? layout.activeBoardId : boards[0].id;
}

function boardOfPanel(layout: Layout, panel: Panel): string {
  const boards = boardsOf(layout);
  return panel.boardId && boards.some((b) => b.id === panel.boardId) ? panel.boardId : boards[0].id;
}

export function panelsOnBoard(layout: Layout, boardId: string): Panel[] {
  return layout.panels.filter((p) => boardOfPanel(layout, p) === boardId);
}

export function addBoard(layout: Layout, name: string, makeId: IdFactory = newId): Layout {
  const boards = boardsOf(layout);
  if (boards.length >= MAX_BOARDS) return layout;
  const board = { id: makeId(), name: name.trim() || `보드 ${boards.length + 1}` };
  return { ...layout, boards: [...boards, board], activeBoardId: board.id };
}

export function renameBoard(layout: Layout, id: string, name: string): Layout {
  if (!name.trim()) return layout;
  return { ...layout, boards: boardsOf(layout).map((b) => (b.id === id ? { ...b, name: name.trim() } : b)) };
}

/** 보드 보기 전환. 기본 보드만 있는 레이아웃이면 boards를 만들어 저장한다 */
export function setBoardView(layout: Layout, id: string, view: BoardView): Layout {
  const boards = boardsOf(layout);
  if (!boards.some((b) => b.id === id)) return layout;
  return {
    ...layout,
    boards: boards.map((b) => {
      if (b.id !== id) return b;
      const rest = { id: b.id, name: b.name };
      return view === "panels" ? rest : { ...rest, view };
    }),
  };
}

export function setWatchKeywords(layout: Layout, keywords: string[]): Layout {
  const next = normalizeKeywords(keywords);
  const rest = { ...layout };
  delete rest.watchKeywords;
  return next.length ? { ...rest, watchKeywords: next } : rest;
}

export function setActiveBoard(layout: Layout, id: string): Layout {
  return boardsOf(layout).some((b) => b.id === id) ? { ...layout, activeBoardId: id } : layout;
}

/** 보드와 그 보드의 패널을 지운다. 마지막 보드는 지우지 않는다 */
export function removeBoard(layout: Layout, id: string): Layout {
  const boards = boardsOf(layout);
  if (boards.length <= 1 || !boards.some((b) => b.id === id)) return layout;
  const remaining = boards.filter((b) => b.id !== id);
  const panels = layout.panels.filter((p) => boardOfPanel(layout, p) !== id);
  const active = activeBoardId(layout) === id ? remaining[0].id : activeBoardId(layout);
  // 첫 보드가 바뀌면 boardId 없는 패널의 소속이 달라지므로 명시해 둔다
  const firstId = boards[0].id;
  const fixed = panels.map((p) => (p.boardId ? p : { ...p, boardId: firstId }));
  return { ...layout, boards: remaining, activeBoardId: active, panels: fixed };
}

// ---------------------------------------------------------------------------
// 패널 조작
// ---------------------------------------------------------------------------

/** 현재 보드에 패널 추가 (보드당 MAX_PANELS) */
export function addPanel(layout: Layout, panel: Panel): Layout {
  const board = activeBoardId(layout);
  if (panelsOnBoard(layout, board).length >= MAX_PANELS) return layout;
  const placed = layout.boards?.length ? { ...panel, boardId: board } : panel;
  return { ...layout, panels: [...layout.panels, placed] };
}

/** 드래그 앤 드롭: 패널을 전체 목록의 index 위치로 옮긴다 */
export function movePanelTo(layout: Layout, id: string, index: number): Layout {
  const from = layout.panels.findIndex((p) => p.id === id);
  if (from < 0) return layout;
  const panels = [...layout.panels];
  const [moved] = panels.splice(from, 1);
  panels.splice(Math.max(0, Math.min(index, panels.length)), 0, moved);
  return { ...layout, panels };
}

export function updatePanel(layout: Layout, id: string, patch: Partial<Omit<Panel, "id">>): Layout {
  return {
    ...layout,
    panels: layout.panels.map((p) => {
      if (p.id !== id) return p;
      const next = { ...p, ...patch };
      return {
        ...next,
        feedIds: next.feedIds.slice(0, MAX_FEEDS_PER_PANEL),
        limit: clampLimit(next.limit),
      };
    }),
  };
}

export interface RemoveResult {
  layout: Layout;
  removed: { panel: Panel; index: number } | null;
}

export function removePanel(layout: Layout, id: string): RemoveResult {
  const index = layout.panels.findIndex((p) => p.id === id);
  if (index < 0) return { layout, removed: null };
  return {
    layout: { ...layout, panels: layout.panels.filter((p) => p.id !== id) },
    removed: { panel: layout.panels[index], index },
  };
}

/** 삭제 되돌리기: 원래 위치에 다시 끼운다 */
export function restorePanel(layout: Layout, panel: Panel, index: number): Layout {
  if (layout.panels.some((p) => p.id === panel.id)) return layout;
  const panels = [...layout.panels];
  panels.splice(Math.min(index, panels.length), 0, panel);
  return { ...layout, panels };
}

/** ←/→ 버튼: 같은 보드 안의 이웃 패널과 자리를 바꾼다 */
export function movePanel(layout: Layout, id: string, direction: -1 | 1): Layout {
  const index = layout.panels.findIndex((p) => p.id === id);
  if (index < 0) return layout;
  const board = boardOfPanel(layout, layout.panels[index]);
  let target = index + direction;
  while (target >= 0 && target < layout.panels.length && boardOfPanel(layout, layout.panels[target]) !== board) target += direction;
  if (target < 0 || target >= layout.panels.length) return layout;
  const panels = [...layout.panels];
  [panels[index], panels[target]] = [panels[target], panels[index]];
  return { ...layout, panels };
}

export function markSeen(layout: Layout, id: string, at: string): Layout {
  return { ...layout, panels: layout.panels.map((p) => (p.id === id ? { ...p, lastSeenAt: at } : p)) };
}

export function markAllSeen(layout: Layout, at: string): Layout {
  return { ...layout, panels: layout.panels.map((p) => ({ ...p, lastSeenAt: at })) };
}

/** 카탈로그에서 빠진 피드 id */
export function staleFeedIds(panel: Panel): string[] {
  return panel.feedIds.filter((id) => !getFeedById(id));
}
