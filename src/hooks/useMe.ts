"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LocalStorageBoardPrefsRepository } from "@/lib/board-prefs";
import { parseMe } from "@/lib/ontology/me";
import type { Me } from "@/types/me";

/** "나" 객체 (3단계). 이 브라우저에만 저장된다. ready: 저장값을 읽었는지 (읽기 전에 "정해 주세요"를 깜빡이지 않게) */
export function useMe() {
  const repo = useMemo(() => new LocalStorageBoardPrefsRepository(), []);
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let current = true;
    void repo.loadMe().then((saved) => {
      if (!current) return;
      setMe(saved);
      setReady(true);
    });
    return () => {
      current = false;
    };
  }, [repo]);

  const update = useCallback(
    (next: Me | null) => {
      const parsed = parseMe(next);
      setMe(parsed);
      void repo.saveMe(parsed);
    },
    [repo],
  );

  return { me, ready, update };
}
