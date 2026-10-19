import type { ReactNode } from "react";
import { MenuIcon, PlusIcon, RefreshIcon, SearchIcon } from "./Icons";

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
  /** 명령창(Ctrl+K) 열기 */
  onOpenPalette?(): void;
  /** 현재 보드 이름 */
  boardName?: string;
  /** 키워드 워치 버튼 */
  watch?: ReactNode;
  /** 설정 메뉴 */
  menu?: ReactNode;
}

const ghost =
  "rounded-lg px-2.5 py-1.5 text-sm text-muted hover:bg-panel-header hover:text-headline disabled:text-faint disabled:hover:bg-transparent";

export function TopBar({ online, canAdd, refreshing, coolingDown, onRefreshAll, onMarkAllSeen, onAdd, onOpenMenu, onOpenPalette, boardName = "내 화면", watch, menu }: Props) {
  return (
    <header className="sticky top-0 z-10 flex h-[calc(3.5rem+env(safe-area-inset-top))] items-center gap-2 border-b border-line bg-panel px-3 pt-[env(safe-area-inset-top)] lg:px-6">
      {onOpenMenu && (
        <button type="button" onClick={onOpenMenu} aria-label="메뉴 열기" className="rounded-md p-1.5 text-muted hover:bg-panel-header lg:hidden">
          <MenuIcon />
        </button>
      )}
      <h1 className="text-[15px] font-bold tracking-tight text-headline lg:hidden">World RSS Desk</h1>
      <span className="hidden text-sm font-semibold text-headline lg:inline">{boardName}</span>
      {!online && <span className="rounded-full bg-error/10 px-2 py-0.5 text-xs font-medium text-error">오프라인</span>}
      {onOpenPalette && (
        <button
          type="button"
          onClick={onOpenPalette}
          aria-label="검색 · 명령"
          className="ml-2 hidden h-9 w-72 items-center gap-2 rounded-lg border border-line bg-page px-3 text-sm text-faint hover:border-accent/40 md:flex"
        >
          <SearchIcon />
          <span className="flex-1 text-left">나라·분야·매체 검색</span>
          <kbd className="rounded border border-line px-1.5 text-[11px]">Ctrl K</kbd>
        </button>
      )}
      <nav className="ml-auto flex items-center gap-1">
        {watch}
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
