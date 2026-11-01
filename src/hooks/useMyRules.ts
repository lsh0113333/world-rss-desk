"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LocalStorageBoardPrefsRepository } from "@/lib/board-prefs";
import { parseMultipliers, type Multipliers } from "@/lib/ontology/rules";

/** 내 기준(유형 배수). 이 브라우저에 저장되고 메인과 온톨로지 화면이 함께 쓴다 */
export function useMyRules() {
  const repo = useMemo(() => new LocalStorageBoardPrefsRepository(), []);
  const [rules, setRules] = useState<Multipliers | null>(null);

  useEffect(() => {
    let current = true;
    void repo.loadRules().then((saved) => {
      if (current) setRules(saved);
    });
    return () => {
      current = false;
    };
  }, [repo]);

  const update = useCallback(
    (next: Multipliers | null) => {
      // 기본값과 같으면 내 기준이 없는 것으로 본다
      const parsed = parseMultipliers(next);
      setRules(parsed);
      void repo.saveRules(parsed);
    },
    [repo],
  );

  return { rules, update };
}
