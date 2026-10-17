"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { addRead, LocalStorageReadHistoryRepository, type ReadHistoryRepository } from "@/lib/read-history";

const defaultRepository = new LocalStorageReadHistoryRepository();

/** 읽은 기사 id 집합. 기사를 열면 markRead */
export function useReadHistory(repository: ReadHistoryRepository = defaultRepository) {
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    repository.load().then((saved) => {
      if (!cancelled) setIds(saved);
    });
    return () => {
      cancelled = true;
    };
  }, [repository]);

  const readSet = useMemo(() => new Set(ids), [ids]);

  const markRead = useCallback(
    (id: string) => {
      setIds((prev) => {
        if (prev.at(-1) === id) return prev;
        const next = addRead(prev, id);
        void repository.save(next);
        return next;
      });
    },
    [repository],
  );

  return { readSet, markRead };
}
