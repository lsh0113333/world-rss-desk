"use client";

import { useState } from "react";
import { defaultPanelTitle } from "@/lib/panel-feed";
import type { Board, Panel } from "@/types/layout";
import { CloseIcon, EditIcon, GlobeIcon, PlusIcon } from "./Icons";

interface Props {
  boards: Board[];
  activeBoardId: string;
  /** 현재 보드의 패널 */
  panels: Panel[];
  newCounts: Record<string, number>;
  canAdd: boolean;
  canAddBoard: boolean;
  onJump(panelId: string): void;
  onAdd(): void;
  onSelectBoard(id: string): void;
  onAddBoard(name: string): void;
  onRenameBoard(id: string, name: string): void;
  onRemoveBoard(id: string): void;
  /** 모바일 서랍일 때만 */
  onClose?(): void;
}

const row = "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm";

/** 왼쪽 메뉴: 앱 이름, 보드(탭), 현재 보드의 패널 목록(새 기사 수), 패널 추가 */
export function Sidebar(props: Props) {
  const { boards, activeBoardId, panels, newCounts, onClose } = props;
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const total = panels.reduce((n, p) => n + (newCounts[p.id] ?? 0), 0);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (editing) props.onRenameBoard(editing, draft);
    else if (draft.trim()) props.onAddBoard(draft);
    setEditing(null);
    setAdding(false);
    setDraft("");
  }

  const input = (
    <form onSubmit={submit} className="px-2 py-1">
      <input
        autoFocus
        aria-label="보드 이름"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={submit}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setEditing(null);
            setAdding(false);
          }
        }}
        placeholder="보드 이름 (예: 경제)"
        className="w-full rounded-md border border-accent/50 bg-panel px-2 py-1 text-sm text-headline outline-none"
      />
    </form>
  );

  return (
    <nav aria-label="내 패널" className="flex h-full w-64 flex-col border-r border-line bg-panel">
      <div className="flex h-14 shrink-0 items-center gap-2 px-4">
        <span className="text-accent">
          <GlobeIcon />
        </span>
        <span className="text-[15px] font-bold tracking-tight text-headline">World RSS Desk</span>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="메뉴 닫기" className="ml-auto rounded-md p-1.5 text-muted hover:bg-panel-header">
            <CloseIcon />
          </button>
        )}
      </div>

      <div className="px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted">보드</div>
      <ul className="px-2">
        {boards.map((b) =>
          editing === b.id ? (
            <li key={b.id}>{input}</li>
          ) : (
            <li key={b.id} className="group relative">
              <button
                type="button"
                aria-current={b.id === activeBoardId || undefined}
                onClick={() => props.onSelectBoard(b.id)}
                className={`${row} ${b.id === activeBoardId ? "bg-accent-soft font-medium text-accent" : "text-body hover:bg-panel-header"}`}
              >
                <span className="min-w-0 flex-1 truncate">{b.name}</span>
              </button>
              <span className="absolute right-1 top-1/2 hidden -translate-y-1/2 gap-0.5 group-hover:flex">
                <button
                  type="button"
                  aria-label={`${b.name} 이름 바꾸기`}
                  onClick={() => {
                    setEditing(b.id);
                    setDraft(b.name);
                  }}
                  className="rounded p-1 text-faint hover:text-headline"
                >
                  <EditIcon />
                </button>
                {boards.length > 1 && (
                  <button
                    type="button"
                    aria-label={`${b.name} 보드 삭제`}
                    onClick={() => window.confirm(`"${b.name}" 보드와 그 안의 패널을 삭제할까요?`) && props.onRemoveBoard(b.id)}
                    className="rounded p-1 text-faint hover:text-error"
                  >
                    <CloseIcon />
                  </button>
                )}
              </span>
            </li>
          ),
        )}
        {adding ? (
          <li>{input}</li>
        ) : (
          props.canAddBoard && (
            <li>
              <button
                type="button"
                onClick={() => {
                  setAdding(true);
                  setDraft("");
                }}
                className={`${row} text-muted hover:bg-panel-header hover:text-accent`}
              >
                <PlusIcon />
                새 보드
              </button>
            </li>
          )
        )}
      </ul>

      <div className="flex items-center px-4 pb-1 pt-4">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">패널</span>
        {total > 0 && <span className="ml-2 text-xs font-medium text-accent">새 기사 {total}</span>}
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {panels.map((panel) => {
          const count = newCounts[panel.id] ?? 0;
          return (
            <li key={panel.id}>
              <button type="button" onClick={() => props.onJump(panel.id)} className={`${row} text-body hover:bg-panel-header hover:text-headline`}>
                <span className="min-w-0 flex-1 truncate">{panel.title || defaultPanelTitle(panel)}</span>
                {count > 0 && (
                  <span className="shrink-0 rounded-full bg-accent-soft px-1.5 text-[11px] font-semibold leading-5 tabular-nums text-accent">{count}</span>
                )}
              </button>
            </li>
          );
        })}
        {panels.length === 0 && <li className="px-2 py-1.5 text-sm text-faint">패널이 없습니다</li>}
      </ul>

      <div className="border-t border-line p-3">
        <button
          type="button"
          onClick={props.onAdd}
          disabled={!props.canAdd}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-2 text-sm text-muted hover:border-accent/50 hover:text-accent disabled:opacity-50"
        >
          <PlusIcon />
          패널 추가
        </button>
        <p className="mt-2 text-center text-[11px] text-faint">Ctrl + K 로 빠르게 찾기</p>
      </div>
    </nav>
  );
}
