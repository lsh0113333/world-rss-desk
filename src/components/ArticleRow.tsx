import { formatRelative } from "@/lib/time";
import type { Article } from "@/types/article";

interface Props {
  article: Article;
  isNew: boolean;
  note?: string;
  now: Date;
}

export function ArticleRow({ article, isNew, note, now }: Props) {
  const time = formatRelative(article.publishedAt, now);
  return (
    <li>
      <a
        href={article.link}
        target="_blank"
        rel="noopener noreferrer"
        title={article.summary}
        className="block px-3 py-2 hover:bg-panel-header [&:visited>span:first-child]:text-muted"
        data-new={isNew || undefined}
      >
        <span
          className={`block text-sm leading-snug text-headline line-clamp-2 ${isNew ? "border-l-2 border-accent pl-2.5" : ""}`}
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
