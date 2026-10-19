"use client";

import useSWR from "swr";
import type { WorldInsights } from "@/types/world";

// 파이프라인은 매시간 돈다. 화면은 5분마다 확인 (서버 응답도 CDN 5분 캐시)
export const WORLD_REFRESH_MS = 5 * 60 * 1000;

async function fetchInsights(url: string): Promise<WorldInsights> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as WorldInsights;
}

/** 세계 흐름 데이터. enabled가 false면 요청하지 않는다 (다른 보기일 때) */
export function useWorldInsights(enabled: boolean) {
  const { data, error, isLoading } = useSWR<WorldInsights>(enabled ? "/api/insights" : null, fetchInsights, {
    refreshInterval: WORLD_REFRESH_MS,
    revalidateOnFocus: true,
    keepPreviousData: true,
    dedupingInterval: 60_000,
  });
  return { data, error, loading: isLoading };
}
