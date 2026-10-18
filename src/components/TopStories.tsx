"use client";

import type { MouseEvent } from "react";
import { defaultPanelTitle } from "@/lib/panel-feed";
import { formatRelative } from "@/lib/time";
import type { TopStory } from "@/lib/top-stories";
import type { Article } from "@/types/article";
import type { Panel } from "@/types/layout";
import { Thumb } from "./Thumb";

interface Props {
  panels: Panel[];
  /** pickTopStories 결과 (패널 순서, 중복 제거) */
  stories: TopStory[];
  now: Date;
  selectedId?: string;
  onSelect(article: Article): void;
}

/** "오늘의 톱": 패널마다 최신 기사 1개를 사진 카드로 가로 나열 (패널 간 중복 제외) */
export function TopStories({ panels, stories, now, selectedId, onSelect }: Props) {
  if (panels.length === 0) return null;
  const byId = new Map(panels.map((p) => [p.id, p]));
  return (
    <section aria-label="오늘의 톱" className="mb-5">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">오늘의 톱</h2>
      <ul className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]">
        {stories.map(({ panelId, article }) => {
          const panel = byId.get(panelId);
          return panel ? (
            <TopCard key={panelId} panel={panel} article={article} now={now} selectedId={selectedId} onSelect={onSelect} />
          ) : null;
        })}
      </ul>
    </section>
  );
}

function TopCard({
  panel,
  article,
  now,
  selectedId,
  onSelect,
}: { panel: Panel; article: Article | null } & Pick<Props, "now" | "selectedId" | "onSelect">) {
  const label = panel.title || defaultPanelTitle(panel);

  if (!article) {
    return (
      <li className="w-60 shrink-0 snap-start overflow-hidden rounded-xl border border-line bg-panel shadow-sm">
        <div className="aspect-video w-full animate-pulse bg-line" />
        <div className="space-y-2 p-3">
          <div className="h-3 w-1/3 animate-pulse rounded bg-line" />
          <div className="h-3.5 w-full animate-pulse rounded bg-line" />
        </div>
      </li>
    );
  }

  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onSelect(article!);
  }

  const selected = article.id === selectedId;
  return (
    <li className="w-60 shrink-0 snap-start">
      <a
        href={article.link}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        aria-current={selected || undefined}
        className={`block h-full overflow-hidden rounded-xl border bg-panel shadow-sm transition-colors hover:border-accent/40 ${
          selected ? "border-accent" : "border-line"
        }`}
      >
        <Thumb article={article} className="aspect-video w-full" />
        <span className="block p-3">
          <span className="block truncate text-[11px] font-medium text-accent">{label}</span>
          <span className="mt-1 block text-sm font-semibold leading-snug text-headline line-clamp-3">{article.title}</span>
          <span className="mt-1.5 block text-xs tabular-nums text-muted">
            {[article.source, formatRelative(article.publishedAt, now)].filter(Boolean).join(" · ")}
          </span>
        </span>
      </a>
    </li>
  );
}
