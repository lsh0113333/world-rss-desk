"use client";

import { useEffect, useId, useState } from "react";
import { categoriesForCountry, feedsByCountry } from "@/lib/catalog";
import { CONTINENTS, countriesByContinent, getCategory, getCountry } from "@/lib/constants";
import { MAX_QUERY_LENGTH } from "@/lib/layout-store";
import type { Category, CountryCode } from "@/types/catalog";
import { CloseIcon } from "./Icons";

interface Props {
  onAdd(input: { country: CountryCode; category?: Category } | { query: string }): void;
  onClose(): void;
  /** 매체 직접 선택·RSS 주소 추가가 가능한 상세 편집 창 */
  onAdvanced(): void;
}

const groups = CONTINENTS.map((c) => ({ ...c, countries: countriesByContinent(c.id).filter((x) => feedsByCountry(x.code).length > 0) })).filter(
  (g) => g.countries.length > 0,
);

/** 2번 클릭으로 패널 추가: 나라 → 분야 */
export function QuickAdd({ onAdd, onClose, onAdvanced }: Props) {
  const titleId = useId();
  const [country, setCountry] = useState<CountryCode | null>(null);
  const [keyword, setKeyword] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const meta = country ? getCountry(country) : null;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/30 md:items-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-panel shadow-xl md:rounded-2xl">
        <div className="flex items-center gap-2 border-b border-line px-5 py-4">
          {country && (
            <button type="button" onClick={() => setCountry(null)} className="rounded-md px-1.5 py-0.5 text-sm text-muted hover:bg-panel-header" aria-label="나라 다시 고르기">
              ←
            </button>
          )}
          <h2 id={titleId} className="text-base font-semibold text-headline">
            {meta ? `${meta.flag} ${meta.name} — 분야를 고르세요` : "어느 나라 소식을 볼까요?"}
          </h2>
          <button type="button" onClick={onClose} aria-label="닫기" className="ml-auto rounded-md p-1.5 text-muted hover:bg-panel-header">
            <CloseIcon />
          </button>
        </div>

        {!country ? (
          <div className="space-y-4 px-5 py-4">
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (keyword.trim()) onAdd({ query: keyword.trim() });
              }}
            >
              <input
                aria-label="키워드로 패널 만들기"
                value={keyword}
                maxLength={MAX_QUERY_LENGTH}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="또는 키워드로: 반도체, Hormuz… (구글 뉴스)"
                className="min-w-0 flex-1 rounded-lg border border-line bg-page px-3 py-1.5 text-sm text-headline outline-none focus:border-accent"
              />
              <button type="submit" disabled={!keyword.trim()} className="rounded-lg bg-accent px-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40">
                만들기
              </button>
            </form>
            {groups.map((g) => (
              <section key={g.id}>
                <h3 className="mb-1.5 text-xs font-semibold text-muted">{g.label}</h3>
                <div className="flex flex-wrap gap-2">
                  {g.countries.map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => setCountry(c.code)}
                      className="rounded-lg border border-line px-3 py-1.5 text-sm text-body hover:border-accent/50 hover:bg-accent-soft hover:text-accent"
                    >
                      {c.flag} {c.name}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 px-5 py-5">
            {categoriesForCountry(country).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => onAdd({ country, category: cat })}
                className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-body hover:border-accent/50 hover:bg-accent-soft hover:text-accent"
              >
                {getCategory(cat).label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => onAdd({ country })}
              className="rounded-lg border border-dashed border-line px-4 py-2 text-sm text-muted hover:border-accent/50 hover:text-accent"
            >
              전체 매체
            </button>
          </div>
        )}

        <div className="border-t border-line px-5 py-3 text-right">
          <button type="button" onClick={onAdvanced} className="text-sm text-muted underline-offset-2 hover:text-accent hover:underline">
            매체 직접 고르기 · RSS 주소 추가
          </button>
        </div>
      </div>
    </div>
  );
}
