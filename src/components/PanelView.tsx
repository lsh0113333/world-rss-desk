"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { countNew, feedLabel, isNewArticle } from "@/lib/panel-feed";
import { formatClock } from "@/lib/time";
import type { Article, FeedError } from "@/types/article";
import type { PanelView as PanelViewMode } from "@/types/layout";
import { ArticleRow, type RowVariant } from "./ArticleRow";
import { ChevronLeftIcon, ChevronRightIcon, EditIcon, LayoutIcon, RefreshIcon } from "./Icons";

export type PanelStatus = "loading" | "ready" | "failed" | "no-feeds";

export interface PanelViewProps {
  title: string;
  articles?: Article[];
  errors: FeedError[];
  status: PanelStatus;
  fetchedAt?: string;
  lastSeenAt?: string;
  notes?: Record<string, string>;
  refreshing: boolean;
  coolingDown: boolean;
  refreshError?: string | null;
  isFirst: boolean;
  isLast: boolean;
  now: Date;
  /** 헤더 아래 매체 칩 줄 */
  chips?: ReactNode;
  selectedId?: string;
  /** 보기 방식 (기본 list) */
  view?: PanelViewMode;
  wide?: boolean;
  /** 사이드바에서 스크롤 이동용 DOM id */
  anchorId?: string;
  /** 읽은 기사 id */
  readIds?: Set<string>;
  /** 기사 id → 같은 소식을 다룬 다른 매체 수 */
  alsoIn?: Record<string, number>;
  /** 키워드 워치: 제목에서 강조할 키워드 */
  keywords?: string[];
  onSelect?(article: Article): void;
  onOpen?(article: Article): void;
  /** 드래그 앤 드롭으로 순서 바꾸기 (헤더를 잡고 끌기) */
  onDragStart?(): void;
  onDragEnd?(): void;
  onDropHere?(): void;
  /** 다른 패널이 이 위로 끌려오는 중 */
  isDropTarget?: boolean;
  onDragEnterHere?(): void;
  onViewChange?(view: PanelViewMode): void;
  onWideChange?(wide: boolean): void;
  onRefresh(): void;
  onRetry(): void;
  onMarkSeen(): void;
  onEdit(): void;
  onMove(direction: -1 | 1): void;
}

const iconButton =
  "rounded-md p-1.5 text-muted hover:bg-panel-header hover:text-headline disabled:text-faint disabled:hover:bg-transparent";
const FRESH_MS = 3_000;
const VIEW_LABELS: [PanelViewMode, string][] = [
  ["card", "카드"],
  ["list", "목록"],
  ["text", "텍스트"],
];

/** 첫 로드 이후 새로 나타난 기사 id (3초간) */
function useFreshIds(articles: Article[] | undefined): Set<string> {
  const known = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!articles) return;
    if (!known.current) {
      known.current = new Set(articles.map((a) => a.id));
      return;
    }
    const added = articles.filter((a) => !known.current!.has(a.id)).map((a) => a.id);
    for (const id of added) known.current.add(id);
    if (added.length === 0) return;
    setFresh(new Set(added));
    const timer = setTimeout(() => setFresh(new Set()), FRESH_MS);
    return () => clearTimeout(timer);
  }, [articles]);

  return fresh;
}

