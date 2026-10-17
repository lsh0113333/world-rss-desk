"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** start() 후 ms 동안 active=true. 새로고침 연타 방지용 */
export function useCooldown(ms: number) {
  const [active, setActive] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setActive(true);
    timer.current = setTimeout(() => setActive(false), ms);
  }, [ms]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return { active, start };
}
