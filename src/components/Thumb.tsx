"use client";

import { useState } from "react";
import { isGoogleNewsLink } from "@/lib/google-news";
import { hashId } from "@/lib/text";
import type { Article } from "@/types/article";

// 이니셜 배지 배경(옅은 색). 매체명 해시로 고정 선택
const BADGE_COLORS = [
  "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
  "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
];

interface Props {
  article: Article;
  /** 크기·모서리 등 (예: "h-12 w-16 rounded-md") */
  className: string;
}

/** 기사 썸네일: RSS 이미지 → /api/thumb(og:image) → 매체 이니셜 배지. 구글 뉴스 링크는 og:image가 구글 로고라 바로 배지 */
export function Thumb({ article, className }: Props) {
  const [failed, setFailed] = useState(false);
  const skipLookup = !article.image && isGoogleNewsLink(article.link);
  const src = article.image ?? `/api/thumb?url=${encodeURIComponent(article.link)}`;

  if (failed || skipLookup) {
    const color = BADGE_COLORS[parseInt(hashId(article.source), 36) % BADGE_COLORS.length];
    return (
      <span aria-hidden="true" className={`flex shrink-0 items-center justify-center text-sm font-semibold ${color} ${className}`}>
        {Array.from(article.source.trim())[0]?.toUpperCase() ?? "?"}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- 외부 매체 이미지, next/image 최적화 대상 아님
    <img
      src={src}
      alt=""
      role="presentation"
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`shrink-0 bg-panel-header object-cover ${className}`}
    />
  );
}
