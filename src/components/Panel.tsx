"use client";

import { useEffect } from "react";
import { getFeedById } from "@/lib/catalog";
import { panelTitle } from "@/lib/constants";
import { sourceNotes } from "@/lib/panel-feed";
import { usePanelFeed } from "@/hooks/usePanelFeed";
import type { Panel as PanelModel } from "@/types/layout";
import { PanelView, type PanelStatus } from "./PanelView";

interface Props {
  panel: PanelModel;
  refreshToken: number;
  now: Date;
  isFirst: boolean;
  isLast: boolean;
  onBusyChange(id: string, busy: boolean): void;
  onMarkSeen(id: string): void;
  onEdit(id: string): void;
  onMove(id: string, direction: -1 | 1): void;
}

export function Panel({ panel, refreshToken, now, isFirst, isLast, onBusyChange, onMarkSeen, onEdit, onMove }: Props) {
  const feed = usePanelFeed(panel, refreshToken);

  useEffect(() => {
    onBusyChange(panel.id, feed.refreshing);
  }, [panel.id, feed.refreshing, onBusyChange]);

  const requested = panel.feedIds.filter((id) => getFeedById(id)).length + panel.customUrls.length;
  const allFailed = !!feed.data && feed.data.articles.length === 0 && feed.data.errors.length >= requested;

  let status: PanelStatus;
  if (!feed.hasFeeds) status = "no-feeds";
  else if (feed.data) status = allFailed ? "failed" : "ready";
  else if (feed.error) status = "failed";
  else status = "loading";

  return (
    <PanelView
      title={panel.title || panelTitle(panel.country, panel.category)}
      articles={feed.data?.articles}
      errors={status === "ready" ? (feed.data?.errors ?? []) : []}
      status={status}
      fetchedAt={feed.data?.fetchedAt}
      lastSeenAt={panel.lastSeenAt}
      notes={sourceNotes(panel)}
      refreshing={feed.refreshing}
      coolingDown={feed.coolingDown}
      refreshError={feed.refreshError}
      isFirst={isFirst}
      isLast={isLast}
      now={now}
      onRefresh={() => void feed.refresh()}
      onRetry={feed.retry}
      onMarkSeen={() => onMarkSeen(panel.id)}
      onEdit={() => onEdit(panel.id)}
      onMove={(d) => onMove(panel.id, d)}
    />
  );
}
