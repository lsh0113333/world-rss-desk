"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { addRead, LocalStorageReadHistoryRepository, type ReadHistoryRepository } from "@/lib/read-history";
import { addReadEvent, type ReadEvent } from "@/lib/recommend";

const defaultRepository = new LocalStorageReadHistoryRepository();

/** 읽은 기사 id 집합 + 추천용 읽기 기록. 기사를 열면 markRead(id, 기록) */
export function useReadHistory(repository: ReadHistoryRepository = defaultRepository) {
  const [ids, setIds] = useState<string[]>([]);
  const [events, setEvents] = useState<ReadEvent[]>([]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([repository.load(), repository.loadEvents()]).then(([savedIds, savedEvents]) => {
      if (cancelled) return;
      setIds(savedIds);
      setEvents(savedEvents);
    });
    return () => {
      cancelled = true;
    };
  }, [repository]);

  const readSet = useMemo(() => new Set(ids), [ids]);

  const markRead = useCallback(
    (id: string, event?: ReadEvent) => {
      setIds((prev) => {
        if (prev.at(-1) === id) return prev;
        const next = addRead(prev, id);
        void repository.save(next);
        return next;
      });
      if (event) {
        setEvents((prev) => {
          if (prev.at(-1)?.id === event.id) return prev;
          const next = addReadEvent(prev, event);
          void repository.saveEvents(next);
          return next;
        });
      }
    },
    [repository],
  );

  return { readSet, events, markRead };
}
