"use client";

import { useEffect, useState } from "react";

/** 상대시간 표시용 현재 시각. intervalMs마다 갱신 */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
