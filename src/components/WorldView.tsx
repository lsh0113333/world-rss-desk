"use client";

import { useState } from "react";
import { getCountry } from "@/lib/constants";
import { formatRelative } from "@/lib/time";
import { storiesForCountry } from "@/lib/world";
import type { Article } from "@/types/article";
import type { CountryCode } from "@/types/catalog";
import type { WorldInsights, WorldStory } from "@/types/world";
import { StoryCard } from "./StoryCard";
import { StoryDialog } from "./StoryDialog";
import { WorldMap } from "./WorldMap";

interface Props {
  data?: WorldInsights;
  error?: unknown;
  loading: boolean;
  now: Date;
  readIds: ReadonlySet<string>;
  onSelect(article: Article, related: Article[], country?: CountryCode): void;
}

/** 세계 흐름: 지금 세계 지도 + 사건 카드 (매시간 파이프라인 결과, /api/insights) */
export function WorldView({ data, error, loading, now, readIds, onSelect }: Props) {
  const [country, setCountry] = useState<CountryCode | null>(null);
  const [open, setOpen] = useState<WorldStory | null>(null);

  if (!data) {
    return (
      <p className="py-16 text-center text-sm text-muted">
        {error ? "세계 흐름을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요." : loading ? "세계 흐름을 불러오는 중…" : null}
      </p>
    );
  }
  if (!data.updatedAt || data.stories.length === 0) {
    return <p className="py-16 text-center text-sm text-muted">첫 분석을 기다리는 중이에요. 매시간 전 세계 피드를 모아 사건으로 묶어요.</p>;
  }

  const stories = storiesForCountry(data.stories, country);
  const [featured, ...rest] = stories;
  const countryName = country ? (getCountry(country)?.name ?? country) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-lg font-semibold text-headline">지금 세계가 이야기하는 것</h2>
        <span className="text-xs text-muted">
          사건 {data.stories.length}개 · 업데이트 {formatRelative(data.updatedAt, now)}
        </span>
      </div>

      {/* 폰: 대표 사건 → 지도 → 나머지 사건. 데스크톱: 왼쪽 사건, 오른쪽 지도 */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-4 xl:col-start-1">
          {countryName && (
            <p className="flex items-center gap-2 text-sm text-body">
              <span>
                <b className="text-headline">{countryName}</b> 매체가 다루는 사건 {stories.length}개
              </span>
              <button type="button" onClick={() => setCountry(null)} className="text-xs text-accent hover:underline">
                전체 보기
              </button>
            </p>
          )}
          {featured ? <StoryCard story={featured} now={now} featured onOpen={setOpen} /> : <p className="py-8 text-center text-sm text-muted">이 나라가 함께 다루는 사건이 아직 없어요.</p>}
        </div>
        <aside className="space-y-2 xl:col-start-2 xl:row-span-2 xl:row-start-1">
          <WorldMap counts={data.countries} selected={country} onSelect={setCountry} />
          <p className="px-1 text-xs text-faint">최근 24시간 나라별 기사량. 나라를 누르면 그 나라 매체가 다루는 사건만 보여요.</p>
        </aside>
        {rest.length > 0 && (
          <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:col-start-1 2xl:grid-cols-3">
            {rest.map((s) => (
              <StoryCard key={s.id} story={s} now={now} onOpen={setOpen} />
            ))}
          </div>
        )}
      </div>

      {open && (
        <StoryDialog
          story={open}
          now={now}
          readIds={readIds}
          onClose={() => setOpen(null)}
          onSelect={(article, related, from) => {
            setOpen(null);
            onSelect(article, related, from);
          }}
        />
      )}
    </div>
  );
}
