"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { categoriesForCountry, feedsByCountry, feedsFor, getFeedById } from "@/lib/catalog";
import { CONTINENTS, countriesByContinent, getCategory, getCountry, panelTitle } from "@/lib/constants";
import { LIMIT_DEFAULT, LIMIT_MAX, LIMIT_MIN, MAX_FEEDS_PER_PANEL, MAX_QUERY_LENGTH } from "@/lib/layout-store";
import type { DiscoveredFeed, DiscoverResult } from "@/services/discover";
import type { Category, Continent, CountryCode } from "@/types/catalog";
import type { Panel } from "@/types/layout";
import { CloseIcon } from "./Icons";

export interface PanelEditorValue {
  title?: string;
  /** 키워드만 있는 패널은 나라·분야 없음 */
  country?: CountryCode;
  category?: Category;
  feedIds: string[];
  customUrls: string[];
  /** 키워드 패널: 구글 뉴스 검색어 */
  query?: string;
  limit: number;
}

export interface PanelEditorProps {
  /** 없으면 추가 모드 */
  panel?: Panel;
  onSave(value: PanelEditorValue): void;
  onClose(): void;
  onDelete?(): void;
  /** RSS 또는 사이트 주소 → 찾은 피드 목록 (기본: /api/discover) */
  discover?(input: string): Promise<DiscoverResult>;
}

/** 사이트 주소로 RSS 찾기: 서버가 홈페이지의 RSS 링크·흔한 경로·카탈로그를 확인한다 */
export async function discoverViaApi(input: string): Promise<DiscoverResult> {
  try {
    const res = await fetch(`/api/discover?url=${encodeURIComponent(input)}`);
    const body = (await res.json()) as DiscoverResult;
    if (!res.ok) return { feeds: [], error: body.error ?? `HTTP ${res.status}` };
    return body;
  } catch {
    return { feeds: [], error: "확인 중 오류가 발생했습니다" };
  }
}

const countriesWithFeeds = (continent: Continent) => countriesByContinent(continent).filter((c) => feedsByCountry(c.code).length > 0);
const continentsWithFeeds = CONTINENTS.filter((c) => countriesWithFeeds(c.id).length > 0);
const defaultSelection = (country: CountryCode, category: Category | "") =>
  feedsFor(country, category || undefined)
    .slice(0, MAX_FEEDS_PER_PANEL)
    .map((f) => f.id);

const field = "w-full rounded border border-line bg-panel px-3 py-2 text-sm text-headline focus:outline-2 focus:outline-accent";
const ghost = "rounded px-3 py-1.5 text-sm text-muted hover:bg-panel-header hover:text-headline";

