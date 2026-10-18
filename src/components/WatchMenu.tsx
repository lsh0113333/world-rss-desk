"use client";

import { useEffect, useRef, useState } from "react";
import { formatRelative } from "@/lib/time";
import { MAX_KEYWORD_LENGTH, MAX_WATCH_KEYWORDS, type Mentions } from "@/lib/watch";
import type { Article } from "@/types/article";
import { CloseIcon } from "./Icons";

interface Props {
  keywords: string[];
  mentions: Mentions;
  readIds: Set<string>;
  now: Date;
  onChange(keywords: string[]): void;
  onSelect(article: Article): void;
}

const MAX_LISTED = 30;

/** 키워드 워치: 상단 바 버튼(안 읽은 언급 수) + 키워드 편집·언급 목록 */
export function WatchMenu({ keywords, mentions, readIds, now, onChange, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  function add() {
    const k = draft.trim();
    if (!k) return;
    onChange([...keywords, k]);
    setDraft("");
  }

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={mentions.unread > 0 ? `키워드 워치, 새 언급 ${mentions.unread}건` : "키워드 워치"}
        className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm text-muted hover:bg-panel-header hover:text-headline"
      >
        키워드
        {mentions.unread > 0 && <span className="rounded-full bg-accent px-1.5 text-[11px] font-semibold text-white tabular-nums">{mentions.unread}</span>}
      </button>
      {open && (
        <div role="dialog" aria-label="키워드 워치" className="absolute right-0 z-20 mt-1 w-[min(92vw,380px)] rounded-xl border border-line bg-panel shadow-xl">
          <div className="border-b border-line p-3">
            <p className="text-xs text-muted">관심 키워드를 등록하면 모든 패널에서 강조합니다.</p>
            <form
              className="mt-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                add();
              }}
            >
              <input
                aria-label="키워드 추가"
                value={draft}
                maxLength={MAX_KEYWORD_LENGTH}
                placeholder="예: 반도체, Iran, 환율"
                onChange={(e) => setDraft(e.target.value)}
                disabled={keywords.length >= MAX_WATCH_KEYWORDS}
                className="min-w-0 flex-1 rounded-lg border border-line bg-page px-2.5 py-1.5 text-sm text-headline outline-none focus:border-accent"
              />
              <button type="submit" className="rounded-lg bg-accent px-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40" disabled={!draft.trim()}>
                추가
              </button>
            </form>
            {keywords.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {keywords.map((k) => (
                  <li key={k} className="flex items-center gap-0.5 rounded-full bg-amber-100 py-0.5 pl-2.5 pr-1 text-xs text-amber-900 dark:bg-amber-900/60 dark:text-amber-100">
                    {k}
                    <button type="button" aria-label={`${k} 삭제`} onClick={() => onChange(keywords.filter((x) => x !== k))} className="rounded-full p-0.5 hover:bg-black/10">
                      <CloseIcon />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto p-1">
            {keywords.length > 0 && mentions.items.length === 0 && <p className="px-3 py-4 text-center text-xs text-muted">지금 화면의 기사 중에는 언급이 없습니다</p>}
            <ul>
              {mentions.items.slice(0, MAX_LISTED).map(({ article }) => (
                <li key={article.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(article);
                      setOpen(false);
                    }}
                    className="w-full rounded-md px-2.5 py-1.5 text-left hover:bg-panel-header"
                  >
                    <span className={`block text-sm leading-snug ${readIds.has(article.id) ? "text-faint" : "text-headline"}`}>{article.title}</span>
                    <span className="text-xs text-muted">{[article.source, formatRelative(article.publishedAt, now)].filter(Boolean).join(" · ")}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
