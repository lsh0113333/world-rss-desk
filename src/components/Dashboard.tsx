"use client";

import { useCallback, useState } from "react";
import { useCooldown } from "@/hooks/useCooldown";
import { useLayout } from "@/hooks/useLayout";
import { useNow } from "@/hooks/useNow";
import { useOnline } from "@/hooks/useOnline";
import { MANUAL_REFRESH_COOLDOWN_MS } from "@/hooks/usePanelFeed";
import { panelTitle } from "@/lib/constants";
import { MAX_PANELS } from "@/lib/layout-store";
import { Panel } from "./Panel";
import { PanelEditor, type PanelEditorValue } from "./PanelEditor";
import { SettingsMenu } from "./SettingsMenu";
import { TopBar } from "./TopBar";
import { UndoToast } from "./UndoToast";

type EditorTarget = { mode: "add" } | { mode: "edit"; panelId: string };

export function Dashboard() {
  const store = useLayout();
  const { layout } = store;
  const online = useOnline();
  const now = useNow();
  const cooldown = useCooldown(MANUAL_REFRESH_COOLDOWN_MS);
  const [refreshToken, setRefreshToken] = useState(0);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [editor, setEditor] = useState<EditorTarget | null>(null);

  const onBusyChange = useCallback((id: string, value: boolean) => {
    setBusy((b) => (b[id] === value ? b : { ...b, [id]: value }));
  }, []);
  const refreshingAll = Object.values(busy).some(Boolean);

  const editingPanel = editor?.mode === "edit" ? layout?.panels.find((p) => p.id === editor.panelId) : undefined;
  const closeEditor = useCallback(() => setEditor(null), []);
  const { clearRemoved } = store;

  function save(value: PanelEditorValue) {
    if (editingPanel) {
      store.update(editingPanel.id, {
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

  const panels = layout?.panels ?? [];

  return (
    <>
      <TopBar
        online={online}
        canAdd={!!layout && panels.length < MAX_PANELS}
        refreshing={refreshingAll}
        coolingDown={cooldown.active}
        onRefreshAll={refreshAll}
        onMarkAllSeen={store.markAllSeen}
        onAdd={() => setEditor({ mode: "add" })}
        menu={<SettingsMenu layout={layout} onImport={store.replace} onReset={store.resetToPreset} />}
      />

      <main className="p-3">
        {layout && panels.length === 0 && (
          <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center text-sm text-muted">
            <p>패널을 추가하세요</p>
            <div className="flex gap-2">
              <button type="button" className="rounded bg-headline px-3 py-1.5 text-sm text-panel hover:opacity-90" onClick={() => setEditor({ mode: "add" })}>
                + 패널
              </button>
              <button type="button" className="rounded px-3 py-1.5 text-sm text-muted hover:bg-panel-header hover:text-headline" onClick={store.resetToPreset}>
                기본 구성 불러오기
              </button>
            </div>
          </div>
        )}
        {panels.length > 0 && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {panels.map((panel, i) => (
              <Panel
                key={panel.id}
                panel={panel}
                refreshToken={refreshToken}
                now={now}
                isFirst={i === 0}
                isLast={i === panels.length - 1}
                onBusyChange={onBusyChange}
                onMarkSeen={store.markSeen}
                onEdit={(id) => setEditor({ mode: "edit", panelId: id })}
                onMove={store.move}
              />
            ))}
          </div>
        )}
      </main>

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
    </>
  );
}
