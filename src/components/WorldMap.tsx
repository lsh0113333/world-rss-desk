"use client";

import { getCountry } from "@/lib/constants";
import { mapScale } from "@/lib/world";
import { MAP_COLS, MAP_ROWS, REGION_CODES, TILE_POSITIONS } from "@/lib/world-map";
import type { CountryCode } from "@/types/catalog";

interface Props {
  counts: Record<CountryCode, number>;
  selected: CountryCode | null;
  onSelect(country: CountryCode | null): void;
}

/** 단계별 배경: 강조색을 섞어 라이트·다크 모두에서 같은 규칙 */
const LEVEL_BG = ["var(--panel-header)", "color-mix(in srgb, var(--accent) 14%, var(--panel))", "color-mix(in srgb, var(--accent) 30%, var(--panel))", "color-mix(in srgb, var(--accent) 52%, var(--panel))", "var(--accent)"];

/** 지금 세계 지도: 최근 24시간 나라별 기사량 (타일 지도). 누르면 그 나라가 다루는 사건만 */
export function WorldMap({ counts, selected, onSelect }: Props) {
  const scale = mapScale(counts);
  const toggle = (code: CountryCode) => onSelect(selected === code ? null : code);

  const tile = (code: CountryCode) => {
    const meta = getCountry(code);
    const n = counts[code] ?? 0;
    const level = scale[code] ?? 0;
    const active = selected === code;
    return (
      <button
        type="button"
        aria-pressed={active}
        aria-label={`${meta?.name ?? code} 기사 ${n}건`}
        title={`${meta?.name ?? code} · 최근 24시간 기사 ${n}건`}
        onClick={() => toggle(code)}
        style={{ background: LEVEL_BG[level] }}
        className={`flex aspect-square min-w-0 items-center justify-center rounded-[5px] text-[10px] font-semibold leading-none sm:text-[11px] ${
          level >= 4 ? "text-white" : level >= 3 ? "text-headline" : "text-muted"
        } ${active ? "ring-2 ring-headline ring-offset-1 ring-offset-panel" : "hover:ring-1 hover:ring-faint"}`}
      >
        {code}
      </button>
    );
  };

  return (
    <section aria-label="지금 세계 지도" className="rounded-xl border border-line bg-panel p-3">
      <div
        className="grid gap-[3px]"
        style={{ gridTemplateColumns: `repeat(${MAP_COLS}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${MAP_ROWS}, auto)` }}
      >
        {Object.entries(TILE_POSITIONS).map(([code, [col, row]]) => (
          <div key={code} style={{ gridColumn: col + 1, gridRow: row + 1 }}>
            {tile(code)}
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
        {REGION_CODES.filter((code) => counts[code]).map((code) => {
          const meta = getCountry(code);
          const active = selected === code;
          return (
            <button
              key={code}
              type="button"
              aria-pressed={active}
              aria-label={`${meta?.name ?? code} 기사 ${counts[code]}건`}
              onClick={() => toggle(code)}
              className={`rounded-full border px-2 py-0.5 ${active ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:text-headline"}`}
            >
              {meta?.flag} {meta?.name} {counts[code]}
            </button>
          );
        })}
        <span className="ml-auto flex items-center gap-1 text-faint">
          적음
          {LEVEL_BG.slice(1).map((bg) => (
            <span key={bg} className="inline-block size-2.5 rounded-sm" style={{ background: bg }} />
          ))}
          많음
        </span>
      </div>
    </section>
  );
}
