"use client";

import useSWR from "swr";
import type { FrontResponse } from "@/types/front";

// 서버는 CDN에 10분 캐시. 화면을 열어 두면 10분마다 확인
export const FRONT_REFRESH_MS = 10 * 60 * 1000;

async function fetchFront(url: string): Promise<FrontResponse> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as FrontResponse;
}

/** 가판대 데이터 (/api/front) */
export function useFront() {
  const { data, error, isLoading, mutate } = useSWR<FrontResponse>("/api/front", fetchFront, {
    refreshInterval: FRONT_REFRESH_MS,
    revalidateOnFocus: true,
    keepPreviousData: true,
    dedupingInterval: 60_000,
  });
  return { data, error, loading: isLoading, retry: () => void mutate() };
}
