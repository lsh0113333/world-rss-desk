"use client";

import { useEffect, useRef, useState } from "react";
import { getCountry } from "@/lib/constants";
import { formatRelative } from "@/lib/time";
import type { Article } from "@/types/article";
import type { WorldStory, WorldStoryArticle } from "@/types/world";
import { CloseIcon } from "./Icons";

interface Props {
  story: WorldStory;
  now: Date;
  readIds: ReadonlySet<string>;
  /** related: 같은 사건의 다른 기사 (원문 서랍의 "같은 소식, 다른 매체") */
  onSelect(article: Article, related: Article[], country?: string): void;
  onClose(): void;
}

export function toArticle(a: WorldStoryArticle): Article {
  return { id: a.id, title: a.title, link: a.link, publishedAt: a.publishedAt, source: a.source, ...(a.image ? { image: a.image } : {}) };
}

function countryLabel(code: string): string {
  const meta = getCountry(code);
  return meta ? `${meta.flag} ${meta.name}` : code;
}

function groupByCountry(articles: WorldStoryArticle[]): [string, WorldStoryArticle[]][] {
  const groups = new Map<string, WorldStoryArticle[]>();
  for (const a of articles) groups.set(a.country, [...(groups.get(a.country) ?? []), a]);
  return [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
}

/** 이만큼 넘게 아래로 쓸어내리면 시트를 닫는다 (px) */
const SWIPE_CLOSE_PX = 90;

/** 사건 상세: AI 요약 · 왜 중요한가 · 나라별 시각(근거 기사) · 엔티티 · 나라별 기사. 폰에서는 아래에서 올라오는 시트 */
export function StoryDialog({ story, now, readIds, onSelect, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const startY = useRef<number | null>(null);
  const [drag, setDrag] = useState(0);
  const swipe = {
    onTouchStart: (e: React.TouchEvent) => {
      startY.current = e.touches[0]?.clientY ?? null;
    },
    onTouchMove: (e: React.TouchEvent) => {
      if (startY.current === null) return;
      setDrag(Math.max(0, (e.touches[0]?.clientY ?? startY.current) - startY.current));
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const end = e.changedTouches[0]?.clientY ?? startY.current ?? 0;
      const moved = startY.current === null ? 0 : end - startY.current;
      startY.current = null;
      setDrag(0);
      if (moved > SWIPE_CLOSE_PX) onClose();
    },
  };

  const { insight } = story;
  const title = insight?.title ?? story.leadTitle;
  const byId = new Map(story.articles.map((a) => [a.id, a]));
  const open = (a: WorldStoryArticle) =>
    onSelect(
      toArticle(a),
      story.articles.filter((x) => x.id !== a.id).map(toArticle),
      a.country,
    );

  const articleButton = (a: WorldStoryArticle, compact = false) => (
    <button
      type="button"
      onClick={() => open(a)}
      className={`w-full rounded-md px-2 py-1.5 text-left hover:bg-panel-header ${readIds.has(a.id) ? "opacity-60" : ""}`}
    >
      <span className={`block leading-snug text-headline ${compact ? "text-[13px]" : "text-sm"}`}>{a.title}</span>
      <span className="text-xs text-muted">{[a.source, formatRelative(a.publishedAt, now)].join(" · ")}</span>
    </button>
  );

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 sm:items-start sm:p-3 sm:pt-[6vh]"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={drag ? { transform: `translateY(${drag}px)` } : undefined}
        className="flex max-h-[92dvh] w-full max-w-4xl animate-sheet-in flex-col rounded-t-2xl border border-line bg-panel pb-[env(safe-area-inset-bottom)] shadow-xl sm:max-h-[86vh] sm:rounded-xl sm:pb-0"
      >
        <div data-testid="sheet-handle" {...swipe} className="flex justify-center pb-1 pt-2.5 sm:hidden">
          <span className="h-1 w-10 rounded-full bg-faint/60" />
        </div>
        <header {...swipe} className="flex items-start gap-3 border-b border-line px-4 pb-3 pt-1 sm:px-5 sm:pt-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted">
              {story.countries.length}개 나라 · 매체 {story.sources.length}곳 · 기사 {story.size}
              {story.rising && <span className="ml-2 font-semibold text-accent">급상승</span>}
            </p>
            <h2 className="mt-0.5 text-lg font-semibold leading-snug text-headline">{title}</h2>
            {insight && <p className="mt-0.5 truncate text-xs text-faint">{story.leadTitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="닫기" className="-mr-1 rounded-lg p-2 text-muted hover:bg-panel-header hover:text-headline">
            <CloseIcon />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-5">
          {insight ? (
            <>
              <ul className="space-y-1.5">
                {insight.summary.map((line) => (
                  <li key={line} className="flex gap-2 text-[15px] leading-relaxed text-body">
                    <span aria-hidden="true" className="mt-2.5 size-1.5 shrink-0 rounded-full bg-accent" />
                    {line}
                  </li>
                ))}
              </ul>
              {insight.why && (
                <div className="rounded-lg bg-accent-soft px-3 py-2.5">
                  <p className="text-xs font-semibold text-accent">왜 중요한가</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-headline">{insight.why}</p>
                </div>
              )}
              {insight.perspectives.length > 0 && (
                <section aria-label="나라별 시각">
                  <h3 className="mb-2 text-sm font-semibold text-headline">나라별 시각</h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {insight.perspectives.map((p) => (
                      <div key={p.country} className="rounded-lg border border-line p-3">
                        <p className="text-xs font-semibold text-muted">{countryLabel(p.country)}</p>
                        <p className="mt-1 text-sm leading-relaxed text-headline">{p.angle}</p>
                        <ul className="mt-1.5 -mx-2">
                          {p.articleIds
                            .map((id) => byId.get(id))
                            .filter((a): a is WorldStoryArticle => !!a)
                            .map((a) => (
                              <li key={a.id}>{articleButton(a, true)}</li>
                            ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              {story.entities.length > 0 && (
                <div className="flex flex-wrap gap-1.5" aria-label="관련 인물·기관·장소">
                  {story.entities.map((e) => (
                    <span key={e.id} title={e.name} className="rounded-full border border-line px-2 py-0.5 text-xs text-body">
                      {e.nameKo ?? e.name}
                    </span>
                  ))}
                </div>
              )}
              <p className="text-xs text-faint">AI가 헤드라인을 바탕으로 정리했어요. 중요한 내용은 원문으로 확인하세요.</p>
            </>
          ) : (
            <p className="rounded-lg bg-panel-header px-3 py-2 text-sm text-muted">AI 요약 준비 중이에요 (매시간 갱신). 아래에서 나라별 기사를 비교해 보세요.</p>
          )}

          <section aria-label="나라별 기사">
            <h3 className="mb-2 text-sm font-semibold text-headline">나라별 기사</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {groupByCountry(story.articles).map(([code, list]) => (
                <section key={code} aria-label={countryLabel(code)}>
                  <h4 className="mb-1 text-xs font-semibold text-muted">
                    {countryLabel(code)} <span className="font-normal">· {list.length}</span>
                  </h4>
                  <ul className="-mx-2">
                    {list.map((a) => (
                      <li key={a.id}>{articleButton(a)}</li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
