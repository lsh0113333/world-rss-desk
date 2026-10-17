import { countNew, feedLabel, isNewArticle } from "@/lib/panel-feed";
import { formatClock } from "@/lib/time";
import type { Article, FeedError } from "@/types/article";
import { ArticleRow } from "./ArticleRow";
import { ChevronLeftIcon, ChevronRightIcon, EditIcon, RefreshIcon } from "./Icons";

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
  onRefresh(): void;
  onRetry(): void;
  onMarkSeen(): void;
  onEdit(): void;
  onMove(direction: -1 | 1): void;
}

const iconButton = "rounded p-1 text-muted hover:text-headline disabled:text-faint disabled:hover:text-faint";

export function PanelView(props: PanelViewProps) {
  const { title, articles, errors, status, lastSeenAt, notes = {}, refreshing, coolingDown, now } = props;
  const newCount = articles ? countNew(articles, lastSeenAt) : 0;

  return (
    <article className="flex h-[28rem] flex-col rounded-md border border-line bg-panel">
      <header className="group flex items-center gap-2 border-b border-line bg-panel-header px-3 py-2">
        <h2 className="min-w-0 truncate text-sm font-semibold text-headline">{title}</h2>
        {newCount > 0 && (
          <button
            type="button"
            onClick={props.onMarkSeen}
            aria-label={`새 기사 ${newCount}개 확인`}
            title="눌러서 확인 처리"
            className="text-xs font-semibold tabular-nums text-accent hover:underline"
          >
            +{newCount}
          </button>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          {refreshing ? (
            <span className="mr-1 text-xs text-muted">갱신 중…</span>
          ) : (
            props.fetchedAt && <span className="mr-1 text-xs tabular-nums text-muted">{formatClock(props.fetchedAt)}</span>
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
          <button type="button" className={iconButton} onClick={props.onEdit} aria-label="패널 편집">
            <EditIcon />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {status === "loading" && <Skeleton />}
        {status === "no-feeds" && <Notice>선택된 매체가 없습니다</Notice>}
        {status === "failed" && (
          <Notice>
            <span>불러오지 못했습니다</span>
            <button type="button" onClick={props.onRetry} className="mt-2 rounded px-2 py-1 text-sm text-muted hover:bg-panel-header hover:text-headline">
              다시 시도
            </button>
          </Notice>
        )}
        {status === "ready" && articles && articles.length === 0 && <Notice>최근 기사가 없습니다</Notice>}
        {status === "ready" && articles && articles.length > 0 && (
          <ul className="divide-y divide-line">
            {articles.map((a) => (
              <ArticleRow key={a.id} article={a} isNew={isNewArticle(a, lastSeenAt)} note={notes[a.source]} now={now} />
            ))}
          </ul>
        )}
      </div>

      {(errors.length > 0 || props.refreshError) && (
        <footer className="space-y-0.5 border-t border-line px-3 py-1.5 text-xs text-error">
          {errors.length > 0 && (
            <p title={errors.map((e) => `${feedLabel(e.feed)}: ${e.message}`).join("\n")}>{errors.length}개 매체 불러오기 실패</p>
          )}
          {props.refreshError && <p>새로고침 실패: {props.refreshError}</p>}
        </footer>
      )}
    </article>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full flex-col items-center justify-center px-3 text-center text-sm text-muted">{children}</div>;
}

function Skeleton() {
  return (
    <div aria-label="불러오는 중" className="space-y-3 p-3">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="space-y-1.5">
          <div className="h-3.5 w-11/12 animate-pulse rounded bg-line" />
          <div className="h-3 w-1/3 animate-pulse rounded bg-line" />
        </div>
      ))}
    </div>
  );
}
