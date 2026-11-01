"use client";

import useSWR from "swr";
import type { ActorProfile, WorldBoard } from "@/types/world";

// 파이프라인은 30분마다, 서버 응답은 CDN 1분 캐시. 열어 두면 2분마다 확인
export const WORLD_REFRESH_MS = 2 * 60 * 1000;

class HttpError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`);
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new HttpError(res.status);
  return (await res.json()) as T;
}

/** 세계 상황판 (/api/world) */
export function useWorld() {
  const { data, error, isLoading, mutate } = useSWR<WorldBoard>("/api/world", fetchJson, {
    refreshInterval: WORLD_REFRESH_MS,
    revalidateOnFocus: true,
    keepPreviousData: true,
    dedupingInterval: 30_000,
  });
  return { data, error, preparing: error instanceof HttpError && error.status === 503, loading: isLoading, retry: () => void mutate() };
}

/** 행위자 페이지 (/api/actors) */
export function useActor(id: string) {
  const { data, error, isLoading } = useSWR<ActorProfile>(`/api/actors?id=${encodeURIComponent(id)}`, fetchJson);
  return { data, error, notFound: error instanceof HttpError && error.status === 404, loading: isLoading };
}
