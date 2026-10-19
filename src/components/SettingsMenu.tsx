"use client";

import { useEffect, useId, useRef, useState } from "react";
import { downloadLayout } from "@/lib/layout-download";
import { parseImportedLayout } from "@/lib/layout-store";
import type { Layout, Theme } from "@/types/layout";
import { FeedHealthDialog } from "./FeedHealthDialog";
import { MoreIcon } from "./Icons";

interface Props {
  layout: Layout | null;
  onImport(layout: Layout): void;
  onReset(): void;
  theme?: Theme;
  onThemeChange?(theme: Theme): void;
}

const item = "block w-full px-3 py-2 text-left text-sm text-body hover:bg-panel-header hover:text-headline cursor-pointer";

export function SettingsMenu({ layout, onImport, onReset, theme = "dark", onThemeChange }: Props) {
  const [open, setOpen] = useState(false);
  const [health, setHealth] = useState(false);
  const inputId = useId();
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  function exportLayout() {
    if (!layout) return;
    downloadLayout(layout);
    setOpen(false);
  }

  async function importFile(file: File | undefined) {
    if (!file) return;
    const result = parseImportedLayout(await file.text());
    setOpen(false);
    if (!result.ok) {
      window.alert(`가져오기 실패: ${result.error}`);
      return;
    }
    if (window.confirm(`현재 설정을 덮어씁니다. 패널 ${result.layout.panels.length}개를 불러올까요?`)) onImport(result.layout);
  }

  function reset() {
    setOpen(false);
    if (window.confirm("기본 패널 8개로 초기화할까요? 현재 설정은 사라집니다.")) onReset();
  }

  return (
    <div ref={root} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-label="설정" aria-expanded={open} className="rounded p-1.5 text-muted hover:bg-panel-header hover:text-headline">
        <MoreIcon />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-1 w-52 rounded-lg border border-line bg-panel py-1 shadow-lg">
          {onThemeChange && (
            <button
              type="button"
              role="menuitem"
              className={item}
              onClick={() => {
                setOpen(false);
                onThemeChange(theme === "light" ? "dark" : "light");
              }}
            >
              {theme === "light" ? "어두운 화면으로" : "밝은 화면으로"}
            </button>
          )}
          <button type="button" role="menuitem" className={item} onClick={exportLayout}>
            설정 내보내기
          </button>
          <label role="menuitem" htmlFor={inputId} className={item}>
            설정 가져오기
          </label>
          <input
            id={inputId}
            aria-label="설정 가져오기"
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(e) => {
              void importFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            role="menuitem"
            className={item}
            onClick={() => {
              setOpen(false);
              setHealth(true);
            }}
          >
            피드 상태
          </button>
          <button type="button" role="menuitem" className={item} onClick={reset}>
            기본 구성으로 초기화
          </button>
        </div>
      )}
      {health && <FeedHealthDialog onClose={() => setHealth(false)} />}
    </div>
  );
}
