import type { ReactNode } from "react";
import { MenuIcon, PlusIcon, RefreshIcon } from "./Icons";

interface Props {
  online: boolean;
  canAdd: boolean;
  refreshing: boolean;
  coolingDown: boolean;
  onRefreshAll(): void;
  onMarkAllSeen(): void;
  onAdd(): void;
  /** 모바일에서 사이드바 서랍 열기 */
  onOpenMenu?(): void;
  /** 설정 메뉴 */
  menu?: ReactNode;
}

const ghost =
  "rounded-lg px-2.5 py-1.5 text-sm text-muted hover:bg-panel-header hover:text-headline disabled:text-faint disabled:hover:bg-transparent";

export function TopBar({ online, canAdd, refreshing, coolingDown, onRefreshAll, onMarkAllSeen, onAdd, onOpenMenu, menu }: Props) {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b border-line bg-panel px-3 lg:px-6">
      {onOpenMenu && (
        <button type="button" onClick={onOpenMenu} aria-label="메뉴 열기" className="rounded-md p-1.5 text-muted hover:bg-panel-header lg:hidden">
          <MenuIcon />
        </button>
      )}
      <h1 className="text-[15px] font-bold tracking-tight text-headline lg:hidden">World RSS Desk</h1>
      <span className="hidden text-sm font-semibold text-headline lg:inline">내 화면</span>
      {!online && <span className="rounded-full bg-error/10 px-2 py-0.5 text-xs font-medium text-error">오프라인</span>}
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
          className="flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
          onClick={onAdd}
          disabled={!canAdd}
          title={canAdd ? "패널 추가" : "패널은 최대 24개까지"}
          aria-label="+ 패널"
        >
          <PlusIcon />
          <span className="hidden sm:inline">패널</span>
        </button>
        {menu}
      </nav>
    </header>
  );
}
