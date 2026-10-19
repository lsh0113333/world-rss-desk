"use client";

import type { ReactNode } from "react";
import type { BoardView } from "@/types/layout";
import { GlobeIcon, LayoutIcon, MenuIcon, SearchIcon, WallIcon } from "./Icons";

interface Props {
  view: BoardView;
  onView(view: BoardView): void;
  onSearch(): void;
  onMenu(): void;
}

const VIEWS: [BoardView, string, string, ReactNode][] = [
  ["world", "세계", "세계 흐름 탭", <GlobeIcon key="g" />],
  ["panels", "패널", "패널 탭", <LayoutIcon key="l" />],
  ["wall", "헤드라인", "헤드라인 벽 탭", <WallIcon key="w" />],
];

const tab = "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px]";

/** 폰·설치형 앱의 아래쪽 탭 바 (엄지로 보기 전환·검색·메뉴). 데스크톱(lg)에서는 숨긴다 */
export function BottomNav({ view, onView, onSearch, onMenu }: Props) {
  return (
    <nav
      aria-label="앱 탭"
      className="fixed inset-x-0 bottom-0 z-20 flex border-t border-line bg-panel pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {VIEWS.map(([id, label, aria, icon]) => {
        const active = view === id;
        return (
          <button
            key={id}
            type="button"
            aria-label={aria}
            aria-current={active ? "page" : undefined}
            onClick={() => onView(id)}
            className={`${tab} ${active ? "font-semibold text-accent" : "text-muted"}`}
          >
            {icon}
            {label}
          </button>
        );
      })}
      <button type="button" aria-label="검색 탭" onClick={onSearch} className={`${tab} text-muted`}>
        <SearchIcon />
        검색
      </button>
      <button type="button" aria-label="메뉴 탭" onClick={onMenu} className={`${tab} text-muted`}>
        <MenuIcon />
        메뉴
      </button>
    </nav>
  );
}
