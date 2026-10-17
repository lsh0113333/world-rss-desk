"use client";

import { useId, useState } from "react";
import { feedsByCountry } from "@/lib/catalog";
import { CATEGORIES, CONTINENTS, countriesByContinent } from "@/lib/constants";
import type { Category, CountryCode } from "@/types/catalog";

interface Props {
  onDone(countries: CountryCode[], categories: Category[]): void;
  /** 기본 구성 그대로 쓰기 */
  onSkip(): void;
}

const countries = CONTINENTS.flatMap((c) => countriesByContinent(c.id)).filter((c) => feedsByCountry(c.code).length > 0);

/** 첫 방문: 관심 나라·분야를 고르면 화면을 만들어 준다 */
export function Onboarding({ onDone, onSkip }: Props) {
  const titleId = useId();
  const [picked, setPicked] = useState<CountryCode[]>(["KR", "US", "WORLD"]);
  const [cats, setCats] = useState<Category[]>(["top", "economy"]);

  const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  const chip = (on: boolean) =>
    `rounded-full border px-3 py-1.5 text-sm transition-colors ${on ? "border-accent bg-accent-soft font-medium text-accent" : "border-line text-body hover:border-accent/40"}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-panel p-6 shadow-xl">
        <h2 id={titleId} className="text-xl font-bold text-headline">
          세계 소식, 한눈에 보기
        </h2>
        <p className="mt-1 text-sm text-muted">관심 있는 나라와 분야를 고르면 화면을 바로 만들어 드려요. 나중에 언제든 바꿀 수 있어요.</p>

        <h3 className="mt-6 text-sm font-semibold text-headline">나라</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {countries.map((c) => (
            <button key={c.code} type="button" aria-pressed={picked.includes(c.code)} onClick={() => setPicked((p) => toggle(p, c.code))} className={chip(picked.includes(c.code))}>
              {c.flag} {c.name}
            </button>
          ))}
        </div>

        <h3 className="mt-6 text-sm font-semibold text-headline">분야</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button key={c.id} type="button" aria-pressed={cats.includes(c.id)} onClick={() => setCats((p) => toggle(p, c.id))} className={chip(cats.includes(c.id))}>
              {c.label}
            </button>
          ))}
        </div>

        <div className="mt-8 flex items-center gap-2">
          <button type="button" onClick={onSkip} className="rounded-lg px-3 py-2 text-sm text-muted hover:bg-panel-header hover:text-headline">
            기본 구성으로 시작
          </button>
          <button
            type="button"
            onClick={() => onDone(picked, cats)}
            disabled={picked.length === 0 || cats.length === 0}
            className="ml-auto rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
          >
            내 화면 만들기
          </button>
        </div>
      </div>
    </div>
  );
}
