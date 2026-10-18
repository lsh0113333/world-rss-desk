"use client";

import { useEffect, useMemo } from "react";
import { getFeedById } from "@/lib/catalog";
import { MAX_FEEDS_PER_PANEL } from "@/lib/layout-store";
import { countNew, defaultPanelTitle, panelFeedOptions, sourceNotes, toggleFeed } from "@/lib/panel-feed";
import { usePanelFeed } from "@/hooks/usePanelFeed";
import { dedupeByCluster } from "@/lib/story-cluster";
import type { Article } from "@/types/article";
import type { StoryCluster } from "@/types/insights";
import type { Panel as PanelModel } from "@/types/layout";
import { FeedChips } from "./FeedChips";
import { PanelView, type PanelStatus } from "./PanelView";

interface Props {
  panel: PanelModel;
  refreshToken: number;
  now: Date;
  isFirst: boolean;
  isLast: boolean;
  selectedId?: string;
  onSelect(article: Article): void;
  readIds?: Set<string>;
  onOpen?(article: Article): void;
  onFeedsChange(id: string, feedIds: string[]): void;
  onBusyChange(id: string, busy: boolean): void;
  onMarkSeen(id: string): void;
  onEdit(id: string): void;
  onMove(id: string, direction: -1 | 1): void;
  onViewChange(id: string, view: NonNullable<PanelModel["view"]>): void;
  onWideChange(id: string, wide: boolean): void;
  /** 사이드바 나라별 새 기사 수 집계용 */
  onNewCount?(id: string, count: number): void;
  /** 받은 기사 전체 보고 (오늘의 톱·이슈·추천·키워드 워치 계산용) */
  onArticles?(id: string, articles: Article[]): void;
  /** 같은 소식 묶음 (기사 id → 묶음). 있으면 패널 안 중복을 합치고 "+N개 매체" 표시 */
  clusters?: Map<string, StoryCluster>;
  /** 키워드 워치 */
  keywords?: string[];
  /** 드래그 앤 드롭 */
  isDropTarget?: boolean;
  onDragStart?(id: string): void;
  onDragEnd?(): void;
  onDragEnterHere?(id: string): void;
  onDropHere?(id: string): void;
}

export function Panel(props: Props) {
  const { panel, refreshToken, now, isFirst, isLast, onBusyChange, onMarkSeen, onEdit, onMove } = props;
  const feed = usePanelFeed(panel, refreshToken);

  useEffect(() => {
    onBusyChange(panel.id, feed.refreshing);
  }, [panel.id, feed.refreshing, onBusyChange]);

  const newCount = feed.data ? countNew(feed.data.articles, panel.lastSeenAt) : 0;
  const { onNewCount } = props;
  useEffect(() => {
    onNewCount?.(panel.id, newCount);
  }, [panel.id, newCount, onNewCount]);

  const { onArticles, clusters } = props;
  const articles = feed.data?.articles;
  useEffect(() => {
    if (articles) onArticles?.(panel.id, articles);
  }, [panel.id, articles, onArticles]);
  const visible = useMemo(() => (articles ? dedupeByCluster(articles, clusters) : null), [articles, clusters]);

  const requested = panel.feedIds.filter((id) => getFeedById(id)).length + panel.customUrls.length + (panel.query ? 1 : 0);
  const allFailed = !!feed.data && feed.data.articles.length === 0 && feed.data.errors.length >= requested;

  let status: PanelStatus;
  if (!feed.hasFeeds) status = "no-feeds";
  else if (feed.data) status = allFailed ? "failed" : "ready";
  else if (feed.error) status = "failed";
  else status = "loading";

  return (
    <PanelView
      title={panel.title || defaultPanelTitle(panel)}
      articles={visible?.articles}
      alsoIn={visible?.alsoIn}
      keywords={props.keywords}
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
      selectedId={props.selectedId}
      view={panel.view}
      wide={panel.wide}
      anchorId={`panel-${panel.id}`}
      onViewChange={(view) => props.onViewChange(panel.id, view)}
      onWideChange={(wide) => props.onWideChange(panel.id, wide)}
      onSelect={props.onSelect}
      readIds={props.readIds}
      isDropTarget={props.isDropTarget}
      onDragStart={props.onDragStart && (() => props.onDragStart?.(panel.id))}
      onDragEnd={props.onDragEnd}
      onDragEnterHere={props.onDragEnterHere && (() => props.onDragEnterHere?.(panel.id))}
      onDropHere={props.onDropHere && (() => props.onDropHere?.(panel.id))}
      onOpen={props.onOpen}
      chips={
        <FeedChips
          options={panelFeedOptions(panel)}
          selected={panel.feedIds}
          customUrls={panel.customUrls}
          max={MAX_FEEDS_PER_PANEL}
          onToggle={(feedId) => props.onFeedsChange(panel.id, toggleFeed(panel.feedIds, feedId, MAX_FEEDS_PER_PANEL))}
        />
      }
      onRefresh={() => void feed.refresh()}
      onRetry={feed.retry}
      onMarkSeen={() => onMarkSeen(panel.id)}
      onEdit={() => onEdit(panel.id)}
      onMove={(d) => onMove(panel.id, d)}
    />
  );
}

interface ReporterProps {
  panel: PanelModel;
  refreshToken: number;
  onArticles(id: string, articles: Article[]): void;
  onBusyChange(id: string, busy: boolean): void;
}

/** 헤드라인 벽 보기에서 패널을 그리지 않고 데이터만 받아 보고한다 (SWR 키가 같아 패널과 캐시 공유) */
export function PanelFeedReporter({ panel, refreshToken, onArticles, onBusyChange }: ReporterProps) {
  const feed = usePanelFeed(panel, refreshToken);
  const articles = feed.data?.articles;
  useEffect(() => {
    if (articles) onArticles(panel.id, articles);
  }, [panel.id, articles, onArticles]);
  useEffect(() => {
    onBusyChange(panel.id, feed.refreshing);
  }, [panel.id, feed.refreshing, onBusyChange]);
  return null;
}
