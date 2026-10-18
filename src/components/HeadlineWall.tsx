"use client";

import type { MouseEvent } from "react";
import { getCountry } from "@/lib/constants";
import { formatRelative } from "@/lib/time";
import { highlightParts } from "@/lib/watch";
import type { Article } from "@/types/article";
import type { StoryCluster } from "@/types/insights";

interface Props {
  clusters: StoryCluster[];
  now: Date;
  readIds?: Set<string>;
  keywords?: string[];
  selectedId?: string;
  /** 첫 로딩 중 (아직 기사가 하나도 없음) */
  loading?: boolean;
  onSelect(article: Article): void;
  onOpen?(article: Article): void;
}

const newest = (c: StoryCluster) => Math.max(0, ...c.items.map((i) => (i.article.publishedAt ? Date.parse(i.article.publishedAt) : 0)));

/** 헤드라인 벽: 사진 없이 국기+제목만 여러 열로 (같은 소식은 한 줄, 최신순) */
export function HeadlineWall({ clusters, now, readIds, keywords = [], selectedId, loading = false, onSelect, onOpen }: Props) {
  const rows = [...clusters].sort((a, b) => newest(b) - newest(a));

  if (rows.length === 0) {
    return <p className="py-16 text-center text-sm text-muted">{loading ? "헤드라인을 불러오는 중…" : "표시할 기사가 없습니다"}</p>;
  }

  return (
    <section aria-label="헤드라인 벽">
      <p className="mb-2 text-xs text-muted">헤드라인 {rows.length}개 · 같은 소식은 한 줄로 묶음</p>
      <ul className="gap-6 sm:columns-2 xl:columns-3 2xl:columns-4">
        {rows.map((cluster) => {
          const { article, country } = cluster.items[0];
          const flag = country ? (getCountry(country)?.flag ?? "") : "";
          const others = cluster.sources.length - 1;
          const read = readIds?.has(article.id);
          const selected = article.id === selectedId;

          function handleClick(e: MouseEvent<HTMLAnchorElement>) {
            onOpen?.(article);
            if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
            e.preventDefault();
            onSelect(article);
          }

          return (
            <li key={cluster.id} className="break-inside-avoid">
              <a
                href={article.link}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleClick}
                aria-current={selected || undefined}
                className={`flex gap-2 rounded-md px-1.5 py-1 hover:bg-panel-header ${selected ? "bg-accent-soft" : ""}`}
              >
                <span aria-hidden="true" className="w-5 shrink-0 text-sm">
                  {flag}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`text-[13px] leading-snug ${read && !selected ? "text-faint" : "text-headline"}`}>
                    {highlightParts(article.title, keywords).map((part, i) =>
                      part.hit ? (
                        <mark key={i} className="rounded-sm bg-amber-100 px-0.5 text-inherit dark:bg-amber-900/60">
                          {part.text}
                        </mark>
                      ) : (
                        <span key={i}>{part.text}</span>
                      ),
                    )}
                  </span>
                  <span className="ml-1.5 whitespace-nowrap text-[11px] tabular-nums text-muted">
                    {[article.source, formatRelative(article.publishedAt, now)].filter(Boolean).join(" · ")}
                    {others > 0 && ` · +${others}개 매체`}
                  </span>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
