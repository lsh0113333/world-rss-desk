import { panelTitle } from "@/lib/constants";
import type { Panel } from "@/types/layout";
import { CloseIcon, GlobeIcon, PlusIcon } from "./Icons";

interface Props {
  panels: Panel[];
  newCounts: Record<string, number>;
  canAdd: boolean;
  onJump(panelId: string): void;
  onAdd(): void;
  /** 모바일 서랍일 때만 */
  onClose?(): void;
}

/** 왼쪽 메뉴: 앱 이름, 내 패널 목록(새 기사 수), 패널 추가 */
export function Sidebar({ panels, newCounts, canAdd, onJump, onAdd, onClose }: Props) {
  const total = Object.values(newCounts).reduce((a, b) => a + b, 0);
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

      <div className="flex items-center px-4 pb-1 pt-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">내 패널</span>
        {total > 0 && <span className="ml-2 text-xs font-medium text-accent">새 기사 {total}</span>}
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {panels.map((panel) => {
          const count = newCounts[panel.id] ?? 0;
          return (
            <li key={panel.id}>
              <button
                type="button"
                onClick={() => onJump(panel.id)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-body hover:bg-panel-header hover:text-headline"
              >
                <span className="min-w-0 flex-1 truncate">{panel.title || panelTitle(panel.country, panel.category)}</span>
                {count > 0 && (
                  <span className="shrink-0 rounded-full bg-accent-soft px-1.5 text-[11px] font-semibold leading-5 tabular-nums text-accent">
                    {count}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="border-t border-line p-3">
        <button
          type="button"
          onClick={onAdd}
          disabled={!canAdd}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-2 text-sm text-muted hover:border-accent/50 hover:text-accent disabled:opacity-50"
        >
          <PlusIcon />
          패널 추가
        </button>
      </div>
    </nav>
  );
}
