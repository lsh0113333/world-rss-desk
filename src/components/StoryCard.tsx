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

function Meta({ story, now, onImage = false }: { story: WorldStory; now: Date; onImage?: boolean }) {
  return (
    <span className={`flex items-center gap-2 text-xs ${onImage ? "text-white/75" : "text-muted"}`}>
      <span>
        {story.countries.length}개 나라 · 매체 {story.sources.length}곳
      </span>
      <span>· {formatRelative(story.articles[0]?.publishedAt ?? story.lastSeenAt, now)}</span>
      <span className="ml-auto">
        <Trend trend={story.trend} />
      </span>
    </span>
  );
}

function Flags({ story, onImage = false }: { story: WorldStory; onImage?: boolean }) {
  const flags = story.countries.slice(0, MAX_FLAGS).map((c) => getCountry(c)?.flag ?? c);
  return (
    <span className={`flex items-center gap-1.5 text-sm ${onImage ? "text-white" : ""}`} aria-hidden="true">
      {flags.map((f, i) => (
        <span key={i}>{f}</span>
      ))}
      {story.countries.length > MAX_FLAGS && <span className={`text-xs ${onImage ? "text-white/75" : "text-muted"}`}>+{story.countries.length - MAX_FLAGS}</span>}
      {story.rising && <span className="ml-auto rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-white">급상승</span>}
    </span>
  );
}

export function StoryCard({ story, now, featured = false, onOpen }: Props) {
  const title = story.insight?.title ?? story.leadTitle;
  const lead = story.insight?.summary[0];

  // 대표 사건: 사진 위에 제목 (뉴스룸 1면)
  if (featured) {
    return (
      <button
        type="button"
        onClick={() => onOpen(story)}
        className="group relative block aspect-[4/5] w-full overflow-hidden rounded-2xl border border-line bg-panel text-left sm:aspect-[16/9]"
      >
        <Thumb article={storyThumbArticle(story)} className="absolute inset-0 size-full" />
        <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent" />
        <span className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-4 sm:p-6">
          <Flags story={story} onImage />
          <span className="text-xl font-bold leading-snug text-white group-hover:underline sm:text-2xl">{title}</span>
          {lead && <span className="line-clamp-3 text-sm leading-relaxed text-white/85 sm:text-[15px]">{lead}</span>}
          <Meta story={story} now={now} onImage />
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onOpen(story)}
      className="group flex w-full flex-col overflow-hidden rounded-xl border border-line bg-panel text-left transition-colors hover:border-accent"
    >
      <Thumb article={storyThumbArticle(story)} className="aspect-video w-full" />
      <span className="flex min-w-0 flex-1 flex-col gap-1.5 p-3">
        <Flags story={story} />
        <span className="line-clamp-2 text-[15px] font-semibold leading-snug text-headline group-hover:text-accent">{title}</span>
        {lead && <span className="line-clamp-2 text-sm leading-relaxed text-body">{lead}</span>}
        <span className="mt-auto pt-1">
          <Meta story={story} now={now} />
        </span>
      </span>
    </button>
  );
}
