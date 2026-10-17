"use client";

import { useCallback, useEffect, useState } from "react";
import { useCooldown } from "@/hooks/useCooldown";
import { useLayout } from "@/hooks/useLayout";
import { SPLIT_VIEW_QUERY, useMediaQuery } from "@/hooks/useMediaQuery";
import { useNow } from "@/hooks/useNow";
import { useOnline } from "@/hooks/useOnline";
import { MANUAL_REFRESH_COOLDOWN_MS } from "@/hooks/usePanelFeed";
import { useReadHistory } from "@/hooks/useReadHistory";
import type { Command } from "@/lib/commands";
import { panelTitle } from "@/lib/constants";
import { downloadLayout } from "@/lib/layout-download";
import { activeBoardId, boardsOf, buildStarterLayout, MAX_BOARDS, MAX_PANELS, panelsOnBoard } from "@/lib/layout-store";
import { pickTopStories } from "@/lib/top-stories";
import type { Article } from "@/types/article";
import type { Category, CountryCode } from "@/types/catalog";
import type { PanelView } from "@/types/layout";
import { CommandPalette } from "./CommandPalette";
import { Onboarding } from "./Onboarding";
import { Panel } from "./Panel";
import { PanelEditor, type PanelEditorValue } from "./PanelEditor";
import { QuickAdd } from "./QuickAdd";
import { ReaderPane } from "./ReaderPane";
import { SettingsMenu } from "./SettingsMenu";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { TopStories } from "./TopStories";
import { UndoToast } from "./UndoToast";

type EditorTarget = { mode: "add" } | { mode: "edit"; panelId: string };

