"use client";

import { useCallback, useSyncExternalStore } from "react";

/** CSS 미디어 쿼리 일치 여부. matchMedia가 없거나 서버 렌더링이면 false */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (callback: () => void) => {
      if (typeof window === "undefined" || !window.matchMedia) return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener("change", callback);
      return () => mql.removeEventListener("change", callback);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => (typeof window !== "undefined" && !!window.matchMedia && window.matchMedia(query).matches),
    () => false,
  );
}

/** 분할 화면(왼쪽 목록 + 오른쪽 원문)을 쓰는 너비 — Tailwind lg */
export const SPLIT_VIEW_QUERY = "(min-width: 1024px)";
