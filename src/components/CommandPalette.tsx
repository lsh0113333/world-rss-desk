"use client";

import { useEffect, useMemo, useState } from "react";
import { searchCommands, type Command } from "@/lib/commands";
import type { Layout } from "@/types/layout";
import { SearchIcon } from "./Icons";

interface Props {
  layout: Layout;
  onRun(command: Command): void;
  onClose(): void;
}

const KIND_LABEL: Record<Command["kind"], string> = { jump: "이동", add: "추가", outlet: "매체", board: "보드", action: "동작" };

/** Ctrl+K 명령창: "미국 경제", "BBC", "테크"처럼 입력하고 Enter */
export function CommandPalette({ layout, onRun, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const results = useMemo(() => searchCommands(query, layout), [query, layout]);

  useEffect(() => setIndex(0), [query]);

  function run(command: Command | undefined) {
    if (!command) return;
    onRun(command);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 px-4 pt-[15vh]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="명령창" className="w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl">
        <div className="flex items-center gap-2 border-b border-line px-4">
          <span className="text-muted">
            <SearchIcon />
          </span>
          <input
            autoFocus
            role="combobox"
            aria-expanded="true"
            aria-controls="command-results"
            aria-label="명령 검색"
            placeholder="나라·분야·매체·보드 검색 (예: 미국 경제, BBC)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              else if (e.key === "ArrowDown") {
                e.preventDefault();
                setIndex((i) => Math.min(i + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setIndex((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                run(results[index]);
              }
            }}
            className="h-12 flex-1 bg-transparent text-sm text-headline outline-none placeholder:text-faint"
          />
          <kbd className="rounded border border-line px-1.5 text-[11px] text-faint">Esc</kbd>
        </div>
        <ul id="command-results" role="listbox" aria-label="검색 결과" className="max-h-80 overflow-y-auto py-1">
          {results.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted">결과가 없어요</li>}
          {results.map((c, i) => (
            <li
              key={`${c.kind}-${c.label}`}
              role="option"
              aria-selected={i === index}
              onMouseEnter={() => setIndex(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                run(c);
              }}
              className={`flex cursor-pointer items-center gap-3 px-4 py-2 text-sm ${i === index ? "bg-accent-soft text-accent" : "text-body"}`}
            >
              <span className="w-8 shrink-0 text-[11px] text-faint">{KIND_LABEL[c.kind]}</span>
              <span className="truncate">{c.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
