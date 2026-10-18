"use client";

import { getCountry } from "@/lib/constants";
import { MIN_EVENTS_FOR_PROFILE, type PanelSuggestion, type Recommendation } from "@/lib/recommend";
import { formatRelative } from "@/lib/time";
import type { Article } from "@/types/article";

interface Props {
  recommendations: Recommendation[];
  suggestions: PanelSuggestion[];
  /** 지금까지 읽은 기사 수 (추천이 시작되기 전 안내용) */
  readCount: number;
  now: Date;
  onSelect(article: Article): void;
  onAddPanel(suggestion: PanelSuggestion): void;
}

/** 내 입맛 추천: 읽은 기사 기록으로 고른 새 기사 + 패널 추가 제안 (브라우저 안에서 계산) */
export function ForYou({ recommendations, suggestions, readCount, now, onSelect, onAddPanel }: Props) {
  if (recommendations.length === 0 && suggestions.length === 0) {
    if (readCount === 0 || readCount >= MIN_EVENTS_FOR_PROFILE) return null;
    return (
      <p className="mb-4 text-xs text-muted">
        기사를 {MIN_EVENTS_FOR_PROFILE - readCount}개 더 읽으면 관심사에 맞춘 추천이 시작됩니다 (기록은 이 브라우저에만 저장).
      </p>
    );
  }

  return (
    <section aria-label="추천" className="mb-4">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">내 관심사 추천</h2>
      {recommendations.length > 0 && (
        <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
          {recommendations.map(({ item, reason }) => (
            <li key={item.article.id} className="w-64 shrink-0">
              <button
                type="button"
                onClick={() => onSelect(item.article)}
                className="block h-full w-full rounded-lg border border-line bg-panel px-3 py-2 text-left shadow-sm hover:border-accent/40"
              >
                <span className="block truncate text-[11px] font-medium text-accent">{reason}</span>
                <span className="mt-0.5 block text-sm leading-snug text-headline line-clamp-2">{item.article.title}</span>
                <span className="mt-1 block text-xs text-muted">
                  {[item.article.source, formatRelative(item.article.publishedAt, now)].filter(Boolean).join(" · ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {suggestions.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>{suggestions[0].reason} →</span>
          {suggestions.map((s) => {
            const meta = getCountry(s.country);
            return (
              <button
                key={s.country}
                type="button"
                onClick={() => onAddPanel(s)}
                className="rounded-full border border-line bg-panel px-2.5 py-1 text-headline hover:border-accent/40"
              >
                + {meta ? `${meta.flag} ${meta.name}` : s.country} 패널
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