export function PanelView(props: PanelViewProps) {
  const { title, articles, errors, status, lastSeenAt, notes = {}, refreshing, coolingDown, now, view = "list" } = props;
  const newCount = articles ? countNew(articles, lastSeenAt) : 0;
  const fresh = useFreshIds(status === "ready" ? articles : undefined);

  const variantOf = (index: number): RowVariant => (view === "text" ? "text" : view === "card" && index === 0 ? "hero" : "list");

  return (
    <article
      id={props.anchorId}
      onDragOver={props.onDropHere ? (e) => e.preventDefault() : undefined}
      onDragEnter={props.onDragEnterHere}
      onDrop={
        props.onDropHere
          ? (e) => {
              e.preventDefault();
              props.onDropHere?.();
            }
          : undefined
      }
      className={`flex h-[30rem] scroll-mt-20 flex-col rounded-xl border bg-panel shadow-sm ${props.wide ? "md:col-span-2" : ""} ${
        props.isDropTarget ? "border-accent ring-2 ring-accent/30" : "border-line"
      }`}
    >
      <header
        draggable={!!props.onDragStart}
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", title);
          props.onDragStart?.();
        }}
        onDragEnd={props.onDragEnd}
        title={props.onDragStart ? "끌어서 순서 바꾸기" : undefined}
        className={`group flex items-center gap-2 px-4 pb-2 pt-3 ${props.onDragStart ? "cursor-grab active:cursor-grabbing" : ""}`}
      >
        <h2 className="min-w-0 truncate text-sm font-semibold text-headline">{title}</h2>
        {newCount > 0 && (
          <button
            type="button"
            onClick={props.onMarkSeen}
            aria-label={`새 기사 ${newCount}개 확인`}
            title="눌러서 확인 처리"
            className="shrink-0 rounded-full bg-accent px-1.5 text-[11px] font-semibold leading-5 tabular-nums text-white hover:opacity-90"
          >
            +{newCount}
          </button>
        )}
        <div className="ml-auto flex shrink-0 items-center">
          {refreshing ? (
            <span className="mr-1 text-xs text-muted">갱신 중…</span>
          ) : (
            props.fetchedAt && <span className="mr-1 text-xs tabular-nums text-faint">{formatClock(props.fetchedAt)}</span>
          )}
          <button
            type="button"
            className={`${iconButton} md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100`}
            onClick={() => props.onMove(-1)}
            disabled={props.isFirst}
            aria-label="앞으로 이동"
          >
            <ChevronLeftIcon />
          </button>
          <button
            type="button"
            className={`${iconButton} md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100`}
            onClick={() => props.onMove(1)}
            disabled={props.isLast}
            aria-label="뒤로 이동"
          >
            <ChevronRightIcon />
          </button>
          <button
            type="button"
            className={iconButton}
            onClick={props.onRefresh}
            disabled={refreshing || coolingDown || status === "no-feeds"}
            aria-label="새로고침"
            title={coolingDown ? "30초 후 다시 가능" : "새로고침"}
          >
            <RefreshIcon />
          </button>
          <ViewMenu view={view} wide={!!props.wide} onViewChange={props.onViewChange} onWideChange={props.onWideChange} />
          <button type="button" className={iconButton} onClick={props.onEdit} aria-label="패널 편집">
            <EditIcon />
          </button>
        </div>
      </header>
      {props.chips}

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {status === "loading" && <Skeleton withThumb={view !== "text"} />}
        {status === "no-feeds" && <Notice>선택된 매체가 없습니다</Notice>}
        {status === "failed" && (
          <Notice>
            <span>불러오지 못했습니다</span>
            <button
              type="button"
              onClick={props.onRetry}
              className="mt-2 rounded-lg px-2.5 py-1.5 text-sm text-muted hover:bg-panel-header hover:text-headline"
            >
              다시 시도
            </button>
          </Notice>
        )}
        {status === "ready" && articles && articles.length === 0 && <Notice>최근 기사가 없습니다</Notice>}
        {status === "ready" && articles && articles.length > 0 && (
          <ul className="space-y-0.5">
            {articles.map((a, i) => (
              <ArticleRow
                key={a.id}
                article={a}
                variant={variantOf(i)}
                isNew={isNewArticle(a, lastSeenAt)}
                fresh={fresh.has(a.id)}
                selected={a.id === props.selectedId}
                read={props.readIds?.has(a.id)}
                note={notes[a.source]}
                alsoIn={props.alsoIn?.[a.id]}
                keywords={props.keywords}
                now={now}
                onSelect={props.onSelect}
                onOpen={props.onOpen}
              />
            ))}
          </ul>
        )}
      </div>

      {(errors.length > 0 || props.refreshError) && (
        <footer className="space-y-0.5 border-t border-line px-4 py-1.5 text-xs text-error">
          {errors.length > 0 && (
            <p title={errors.map((e) => `${feedLabel(e.feed)}: ${e.message}`).join("\n")}>{errors.length}개 매체 불러오기 실패</p>
          )}
          {props.refreshError && <p>새로고침 실패: {props.refreshError}</p>}
        </footer>
      )}
    </article>
  );
}

function ViewMenu({
  view,
  wide,
  onViewChange,
  onWideChange,
}: {
  view: PanelViewMode;
  wide: boolean;
  onViewChange?(view: PanelViewMode): void;
  onWideChange?(wide: boolean): void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !root.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", close);
    };
  }, [open]);

  const item = "flex w-full items-center justify-between px-3 py-1.5 text-left text-sm text-body hover:bg-panel-header";
  return (
    <div ref={root} className="relative">
      <button type="button" className={iconButton} onClick={() => setOpen((o) => !o)} aria-label="보기 방식" aria-expanded={open}>
        <LayoutIcon />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-20 mt-1 w-36 rounded-lg border border-line bg-panel py-1 shadow-md">
          {VIEW_LABELS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="menuitemradio"
              aria-checked={view === id}
              className={item}
              onClick={() => {
                onViewChange?.(id);
                setOpen(false);
              }}
            >
              {label}
              {view === id && <span aria-hidden="true" className="text-accent">✓</span>}
            </button>
          ))}
          <div className="my-1 border-t border-line" />
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={wide}
            className={`${item} hidden md:flex`}
            onClick={() => {
              onWideChange?.(!wide);
              setOpen(false);
            }}
          >
            넓게 보기
            {wide && <span aria-hidden="true" className="text-accent">✓</span>}
          </button>
        </div>
      )}
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full flex-col items-center justify-center px-3 text-center text-sm text-muted">{children}</div>;
}

function Skeleton({ withThumb }: { withThumb: boolean }) {
  return (
    <div aria-label="불러오는 중" className="space-y-3 p-2">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex gap-3">
          {withThumb && <div className="h-12 w-16 shrink-0 animate-pulse rounded-md bg-line" />}
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-11/12 animate-pulse rounded bg-line" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-line" />
          </div>
        </div>
      ))}
    </div>
  );
}
