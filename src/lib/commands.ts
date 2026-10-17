import type { Category, CountryCode } from "@/types/catalog";
import type { Layout } from "@/types/layout";
import { CATALOG, categoriesForCountry, feedsByCountry } from "./catalog";
import { CATEGORIES, COUNTRIES, getCountry, panelTitle } from "./constants";
import { boardsOf, MAX_FEEDS_PER_PANEL } from "./layout-store";

export type Command =
  | { kind: "jump"; label: string; panelId: string }
  | { kind: "add"; label: string; country: CountryCode; category?: Category }
  | { kind: "outlet"; label: string; name: string; feedIds: string[] }
  | { kind: "board"; label: string; boardId: string }
  | { kind: "action"; label: string; action: "markAllSeen" | "refreshAll" | "newBoard" | "export" };

const MAX_RESULTS = 10;
const ACTIONS: Extract<Command, { kind: "action" }>[] = [
  { kind: "action", label: "모두 확인", action: "markAllSeen" },
  { kind: "action", label: "전체 새로고침", action: "refreshAll" },
  { kind: "action", label: "새 보드 만들기", action: "newBoard" },
  { kind: "action", label: "설정 내보내기", action: "export" },
];

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");
const includes = (text: string, token: string) => norm(text).includes(token);

/** 명령창(Ctrl+K) 검색: 패널 이동, 나라·분야 패널 추가, 매체 패널 추가, 보드 전환, 동작 */
export function searchCommands(query: string, layout: Layout): Command[] {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean).map(norm);
  if (tokens.length === 0) return ACTIONS.slice(0, MAX_RESULTS);

  const matchesAll = (...texts: string[]) => tokens.every((t) => texts.some((x) => includes(x, t)));
  const results: Command[] = [];

  // 1) 나라·분야 조합 (가장 구체적인 의도)
  const countries = COUNTRIES.filter((c) => tokens.some((t) => includes(c.name, t) || norm(c.code) === t));
  const categories = CATEGORIES.filter((c) => tokens.some((t) => includes(c.label, t) || norm(c.id) === t));
  const countryList = countries.length ? countries : categories.length ? COUNTRIES : [];
  for (const country of countryList) {
    if (feedsByCountry(country.code).length === 0) continue;
    const available = categoriesForCountry(country.code);
    const wanted = categories.length ? categories.map((c) => c.id).filter((id) => available.includes(id)) : available;
    for (const category of wanted) {
      results.push({ kind: "add", label: `패널 추가: ${panelTitle(country.code, category)}`, country: country.code, category });
    }
  }

  // 2) 이미 있는 패널로 이동
  for (const p of layout.panels) {
    const title = p.title || panelTitle(p.country, p.category);
    const countryName = p.country ? (getCountry(p.country)?.name ?? "") : "";
    if (matchesAll(title, countryName)) results.unshift({ kind: "jump", label: `패널로 이동: ${title}`, panelId: p.id });
  }

  // 3) 매체
  const outlets = new Map<string, string[]>();
  for (const f of CATALOG) {
    if (!matchesAll(f.name)) continue;
    outlets.set(f.name, [...(outlets.get(f.name) ?? []), f.id]);
  }
  for (const [name, feedIds] of outlets) {
    results.push({ kind: "outlet", label: `매체 패널 추가: ${name}`, name, feedIds: feedIds.slice(0, MAX_FEEDS_PER_PANEL) });
  }

  // 4) 보드, 동작
  for (const b of boardsOf(layout)) if (matchesAll(b.name)) results.push({ kind: "board", label: `보드로 이동: ${b.name}`, boardId: b.id });
  for (const a of ACTIONS) if (matchesAll(a.label)) results.push(a);

  return results.slice(0, MAX_RESULTS);
}