export function Dashboard() {
  const store = useLayout();
  const { layout, update, clearRemoved } = store;
  const { readSet, markRead } = useReadHistory();
  const online = useOnline();
  const now = useNow();
  const cooldown = useCooldown(MANUAL_REFRESH_COOLDOWN_MS);
  const wide = useMediaQuery(SPLIT_VIEW_QUERY);
  const [refreshToken, setRefreshToken] = useState(0);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [newCounts, setNewCounts] = useState<Record<string, number>>({});
  const [topCandidates, setTopCandidates] = useState<Record<string, Article[]>>({});
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  const [quickAdd, setQuickAdd] = useState(false);
  const [palette, setPalette] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [selected, setSelected] = useState<Article | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);

  const closeReader = useCallback(() => setSelected(null), []);
  const closeEditor = useCallback(() => setEditor(null), []);
  const closeQuickAdd = useCallback(() => setQuickAdd(false), []);
  const onFeedsChange = useCallback((id: string, feedIds: string[]) => update(id, { feedIds }), [update]);
  const onViewChange = useCallback((id: string, view: PanelView) => update(id, { view }), [update]);
  const onWideChange = useCallback((id: string, isWide: boolean) => update(id, { wide: isWide }), [update]);
  const onBusyChange = useCallback((id: string, value: boolean) => {
    setBusy((b) => (b[id] === value ? b : { ...b, [id]: value }));
  }, []);
  const onNewCount = useCallback((id: string, count: number) => {
    setNewCounts((c) => (c[id] === count ? c : { ...c, [id]: count }));
  }, []);
  const onTopArticles = useCallback((id: string, articles: Article[]) => {
    setTopCandidates((c) => ({ ...c, [id]: articles }));
  }, []);
  const openArticle = useCallback(
    (article: Article) => {
      markRead(article.id);
      setSelected(article);
    },
    [markRead],
  );
  const onOpen = useCallback((article: Article) => markRead(article.id), [markRead]);
  const refreshingAll = Object.values(busy).some(Boolean);

  // 단축키: Ctrl/⌘+K 명령창, Esc 원문 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
      } else if (e.key === "Escape" && selected && !editor && !quickAdd && !palette) {
        setSelected(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, editor, quickAdd, palette]);

  const boards = layout ? boardsOf(layout) : [];
  const boardId = layout ? activeBoardId(layout) : "";
  const panels = layout ? panelsOnBoard(layout, boardId) : [];
  const editingPanel = editor?.mode === "edit" ? layout?.panels.find((p) => p.id === editor.panelId) : undefined;
  const canAdd = !!layout && panels.length < MAX_PANELS;

  function save(value: PanelEditorValue) {
    if (editingPanel) {
      update(editingPanel.id, {
        title: value.title,
        country: value.country,
        category: value.category,
        feedIds: value.feedIds,
        customUrls: value.customUrls,
        limit: value.limit,
      });
    } else {
      store.add(value);
    }
    setEditor(null);
  }

  function refreshAll() {
    setRefreshToken((t) => t + 1);
    cooldown.start();
  }

  function jumpTo(panelId: string) {
    setMenuOpen(false);
    document.getElementById(`panel-${panelId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openAdd() {
    setMenuOpen(false);
    setQuickAdd(true);
  }

  function startWith(countries: CountryCode[], categories: Category[]) {
    store.replace(buildStarterLayout(countries, categories));
    setOnboardingDone(true);
  }

  function runCommand(c: Command) {
    switch (c.kind) {
      case "jump":
        return jumpTo(c.panelId);
      case "add":
        return store.add({ country: c.country, category: c.category });
      case "outlet":
        return store.add({ title: c.name, feedIds: c.feedIds });
      case "board":
        return store.setActiveBoard(c.boardId);
      case "action":
        if (c.action === "markAllSeen") store.markAllSeen();
        else if (c.action === "refreshAll") refreshAll();
        else if (c.action === "newBoard") store.addBoard(`보드 ${boards.length + 1}`);
        else if (c.action === "export" && layout) downloadLayout(layout);
    }
  }

  function dropOn(targetId: string) {
    if (layout && dragId && dragId !== targetId) store.moveTo(dragId, layout.panels.findIndex((p) => p.id === targetId));
    setDragId(null);
    setDropId(null);
  }

  const sidebar = (onClose?: () => void) => (
    <Sidebar
      boards={boards}
      activeBoardId={boardId}
      panels={panels}
      newCounts={newCounts}
      canAdd={canAdd}
      canAddBoard={boards.length < MAX_BOARDS}
      onJump={jumpTo}
      onAdd={openAdd}
      onSelectBoard={(id) => {
        store.setActiveBoard(id);
        setMenuOpen(false);
      }}
      onAddBoard={store.addBoard}
      onRenameBoard={store.renameBoard}
      onRemoveBoard={store.removeBoard}
      onClose={onClose}
    />
  );

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh shrink-0 lg:block">{sidebar()}</aside>
      {menuOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="h-full animate-drawer-in">{sidebar(() => setMenuOpen(false))}</div>
          <button type="button" aria-label="메뉴 닫기" className="flex-1 bg-black/30" onClick={() => setMenuOpen(false)} />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <TopBar
          online={online}
          canAdd={canAdd}
          refreshing={refreshingAll}
          coolingDown={cooldown.active}
          boardName={boards.find((b) => b.id === boardId)?.name}
          onRefreshAll={refreshAll}
          onMarkAllSeen={store.markAllSeen}
          onAdd={openAdd}
          onOpenMenu={() => setMenuOpen(true)}
          onOpenPalette={() => setPalette(true)}
          menu={<SettingsMenu layout={layout} onImport={store.replace} onReset={store.resetToPreset} />}
        />

        <main className="mx-auto max-w-[1800px] px-3 py-4 lg:px-6 lg:py-5">
          {layout && panels.length === 0 && (
            <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center text-sm text-muted">
              <p>패널을 추가하세요</p>
              <div className="flex gap-2">
                <button type="button" className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90" onClick={openAdd}>
                  + 패널
                </button>
                <button
                  type="button"
                  className="rounded-lg px-3 py-1.5 text-sm text-muted hover:bg-panel-header hover:text-headline"
                  onClick={store.resetToPreset}
                >
                  기본 구성 불러오기
                </button>
              </div>
            </div>
          )}

          {panels.length > 0 && (
            <>
              <TopStories
                panels={panels}
                stories={pickTopStories(
                  panels.map((p) => p.id),
                  topCandidates,
                )}
                now={now}
                selectedId={selected?.id}
                onSelect={openArticle}
              />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {panels.map((panel, i) => (
                  <Panel
                    key={panel.id}
                    panel={panel}
                    refreshToken={refreshToken}
                    now={now}
                    isFirst={i === 0}
                    isLast={i === panels.length - 1}
                    selectedId={selected?.id}
                    readIds={readSet}
                    onSelect={openArticle}
                    onOpen={onOpen}
                    onFeedsChange={onFeedsChange}
                    onViewChange={onViewChange}
                    onWideChange={onWideChange}
                    onBusyChange={onBusyChange}
                    onNewCount={onNewCount}
                    onTopArticles={onTopArticles}
                    onMarkSeen={store.markSeen}
                    onEdit={(id) => setEditor({ mode: "edit", panelId: id })}
                    onMove={store.move}
                    isDropTarget={dragId !== null && dropId === panel.id && dragId !== panel.id}
                    onDragStart={setDragId}
                    onDragEnd={() => {
                      setDragId(null);
                      setDropId(null);
                    }}
                    onDragEnterHere={setDropId}
                    onDropHere={dropOn}
                  />
                ))}
              </div>
            </>
          )}
        </main>
      </div>

      {selected && (
        <div className="fixed inset-y-0 right-0 z-30 w-full animate-drawer-in border-l border-line shadow-2xl lg:w-[min(760px,50vw)]">
          <ReaderPane article={selected} onClose={closeReader} mobile={!wide} />
        </div>
      )}

      {quickAdd && (
        <QuickAdd
          onAdd={(input) => {
            store.add(input);
            setQuickAdd(false);
          }}
          onClose={closeQuickAdd}
          onAdvanced={() => {
            setQuickAdd(false);
            setEditor({ mode: "add" });
          }}
        />
      )}

      {palette && layout && <CommandPalette layout={layout} onRun={runCommand} onClose={() => setPalette(false)} />}

      {store.firstVisit && !onboardingDone && <Onboarding onDone={startWith} onSkip={() => setOnboardingDone(true)} />}

      {editor && (
        <PanelEditor
          panel={editingPanel}
          onSave={save}
          onClose={closeEditor}
          onDelete={
            editingPanel
              ? () => {
                  store.remove(editingPanel.id);
                  setEditor(null);
                }
              : undefined
          }
        />
      )}

      {store.lastRemoved && (
        <UndoToast
          key={store.lastRemoved.panel.id}
          message={`"${store.lastRemoved.panel.title || panelTitle(store.lastRemoved.panel.country, store.lastRemoved.panel.category)}" 패널 삭제됨`}
          onUndo={store.undoRemove}
          onClose={clearRemoved}
        />
      )}
    </div>
  );
}
