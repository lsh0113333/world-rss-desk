import type { ReactNode } from "react";
import { RefreshIcon } from "./Icons";

interface Props {
  online: boolean;
  canAdd: boolean;
  refreshing: boolean;
  coolingDown: boolean;
  onRefreshAll(): void;
  onMarkAllSeen(): void;
  onAdd(): void;
  /** 설정 메뉴 */
  menu?: ReactNode;
}

const ghost = "rounded px-2 py-1 text-sm text-muted hover:bg-panel-header hover:text-headline disabled:text-faint disabled:hover:bg-transparent";

export function TopBar({ online, canAdd, refreshing, coolingDown, onRefreshAll, onMarkAllSeen, onAdd, menu }: Props) {
  return (
    <header className="sticky top-0 z-10 flex h-11 items-center gap-2 border-b border-line bg-panel px-3">
      <h1 className="text-sm font-semibold tracking-tight text-headline">World RSS Desk</h1>
      {!online && <span className="text-xs text-error">오프라인</span>}
      <nav className="ml-auto flex items-center gap-1">
        <button type="button" className={`${ghost} hidden sm:block`} onClick={onMarkAllSeen}>
          모두 확인
        </button>
        <button
          type="button"
          className={`${ghost} flex items-center gap-1`}
          onClick={onRefreshAll}
          disabled={refreshing || coolingDown}
          aria-label="전체 새로고침"
          title={coolingDown ? "30초 후 다시 가능" : "전체 새로고침"}
        >
          <RefreshIcon />
          {refreshing && <span className="text-xs">갱신 중…</span>}
        </button>
        <button
          type="button"
          className="rounded bg-headline px-3 py-1.5 text-sm text-panel hover:opacity-90 disabled:opacity-40"
          onClick={onAdd}
          disabled={!canAdd}
          title={canAdd ? "패널 추가" : "패널은 최대 24개까지"}
        >
          + 패널
        </button>
        {menu}
      </nav>
    </header>
  );
}