export function PanelEditor({ panel, onSave, onClose, onDelete, discover = discoverViaApi }: PanelEditorProps) {
  const titleId = useId();
  const initialCountry = panel?.country && getCountry(panel.country) ? panel.country : "KR";
  const initialCategory: Category | "" = panel ? (panel.category ?? "") : "top";

  const [continent, setContinent] = useState<Continent>(getCountry(initialCountry)?.continent ?? "asia");
  const [country, setCountry] = useState<CountryCode>(initialCountry);
  const [category, setCategory] = useState<Category | "">(initialCategory);
  const [selected, setSelected] = useState<string[]>(() =>
    panel ? panel.feedIds.filter((id) => getFeedById(id)) : defaultSelection(initialCountry, initialCategory),
  );
  const [staleIds, setStaleIds] = useState<string[]>(() => panel?.feedIds.filter((id) => !getFeedById(id)) ?? []);
  const [customUrls, setCustomUrls] = useState<string[]>(panel?.customUrls ?? []);
  const [title, setTitle] = useState(panel?.title ?? "");
  const [limit, setLimit] = useState(String(panel?.limit ?? LIMIT_DEFAULT));
  const [query, setQuery] = useState(panel?.query ?? "");
  const [urlInput, setUrlInput] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [found, setFound] = useState<DiscoveredFeed[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const categories = categoriesForCountry(country);
  const candidates = useMemo(() => {
    const list = feedsFor(country, category || undefined);
    const extra = selected.map((id) => getFeedById(id)!).filter((f) => !list.includes(f));
    return [...list, ...extra];
  }, [country, category, selected]);

  const total = selected.length + customUrls.length + (query.trim() ? 1 : 0);
  const full = total >= MAX_FEEDS_PER_PANEL;
  const limitNumber = Number(limit);
  const limitValid = Number.isInteger(limitNumber) && limitNumber >= LIMIT_MIN && limitNumber <= LIMIT_MAX;
  const canSave = (selected.length + staleIds.length + customUrls.length > 0 || query.trim() !== "") && limitValid;

  function changeCountry(next: CountryCode, nextCategory?: Category | "") {
    const cats = categoriesForCountry(next);
    const cat = nextCategory !== undefined ? nextCategory : cats.includes(category as Category) || category === "" ? category : (cats[0] ?? "");
    setCountry(next);
    setCategory(cat);
    setSelected(defaultSelection(next, cat));
  }

  function changeContinent(next: Continent) {
    setContinent(next);
    const first = countriesWithFeeds(next)[0];
    if (first) changeCountry(first.code);
  }

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function findFeeds() {
    if (!urlInput.trim() || full) return;
    setChecking(true);
    setUrlError(null);
    setFound([]);
    const result = await discover(urlInput.trim());
    setChecking(false);
    if (result.feeds.length === 0) {
      setUrlError(result.error ?? "RSS를 찾지 못했습니다");
      return;
    }
    setFound(result.feeds);
  }

  /** 카탈로그 매체면 카탈로그 피드로(매체명·주석 유지), 아니면 커스텀 URL로 */
  function addFound(feed: DiscoveredFeed) {
    if (full) return;
    if (feed.catalogId) {
      const id = feed.catalogId;
      setSelected((s) => (s.includes(id) ? s : [...s, id]));
    } else if (!customUrls.includes(feed.url)) {
      setCustomUrls((u) => [...u, feed.url]);
    }
    setFound((list) => list.filter((f) => f !== feed));
    setUrlInput("");
  }

  function save() {
    const q = query.trim();
    const keywordOnly = q !== "" && selected.length + staleIds.length + customUrls.length === 0;
    onSave({
      ...(title.trim() ? { title: title.trim() } : {}),
      ...(keywordOnly ? {} : { country, ...(category ? { category } : {}) }),
      feedIds: [...selected, ...staleIds],
      customUrls,
      ...(q ? { query: q } : {}),
      limit: limitNumber,
    });
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 md:items-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-md border border-line bg-panel md:rounded-md"
      >
        <div className="flex items-center border-b border-line px-4 py-3">
          <h2 id={titleId} className="text-sm font-semibold text-headline">
            {panel ? "패널 편집" : "패널 추가"}
          </h2>
          <button type="button" onClick={onClose} aria-label="닫기" className="ml-auto rounded p-1 text-muted hover:text-headline">
            <CloseIcon />
          </button>
        </div>

        <div className="space-y-4 px-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1 text-xs text-muted">
              <span>대륙</span>
              <select aria-label="대륙" className={field} value={continent} onChange={(e) => changeContinent(e.target.value as Continent)}>
                {continentsWithFeeds.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs text-muted">
              <span>나라</span>
              <select aria-label="나라" className={field} value={country} onChange={(e) => changeCountry(e.target.value)}>
                {countriesWithFeeds(continent).map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <fieldset>
            <legend className="mb-1 text-xs text-muted">분야</legend>
            <div className="flex flex-wrap gap-1.5">
              {[...categories, "" as const].map((id) => (
                <label
                  key={id || "all"}
                  className={`cursor-pointer rounded border px-2.5 py-1 text-sm ${category === id ? "border-headline text-headline" : "border-line text-muted hover:text-headline"}`}
                >
                  <input
                    type="radio"
                    name="category"
                    className="sr-only"
                    checked={category === id}
                    onChange={() => changeCountry(country, id)}
                  />
                  {id ? getCategory(id).label : "전체"}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset aria-label="매체">
            <legend className="mb-1 flex w-full text-xs text-muted">
              <span>매체</span>
              <span className="ml-auto tabular-nums">
                {total}/{MAX_FEEDS_PER_PANEL}
              </span>
            </legend>
            <div className="divide-y divide-line rounded border border-line">
              {candidates.map((f) => {
                const checked = selected.includes(f.id);
                return (
                  <label key={f.id} className={`flex items-center gap-2 px-3 py-1.5 text-sm ${!checked && full ? "text-faint" : "text-body"}`}>
                    <input type="checkbox" checked={checked} disabled={!checked && full} onChange={() => toggle(f.id)} className="accent-[var(--accent)]" />
                    <span>{f.name}</span>
                    <span className="text-xs text-muted">
                      {getCategory(f.category).label}
                      {f.note ? ` · ${f.note}` : ""}
                    </span>
                  </label>
                );
              })}
              {candidates.length === 0 && <p className="px-3 py-2 text-sm text-muted">이 분야에는 매체가 없습니다</p>}
            </div>
            {staleIds.length > 0 && (
              <ul className="mt-2 space-y-1">
                {staleIds.map((id) => (
                  <li key={id} className="flex items-center gap-2 text-xs text-error">
                    <span>더 이상 제공되지 않는 매체: {id}</span>
                    <button type="button" className="ml-auto text-muted hover:text-headline" aria-label={`삭제: ${id}`} onClick={() => setStaleIds((s) => s.filter((x) => x !== id))}>
                      제거
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>

          <div className="space-y-1">
            <label htmlFor={`${titleId}-url`} className="text-xs text-muted">
              RSS 또는 사이트 주소
            </label>
            <div className="flex gap-2">
              <input
                id={`${titleId}-url`}
                className={field}
                placeholder="예: irishtimes.com 또는 https://example.com/rss.xml"
                value={urlInput}
                disabled={full}
                onChange={(e) => {
                  setUrlInput(e.target.value);
                  setUrlError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void findFeeds();
                  }
                }}
              />
              <button type="button" className={`${ghost} shrink-0 border border-line`} onClick={() => void findFeeds()} disabled={checking || full || !urlInput.trim()}>
                {checking ? "찾는 중…" : "찾기"}
              </button>
            </div>
            {urlError && <p className="text-xs text-error">{urlError}</p>}
            {found.length > 0 && (
              <ul aria-label="찾은 RSS" className="divide-y divide-line rounded border border-line">
                {found.map((f) => (
                  <li key={f.url} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body">{f.title}</span>
                      <span className="block truncate text-xs text-muted">
                        {f.catalogId ? "카탈로그 매체" : f.articleCount !== undefined ? `기사 ${f.articleCount}개 · ${f.url}` : f.url}
                      </span>
                    </span>
                    <button type="button" className={`${ghost} shrink-0 border border-line`} disabled={full} onClick={() => addFound(f)} aria-label={`${f.title} 추가`}>
                      추가
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {customUrls.length > 0 && (
              <ul className="space-y-1 pt-1">
                {customUrls.map((u) => (
                  <li key={u} className="flex items-center gap-2 text-xs text-body">
                    <span className="truncate">{u}</span>
                    <button type="button" className="ml-auto shrink-0 text-muted hover:text-headline" aria-label={`삭제: ${u}`} onClick={() => setCustomUrls((list) => list.filter((x) => x !== u))}>
                      제거
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <label className="block space-y-1 text-xs text-muted">
            <span>키워드 (구글 뉴스)</span>
            <input
              aria-label="키워드 (구글 뉴스)"
              className={field}
              value={query}
              maxLength={MAX_QUERY_LENGTH}
              placeholder="예: 반도체 수출, Hormuz — 최근 2일 기사를 함께 보여 줍니다"
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>

          <div className="grid grid-cols-[1fr_6rem] gap-3">
            <label className="space-y-1 text-xs text-muted">
              <span>제목</span>
              <input aria-label="제목" className={field} value={title} placeholder={panelTitle(country, category || undefined)} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="space-y-1 text-xs text-muted">
              <span>기사 수</span>
              <input aria-label="기사 수" type="number" min={LIMIT_MIN} max={LIMIT_MAX} className={field} value={limit} onChange={(e) => setLimit(e.target.value)} />
            </label>
          </div>
          {!limitValid && <p className="text-xs text-error">기사 수는 {LIMIT_MIN}~{LIMIT_MAX} 사이로 입력하세요</p>}
        </div>

        <div className="flex items-center gap-2 border-t border-line px-4 py-3">
          {panel && onDelete && (
            <button type="button" className="rounded px-3 py-1.5 text-sm text-error hover:bg-panel-header" onClick={onDelete} aria-label="패널 삭제">
              삭제
            </button>
          )}
          <button type="button" className={`${ghost} ml-auto`} onClick={onClose}>
            취소
          </button>
          <button type="button" className="rounded bg-headline px-3 py-1.5 text-sm text-panel hover:opacity-90 disabled:opacity-40" onClick={save} disabled={!canSave}>
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
