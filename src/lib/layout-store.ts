import type { Category, CountryCode } from "@/types/catalog";
import type { Layout, Panel, PanelView } from "@/types/layout";
import { feedsFor, getFeedById } from "./catalog";
import { CATEGORIES } from "./constants";

export const LIMIT_MIN = 5;
export const LIMIT_MAX = 30;
export const LIMIT_DEFAULT = 10;
export const MAX_PANELS = 24;
/** /api/feeds의 요청당 최대 피드 수와 같다 */
export const MAX_FEEDS_PER_PANEL = 12;

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
}

/** feedIds를 안 주면 나라·분야에 맞는 카탈로그 피드를 자동 선택 */
export function createPanel(input: PanelInput, makeId: IdFactory = newId): Panel {
  const feedIds = input.feedIds ?? feedsFor(input.country, input.category).map((f) => f.id);
  return {
    id: makeId(),
    ...(input.title ? { title: input.title } : {}),
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

  const lastSeenAt = typeof p.lastSeenAt === "string" && !Number.isNaN(Date.parse(p.lastSeenAt)) ? p.lastSeenAt : undefined;
  return {
    id: p.id,
    ...(p.title ? { title: p.title as string } : {}),
    ...(p.country ? { country: p.country as string } : {}),
    ...(p.category ? { category: p.category as Category } : {}),
    feedIds: p.feedIds,
    customUrls: p.customUrls,
    limit: clampLimit(p.limit),
    ...(lastSeenAt ? { lastSeenAt } : {}),
    ...(VIEWS.includes(p.view as PanelView) ? { view: p.view as PanelView } : {}),
    ...(p.wide === true ? { wide: true } : {}),
  };
}

/** 구조가 맞으면 정리된 Layout, 아니면 null */
export function validateLayout(raw: unknown): Layout | null {
  if (!raw || typeof raw !== "object") return null;
  const l = raw as Record<string, unknown>;
  if (l.version !== 1 || !Array.isArray(l.panels) || l.panels.length > MAX_PANELS) return null;
  const panels = l.panels.map(validatePanel);
  if (panels.some((p) => p === null)) return null;
  const valid = panels as Panel[];
  if (new Set(valid.map((p) => p.id)).size !== valid.length) return null;
  return { version: 1, panels: valid };
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

export function addPanel(layout: Layout, panel: Panel): Layout {
  if (layout.panels.length >= MAX_PANELS) return layout;
  return { ...layout, panels: [...layout.panels, panel] };
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

export function movePanel(layout: Layout, id: string, direction: -1 | 1): Layout {
  const index = layout.panels.findIndex((p) => p.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= layout.panels.length) return layout;
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
