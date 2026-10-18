"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LocalStorageLayoutRepository, type LayoutRepository } from "@/lib/layout-repository";
import {
  addBoard,
  addPanel,
  createPanel,
  defaultLayout,
  markAllSeen,
  markSeen,
  movePanel,
  movePanelTo,
  removeBoard,
  removePanel,
  renameBoard,
  setActiveBoard,
  setBoardView,
  setWatchKeywords,
  restorePanel,
  updatePanel,
  type PanelInput,
  type RemoveResult,
} from "@/lib/layout-store";
import type { BoardView, Layout, Panel } from "@/types/layout";

const defaultRepository = new LocalStorageLayoutRepository();

export interface UseLayout {
  /** 저장소를 읽기 전에는 null (SSR hydration 불일치 방지) */
  layout: Layout | null;
  /** 저장된 설정 없이 처음 들어온 경우(기본 프리셋을 띄운 상태) */
  firstVisit: boolean;
  lastRemoved: RemoveResult["removed"];
  add(input: PanelInput): void;
  update(id: string, patch: Partial<Omit<Panel, "id">>): void;
  remove(id: string): void;
  undoRemove(): void;
  clearRemoved(): void;
  move(id: string, direction: -1 | 1): void;
  moveTo(id: string, index: number): void;
  addBoard(name: string): void;
  renameBoard(id: string, name: string): void;
  removeBoard(id: string): void;
  setActiveBoard(id: string): void;
  setBoardView(id: string, view: BoardView): void;
  setWatchKeywords(keywords: string[]): void;
  markSeen(id: string): void;
  markAllSeen(): void;
  replace(layout: Layout): void;
  resetToPreset(): void;
}

export function useLayout(repository: LayoutRepository = defaultRepository): UseLayout {
  const [layout, setLayout] = useState<Layout | null>(null);
  const [firstVisit, setFirstVisit] = useState(false);
  const [lastRemoved, setLastRemoved] = useState<RemoveResult["removed"]>(null);
  const layoutRef = useRef<Layout | null>(null);
  layoutRef.current = layout;

  useEffect(() => {
    let cancelled = false;
    repository.load().then((saved) => {
      if (cancelled) return;
      setFirstVisit(saved === null);
      setLayout(saved ?? defaultLayout());
    });
    return () => {
      cancelled = true;
    };
  }, [repository]);

  useEffect(() => {
    if (layout) void repository.save(layout);
  }, [layout, repository]);

  const apply = useCallback((fn: (l: Layout) => Layout) => {
    setLayout((prev) => (prev ? fn(prev) : prev));
  }, []);

  const remove = useCallback((id: string) => {
    const current = layoutRef.current;
    if (!current) return;
    const result = removePanel(current, id);
    if (!result.removed) return;
    setLayout(result.layout);
    setLastRemoved(result.removed);
  }, []);

  const undoRemove = useCallback(() => {
    setLastRemoved((removed) => {
      if (removed) apply((l) => restorePanel(l, removed.panel, removed.index));
      return null;
    });
  }, [apply]);

  return {
    layout,
    firstVisit,
    lastRemoved,
    add: useCallback((input) => apply((l) => addPanel(l, createPanel(input))), [apply]),
    update: useCallback((id, patch) => apply((l) => updatePanel(l, id, patch)), [apply]),
    remove,
    undoRemove,
    clearRemoved: useCallback(() => setLastRemoved(null), []),
    move: useCallback((id, direction) => apply((l) => movePanel(l, id, direction)), [apply]),
    moveTo: useCallback((id, index) => apply((l) => movePanelTo(l, id, index)), [apply]),
    addBoard: useCallback((name) => apply((l) => addBoard(l, name)), [apply]),
    renameBoard: useCallback((id, name) => apply((l) => renameBoard(l, id, name)), [apply]),
    removeBoard: useCallback((id) => apply((l) => removeBoard(l, id)), [apply]),
    setActiveBoard: useCallback((id) => apply((l) => setActiveBoard(l, id)), [apply]),
    setBoardView: useCallback((id, view) => apply((l) => setBoardView(l, id, view)), [apply]),
    setWatchKeywords: useCallback((keywords) => apply((l) => setWatchKeywords(l, keywords)), [apply]),
    markSeen: useCallback((id) => apply((l) => markSeen(l, id, new Date().toISOString())), [apply]),
    markAllSeen: useCallback(() => apply((l) => markAllSeen(l, new Date().toISOString())), [apply]),
    replace: useCallback((next) => setLayout(next), []),
    resetToPreset: useCallback(() => setLayout(defaultLayout()), []),
  };
}
