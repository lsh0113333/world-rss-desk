"use client";

import { getCountry } from "@/lib/constants";
import { formatRelative } from "@/lib/time";
import type { Article } from "@/types/article";
import type { WorldStory } from "@/types/world";
import { Thumb } from "./Thumb";

interface Props {
  story: WorldStory;
  now: Date;
  featured?: boolean;
  onOpen(story: WorldStory): void;
}

const MAX_FLAGS = 6;

/** 시간대별 기사 수 막대 (최근 12시간) */
function Trend({ trend }: { trend: number[] }) {
  const max = Math.max(1, ...trend);
  return (
    <span aria-hidden="true" className="flex h-4 items-end gap-px">
      {trend.map((n, i) => (
        <span key={i} className="w-1 rounded-[1px] bg-accent" style={{ height: `${Math.max(8, (n / max) * 100)}%`, opacity: n ? 0.85 : 0.18 }} />
      ))}
    </span>
  );
}

/** 대표 이미지: 사건 이미지 → 기사 중 이미지 → 대표 기사 og:image(/api/thumb) → 매체 이니셜 */
export function storyThumbArticle(story: WorldStory): Article {
  const lead = story.articles[0];
  const image = story.image ?? story.articles.find((a) => a.image)?.image;
  return {
    id: lead?.id ?? story.id,
    title: story.leadTitle,
    link: lead?.link ?? "",
    publishedAt: lead?.publishedAt ?? null,
    source: lead?.source ?? story.sources[0] ?? "?",
    ...(image ? { image } : {}),
  };
}

export function StoryCard({ story, now, featured = false, onOpen }: Props) {
  const title = story.insight?.title ?? story.leadTitle;
  const lead = story.insight?.summary[0];
  const flags = story.countries.slice(0, MAX_FLAGS).map((c) => getCountry(c)?.flag ?? c);

  return (
    <button
      type="button"
      onClick={() => onOpen(story)}
      className={`group flex w-full overflow-hidden rounded-xl border border-line bg-panel text-left transition-colors hover:border-accent ${
        featured ? "flex-col sm:flex-row" : "flex-col"
      }`}
    >
      <Thumb article={storyThumbArticle(story)} className={featured ? "aspect-video w-full sm:aspect-auto sm:w-1/2 sm:min-h-64" : "aspect-video w-full"} />
      <span className={`flex min-w-0 flex-1 flex-col gap-1.5 ${featured ? "p-4 sm:p-5" : "p-3"}`}>
        <span className="flex items-center gap-1.5 text-sm" aria-hidden="true">
          {flags.map((f, i) => (
            <span key={i}>{f}</span>
          ))}
          {story.countries.length > MAX_FLAGS && <span className="text-xs text-muted">+{story.countries.length - MAX_FLAGS}</span>}
          {story.rising && <span className="ml-auto rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">급상승</span>}
        </span>
        <span className={`font-semibold leading-snug text-headline group-hover:text-accent ${featured ? "text-xl" : "line-clamp-2 text-[15px]"}`}>{title}</span>
        {lead && <span className={`text-sm leading-relaxed text-body ${featured ? "" : "line-clamp-2"}`}>{lead}</span>}
        <span className="mt-auto flex items-center gap-2 pt-1 text-xs text-muted">
          <span>
            {story.countries.length}개 나라 · 매체 {story.sources.length}곳
          </span>
          <span>· {formatRelative(story.articles[0]?.publishedAt ?? story.lastSeenAt, now)}</span>
          <span className="ml-auto">
            <Trend trend={story.trend} />
          </span>
        </span>
      </span>
    </button>
  );
}
