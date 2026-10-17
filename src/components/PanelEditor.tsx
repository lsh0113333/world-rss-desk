"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { categoriesForCountry, feedsByCountry, feedsFor, getFeedById } from "@/lib/catalog";
import { CONTINENTS, countriesByContinent, getCategory, getCountry, panelTitle } from "@/lib/constants";
import { LIMIT_DEFAULT, LIMIT_MAX, LIMIT_MIN, MAX_FEEDS_PER_PANEL } from "@/lib/layout-store";
import type { Category, Continent, CountryCode } from "@/types/catalog";
import type { Panel } from "@/types/layout";
import { CloseIcon } from "./Icons";

export interface PanelEditorValue {
  title?: string;
  country: CountryCode;
  category?: Category;
  feedIds: string[];
  customUrls: string[];
  limit: number;
}

export interface PanelEditorProps {
  /** 없으면 추가 모드 */
  panel?: Panel;
  onSave(value: PanelEditorValue): void;
  onClose(): void;
  onDelete?(): void;
  /** 오류 메시지를 돌려주면 추가를 막는다. null이면 통과 */
  validateFeedUrl?(url: string): Promise<string | null>;
}

/** 저장 전 커스텀 URL 검증: /api/feeds로 한 번 받아본다 */
export async function validateFeedUrlViaApi(url: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/feeds?urls=${encodeURIComponent(url)}&limit=1&fresh=1`);
    const body = (await res.json()) as { error?: string; errors?: { message: string }[] };
    if (!res.ok) return body.error ?? `HTTP ${res.status}`;
    return body.errors?.[0]?.message ?? null;
  } catch {
    return "확인 중 오류가 발생했습니다";
  }
}

const countriesWithFeeds = (continent: Continent) => countriesByContinent(continent).filter((c) => feedsByCountry(c.code).length > 0);
const continentsWithFeeds = CONTINENTS.filter((c) => countriesWithFeeds(c.id).length > 0);
const defaultSelection = (country: CountryCode, category: Category | "") =>
  feedsFor(country, category || undefined)
    .slice(0, MAX_FEEDS_PER_PANEL)
    .map((f) => f.id);

function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  return /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

const field = "w-full rounded border border-line bg-panel px-3 py-2 text-sm text-headline focus:outline-2 focus:outline-accent";
const ghost = "rounded px-3 py-1.5 text-sm text-muted hover:bg-panel-header hover:text-headline";

export function PanelEditor({ panel, onSave, onClose, onDelete, validateFeedUrl = validateFeedUrlViaApi }: PanelEditorProps) {
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
  const [urlInput, setUrlInput] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

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

  const total = selected.length + customUrls.length;
  const full = total >= MAX_FEEDS_PER_PANEL;
  const limitNumber = Number(limit);
  const limitValid = Number.isInteger(limitNumber) && limitNumber >= LIMIT_MIN && limitNumber <= LIMIT_MAX;
  const canSave = selected.length + staleIds.length + customUrls.length > 0 && limitValid;

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

  async function addUrl() {
    if (!urlInput.trim() || full) return;
    const url = normalizeUrl(urlInput);
    if (customUrls.includes(url)) {
      setUrlError("이미 추가된 주소입니다");
      return;
    }
    setChecking(true);
    setUrlError(null);
    const error = await validateFeedUrl(url);
    setChecking(false);
    if (error) {
      setUrlError(error);
      return;
    }
    setCustomUrls((u) => [...u, url]);
    setUrlInput("");
  }

  function save() {
    onSave({
      ...(title.trim() ? { title: title.trim() } : {}),
      country,
      ...(category ? { category } : {}),
      feedIds: [...selected, ...staleIds],
      customUrls,
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
              RSS 주소 직접 추가
            </label>
            <div className="flex gap-2">
              <input
                id={`${titleId}-url`}
                className={field}
                placeholder="https://example.com/rss.xml"
                value={urlInput}
                disabled={full}
                onChange={(e) => {
                  setUrlInput(e.target.value);
                  setUrlError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void addUrl();
                  }
                }}
              />
              <button type="button" className={`${ghost} shrink-0 border border-line`} onClick={() => void addUrl()} disabled={checking || full || !urlInput.trim()}>
                {checking ? "확인 중…" : "추가"}
              </button>
            </div>
            {urlError && <p className="text-xs text-error">{urlError}</p>}
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
