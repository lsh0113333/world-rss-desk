import type { MouseEvent } from "react";
import { formatRelative } from "@/lib/time";
import type { Article } from "@/types/article";

interface Props {
  article: Article;
  isNew: boolean;
  selected?: boolean;
  note?: string;
  now: Date;
  /** 일반 클릭 시 호출(원문 패널에 열기). 수정키·가운데 클릭은 기본 동작(새 탭) */
  onSelect?(article: Article): void;
}

export function ArticleRow({ article, isNew, selected = false, note, now, onSelect }: Props) {
  const time = formatRelative(article.publishedAt, now);

  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    if (!onSelect || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onSelect(article);
  }

  return (
    <li>
      <a
        href={article.link}
        target="_blank"
        rel="noopener noreferrer"
        title={article.summary}
        onClick={handleClick}
        aria-current={selected || undefined}
        className={`block px-3 py-2 hover:bg-panel-header [&:visited>span:first-child]:text-muted ${selected ? "bg-panel-header" : ""}`}
        data-new={isNew || undefined}
      >
        <span
          className={`block text-sm leading-snug text-headline line-clamp-2 ${selected ? "font-medium" : ""} ${isNew ? "border-l-2 border-accent pl-2.5" : ""}`}
        >
          {article.title}
        </span>
        <span className="mt-0.5 block text-xs tabular-nums text-muted">
          {[article.source, note, time].filter(Boolean).join(" · ")}
        </span>
      </a>
    </li>
  );
}
