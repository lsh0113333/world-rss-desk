import type { MouseEvent } from "react";
import { formatRelative } from "@/lib/time";
import { highlightParts, matchKeywords } from "@/lib/watch";
import type { Article } from "@/types/article";
import { Thumb } from "./Thumb";

export type RowVariant = "hero" | "list" | "text";

interface Props {
  article: Article;
  isNew: boolean;
  selected?: boolean;
  /** 방금 새로 들어온 기사 — 잠깐 강조 애니메이션 */
  fresh?: boolean;
  /** hero: 큰 사진 카드 / list: 작은 썸네일 / text: 사진 없음 */
  variant?: RowVariant;
  note?: string;
  now: Date;
  /** 이미 읽은 기사 — 흐리게 */
  read?: boolean;
  /** 같은 소식을 다룬 다른 매체 수 ("+3개 매체") */
  alsoIn?: number;
  /** 키워드 워치: 제목에서 <mark>로 강조 */
  keywords?: string[];
  /** 일반 클릭 시 호출(원문 패널에 열기). 수정키·가운데 클릭은 기본 동작(새 탭) */
  onSelect?(article: Article): void;
  /** 어떤 방식으로든 기사를 열었을 때 (읽음 기록용) */
  onOpen?(article: Article): void;
}

export function ArticleRow(props: Props) {
  const { article, isNew, selected = false, fresh = false, read = false, variant = "text", note, now, onSelect, onOpen, alsoIn, keywords = [] } = props;
  const time = formatRelative(article.publishedAt, now);
  const meta = (
    <>
      {[article.source, note, time].filter(Boolean).join(" · ")}
      {alsoIn ? <span className="ml-1.5 rounded bg-panel-header px-1 py-px text-[11px] font-medium text-muted">+{alsoIn}개 매체</span> : null}
    </>
  );
  const watched = matchKeywords(article.title, keywords).length > 0;

  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    onOpen?.(article);
    if (!onSelect || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onSelect(article);
  }

  const title = (
    <span
      className={`block text-sm leading-snug ${read && !selected ? "text-faint" : "text-headline"} ${variant === "hero" ? "font-semibold line-clamp-3" : "line-clamp-2"} ${
        selected ? "font-semibold" : ""
      }`}
    >
      {isNew && <span aria-hidden="true" className="mr-1.5 inline-block size-1.5 -translate-y-0.5 rounded-full bg-accent" />}
      {watched
        ? highlightParts(article.title, keywords).map((part, i) =>
            part.hit ? (
              <mark key={i} className="rounded-sm bg-amber-100 px-0.5 text-inherit dark:bg-amber-900/60">
                {part.text}
              </mark>
            ) : (
              <span key={i}>{part.text}</span>
            ),
          )
        : article.title}
    </span>
  );

  return (
    <li className={fresh ? "animate-fresh-in" : undefined}>
      <a
        href={article.link}
        target="_blank"
        rel="noopener noreferrer"
        title={article.summary}
        onClick={handleClick}
        onAuxClick={(e) => e.button === 1 && onOpen?.(article)}
        aria-current={selected || undefined}
        data-read={read || undefined}
        data-new={isNew || undefined}
        data-fresh={fresh || undefined}
        data-watched={watched || undefined}
        className={`group block rounded-lg px-2 py-2 transition-colors hover:bg-panel-header ${selected ? "bg-accent-soft hover:bg-accent-soft" : ""}`}
      >
        {variant === "hero" ? (
          <span className="block">
            <Thumb article={article} className="mb-2 aspect-video w-full rounded-lg" />
            {title}
            <span className="mt-1 block text-xs tabular-nums text-muted">{meta}</span>
          </span>
        ) : variant === "list" ? (
          <span className="flex gap-3">
            <Thumb article={article} className="h-12 w-16 rounded-md" />
            <span className="min-w-0 flex-1">
              {title}
              <span className="mt-0.5 block text-xs tabular-nums text-muted">{meta}</span>
            </span>
          </span>
        ) : (
          <span className="block">
            {title}
            <span className="mt-0.5 block text-xs tabular-nums text-muted">{meta}</span>
          </span>
        )}
      </a>
    </li>
  );
}
