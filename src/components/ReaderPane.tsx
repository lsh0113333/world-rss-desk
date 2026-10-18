"use client";

import { useState } from "react";
import useSWR from "swr";
import { formatRelative } from "@/lib/time";
import type { Article, ArticleView, ReaderBlock } from "@/types/article";
import { CloseIcon } from "./Icons";

interface Props {
  article: Article | null;
  onClose(): void;
  /** 모바일 전체 화면 모드: 상단에 "← 목록" */
  mobile?: boolean;
  /** 같은 소식을 다룬 다른 매체 기사 (막힌 기사도 다른 곳에서 읽을 수 있게) */
  related?: Article[];
  onSelect?(article: Article): void;
}

async function fetchView(url: string): Promise<ArticleView> {
  const res = await fetch(url);
  const body = (await res.json().catch(() => null)) as (ArticleView & { error?: string }) | null;
  if (!res.ok || !body) throw new Error(body?.error ?? `HTTP ${res.status}`);
  return body;
}

const primary = "inline-block rounded bg-headline px-3 py-1.5 text-sm text-panel hover:opacity-90";

export function ReaderPane({ article, onClose, mobile = false, related = [], onSelect }: Props) {
  const key = article ? `/api/article?url=${encodeURIComponent(article.link)}` : null;
  const { data, error, isLoading } = useSWR<ArticleView>(key, fetchView, { revalidateOnFocus: false, shouldRetryOnError: false });
  // 읽기 모드에서 "원본 페이지"로 전환한 기사 링크 (다른 기사를 고르면 자동으로 읽기 모드로 돌아감)
  const [framedLink, setFramedLink] = useState<string | null>(null);

  if (!article) {
    return (
      <section className="flex h-full items-center justify-center bg-panel text-sm text-muted">왼쪽에서 기사를 선택하세요</section>
    );
  }

  const showFrame = data?.mode === "frame" || (data?.mode === "reader" && data.embeddable && framedLink === article.link);
  const modeLabel = showFrame ? "원문" : data?.mode === "reader" ? "읽기 모드" : null;
  const canToggle = data?.mode === "reader" && data.embeddable;

  return (
    <section aria-label="기사 원문" className="flex h-full flex-col bg-panel">
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-line px-3">
        {mobile && (
          <button type="button" onClick={onClose} className="rounded px-2 py-1 text-sm text-muted hover:bg-panel-header hover:text-headline">
            ← 목록
          </button>
        )}
        <span className="min-w-0 truncate text-sm font-semibold text-headline">{article.source}</span>
        {modeLabel && !canToggle && <span className="shrink-0 text-xs text-muted">{modeLabel}</span>}
        {canToggle && (
          <div role="group" aria-label="보기 전환" className="flex shrink-0 rounded border border-line text-xs">
            <button
              type="button"
              aria-pressed={!showFrame}
              onClick={() => setFramedLink(null)}
              className={`px-2 py-0.5 ${!showFrame ? "bg-panel-header font-semibold text-headline" : "text-muted hover:text-headline"}`}
            >
              읽기 모드
            </button>
            <button
              type="button"
              aria-pressed={showFrame}
              onClick={() => setFramedLink(article.link)}
              className={`border-l border-line px-2 py-0.5 ${showFrame ? "bg-panel-header font-semibold text-headline" : "text-muted hover:text-headline"}`}
            >
              원본 페이지
            </button>
          </div>
        )}
        <a
          href={article.link}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto shrink-0 rounded px-2 py-1 text-sm text-muted hover:bg-panel-header hover:text-headline"
        >
          원문 사이트에서 열기 ↗
        </a>
        {!mobile && (
          <button type="button" onClick={onClose} aria-label="원문 닫기" className="rounded p-1 text-muted hover:text-headline">
            <CloseIcon />
          </button>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading && <ReaderSkeleton />}
        {error && !data && (
          <Fallback article={article} reason={error instanceof Error ? error.message : "원문을 불러오지 못했습니다"} href={article.link} />
        )}
        {data && showFrame && (
          <iframe
            key={data.url}
            title={article.title}
            src={data.url}
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
            referrerPolicy="no-referrer"
            className="h-full w-full border-0 bg-white"
          />
        )}
        {data?.mode === "reader" && !showFrame && (
          <article className="mx-auto max-w-2xl px-6 py-6">
            <h1 className="text-xl font-semibold leading-snug text-headline">{data.title}</h1>
            <p className="mt-2 text-xs text-muted">
              {[data.siteName, data.byline, data.publishedAt ? formatRelative(data.publishedAt) : null].filter(Boolean).join(" · ")}
            </p>
            <div className="mt-5 space-y-4">
              {data.blocks.map((block, i) => (
                <Block key={i} block={block} />
              ))}
            </div>
            <p className="mt-8 border-t border-line pt-4 text-xs text-muted">
              읽기 모드는 원문에서 본문만 추출한 화면입니다. 표·영상 등은 빠질 수 있습니다.{" "}
              <a href={data.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-headline">
                원문 보기
              </a>
            </p>
          </article>
        )}
        {data?.mode === "link" && <Fallback article={article} reason={data.reason} href={data.url} />}
        {related.length > 0 && !showFrame && (data || error) && <Related articles={related} onSelect={onSelect} />}
      </div>
    </section>
  );
}

function Block({ block }: { block: ReaderBlock }) {
  switch (block.type) {
    case "h2":
      return <h2 className="pt-2 text-lg font-semibold text-headline">{block.text}</h2>;
    case "h3":
      return <h3 className="pt-1 text-base font-semibold text-headline">{block.text}</h3>;
    case "blockquote":
      return <blockquote className="border-l-2 border-line pl-4 text-[15px] leading-7 text-muted">{block.text}</blockquote>;
    case "li":
      return (
        <ul className="list-disc pl-5">
          <li className="text-[15px] leading-7 text-body">{block.text}</li>
        </ul>
      );
    case "img":
      // eslint-disable-next-line @next/next/no-img-element -- 외부 매체 이미지라 next/image 최적화 대상이 아님
      return <img src={block.src} alt={block.alt ?? ""} loading="lazy" referrerPolicy="no-referrer" className="my-4 w-full rounded" />;
    default:
      return <p className="text-[15px] leading-7 text-body">{block.text}</p>;
  }
}

/** 원문을 열 수 없을 때: 빈 화면 대신 RSS에 있던 제목·사진·요약을 보여준다 */
function Fallback({ article, reason, href }: { article: Article; reason: string; href: string }) {
  return (
    <article className="mx-auto max-w-2xl px-6 py-6">
      <h1 className="text-xl font-semibold leading-snug text-headline">{article.title}</h1>
      <p className="mt-2 text-xs text-muted">
        {[article.source, article.publishedAt ? formatRelative(article.publishedAt) : null].filter(Boolean).join(" · ")}
      </p>
      {article.image && (
        // eslint-disable-next-line @next/next/no-img-element -- 외부 매체 이미지라 next/image 최적화 대상이 아님
        <img src={article.image} alt="기사 대표 이미지" referrerPolicy="no-referrer" className="mt-5 w-full rounded" />
      )}
      {article.summary && <p className="mt-5 text-[15px] leading-7 text-body">{article.summary}</p>}
      <div className="mt-6 rounded border border-line bg-panel-header px-4 py-3">
        <p className="text-sm text-muted">이 기사는 여기서 본문을 열 수 없습니다</p>
        <p className="mt-1 text-xs text-faint">{reason}</p>
        <a href={href} target="_blank" rel="noopener noreferrer" className={`${primary} mt-3`}>
          새 탭에서 열기
        </a>
      </div>
    </article>
  );
}

function Related({ articles, onSelect }: { articles: Article[]; onSelect?(article: Article): void }) {
  return (
    <section aria-label="같은 소식, 다른 매체" className="mx-auto max-w-2xl px-6 pb-8">
      <h2 className="border-t border-line pt-4 text-xs font-semibold text-muted">같은 소식, 다른 매체</h2>
      <ul className="mt-2 space-y-1">
        {articles.map((a) => (
          <li key={a.id}>
            <button
              type="button"
              onClick={() => onSelect?.(a)}
              className="w-full rounded px-2 py-1.5 text-left hover:bg-panel-header"
            >
              <span className="block text-xs font-semibold text-muted">{a.source}</span>
              <span className="block text-sm text-headline">{a.title}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ReaderSkeleton() {
  return (
    <div aria-label="원문 불러오는 중" className="mx-auto max-w-2xl space-y-3 px-6 py-6">
      <div className="h-6 w-3/4 animate-pulse rounded bg-line" />
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="h-3.5 animate-pulse rounded bg-line" style={{ width: `${70 + ((i * 7) % 30)}%` }} />
      ))}
    </div>
  );
}
