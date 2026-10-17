"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { buildFeedsUrl } from "@/lib/panel-feed";
import type { FeedsResponse } from "@/types/article";
import type { Panel } from "@/types/layout";
import { useCooldown } from "./useCooldown";

// RSS는 푸시가 없어 주기적으로 확인한다. 매체 갱신 주기(수 분)에 맞춰 2분, 탭이 숨겨지면 SWR이 멈춘다
export const REFRESH_INTERVAL_MS = 2 * 60 * 1000;
export const MANUAL_REFRESH_COOLDOWN_MS = 30 * 1000;

export async function fetchFeeds(url: string): Promise<FeedsResponse> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as FeedsResponse;
}

/**
 * 패널 데이터. 2분 주기 + 탭 복귀 시 갱신, 실패해도 이전 데이터 유지.
 * refresh()는 서버 캐시를 건너뛰고(fresh=1) 받아 기본 키 캐시에 덮어쓴다.
 * refreshToken이 바뀌면(상단 바 전체 새로고침) refresh()를 호출한다.
 */
export function usePanelFeed(panel: Panel, refreshToken = 0) {
  const key = buildFeedsUrl(panel);
  const { data, error, isLoading, mutate } = useSWR<FeedsResponse>(key, fetchFeeds, {
    refreshInterval: REFRESH_INTERVAL_MS,
    revalidateOnFocus: true,
    keepPreviousData: true,
    dedupingInterval: 30_000,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const cooldown = useCooldown(MANUAL_REFRESH_COOLDOWN_MS);

  const busy = useRef(false);
  const panelRef = useRef(panel);
  panelRef.current = panel;

  const refresh = useCallback(async () => {
    const freshUrl = buildFeedsUrl(panelRef.current, { fresh: true });
    if (!freshUrl || busy.current) return;
    busy.current = true;
    setRefreshing(true);
    setRefreshError(null);
    try {
      await mutate(await fetchFeeds(freshUrl), { revalidate: false });
    } catch (err) {
      setRefreshError(err instanceof Error ? err.message : "새로고침 실패");
    } finally {
      busy.current = false;
      setRefreshing(false);
      cooldown.start();
    }
  }, [mutate, cooldown]);

  const lastToken = useRef(refreshToken);
  useEffect(() => {
    if (refreshToken === lastToken.current) return;
    lastToken.current = refreshToken;
    void refresh();
  }, [refreshToken, refresh]);

  return {
    hasFeeds: key !== null,
    data,
    error: error instanceof Error ? error.message : error ? String(error) : null,
    isLoading,
    refreshing,
    refreshError,
    coolingDown: cooldown.active,
    refresh,
    retry: () => void mutate(),
  };
}
