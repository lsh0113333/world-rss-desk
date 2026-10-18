"use client";

import { useEffect } from "react";
import { getCountry } from "@/lib/constants";
import { formatRelative } from "@/lib/time";
import type { Article } from "@/types/article";
import type { Issue, StoryItem } from "@/types/insights";
import { CloseIcon } from "./Icons";

const MAX_FLAGS = 5;

function Flags({ countries }: { countries: string[] }) {
  const shown = countries.slice(0, MAX_FLAGS);
  return (
    <span className="flex shrink-0 items-center gap-0.5" aria-label={`${countries.length}개 나라`}>
      {shown.map((c) => (
        <span key={c}>{getCountry(c)?.flag ?? "🏳️"}</span>
      ))}
      {countries.length > MAX_FLAGS && <span className="ml-0.5 text-[11px] text-muted">+{countries.length - MAX_FLAGS}</span>}
    </span>
  );
}

interface BarProps {
  issues: Issue[];
  onOpen(issue: Issue): void;
}

/** 오늘의 이슈: 여러 나라가 함께 다루는 이슈를 순위대로 한 줄에 */
export function IssueBar({ issues, onOpen }: BarProps) {
  if (issues.length === 0) return null;
  return (
    <section aria-label="오늘의 이슈" className="mb-4">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">지금 세계가 이야기하는 것</h2>
      <ol className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
        {issues.map((issue, i) => (
          <li key={issue.id} className="shrink-0">
            <button
              type="button"
              onClick={() => onOpen(issue)}
              className="flex items-center gap-2 rounded-lg border border-line bg-panel px-3 py-2 text-left shadow-sm hover:border-accent/40"
            >
              <span className="text-xs font-semibold tabular-nums text-accent">{i + 1}</span>
              <span className="max-w-56 truncate text-sm font-semibold text-headline">{issue.label}</span>
              <Flags countries={issue.countries} />
              <span className="text-xs tabular-nums text-muted">기사 {issue.items.length}</span>
              {issue.recent > 0 && <span className="rounded bg-accent-soft px-1 text-[11px] font-medium text-accent">1시간 +{issue.recent}</span>}
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

interface DialogProps {
  issue: Issue;
  now: Date;
  onSelect(article: Article): void;
  onClose(): void;
}

function groupByCountry(items: StoryItem[]): [string, StoryItem[]][] {
  const groups = new Map<string, StoryItem[]>();
  for (const item of items) {
    const key = item.country ?? "?";
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
}

/** 이슈 한 개를 나라별로 나란히: 같은 사건을 여러 나라 시각으로 비교 */
export function IssueDialog({ issue, now, onSelect, onClose }: DialogProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/30 p-3 pt-[8vh]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={`이슈: ${issue.label}`} className="flex max-h-[80vh] w-full max-w-5xl flex-col rounded-xl border border-line bg-panel shadow-xl">
        <header className="flex items-center gap-3 border-b border-line px-4 py-3">
          <h2 className="text-base font-semibold text-headline">{issue.label}</h2>
          <span className="text-xs text-muted">
            {issue.countries.length}개 나라 · 매체 {issue.sources.length}곳 · 기사 {issue.items.length}
          </span>
          <button type="button" onClick={onClose} aria-label="닫기" className="ml-auto rounded p-1 text-muted hover:text-headline">
            <CloseIcon />
          </button>
        </header>
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-4 sm:grid-cols-2 lg:grid-cols-3">
          {groupByCountry(issue.items).map(([code, items]) => {
            const meta = getCountry(code);
            return (
              <section key={code} aria-label={meta?.name ?? "나라 미상"}>
                <h3 className="mb-1 text-xs font-semibold text-muted">
                  {meta ? `${meta.flag} ${meta.name}` : "기타"} <span className="font-normal">· {items.length}</span>
                </h3>
                <ul className="space-y-0.5">
                  {items.map(({ article }) => (
                    <li key={article.id}>
                      <button type="button" onClick={() => onSelect(article)} className="w-full rounded-md px-2 py-1.5 text-left hover:bg-panel-header">
                        <span className="block text-sm leading-snug text-headline">{article.title}</span>
                        <span className="text-xs text-muted">{[article.source, formatRelative(article.publishedAt, now)].filter(Boolean).join(" · ")}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
