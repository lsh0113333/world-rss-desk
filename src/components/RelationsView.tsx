"use client";

import Link from "next/link";
import { useState } from "react";
import { useWorld } from "@/hooks/useWorld";
import { countryName } from "@/ontology/countries";
import { EVENT_TYPES, RULES } from "@/ontology/world";
import type { BoardRelations, InterestMatrix, RelationPair } from "@/types/world";

/** 2단계 관계 화면 (intent/2026-11-08-relations.md). 계산은 파이프라인 규칙, 여기서는 그리기만 */

function lean(t: number) {
  if (t <= -RULES.relationLean) return { label: "갈등", className: "text-[var(--error)]" };
  if (t >= RULES.relationLean) return { label: "협력", className: "text-accent" };
  return { label: "엇갈림", className: "text-muted" };
}

/** -1(왼쪽, 빨강) ~ 1(오른쪽, 파랑) 사이에 점 하나 */
function Thermometer({ t }: { t: number }) {
  return (
    <span aria-hidden className="relative inline-block h-1.5 w-20 shrink-0 rounded-full bg-[linear-gradient(to_right,var(--error),var(--line),var(--accent))]">
      <span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-page bg-headline" style={{ left: `${((t + 1) / 2) * 100}%` }} />
    </span>
  );
}

function PairRow({ pair }: { pair: RelationPair }) {
  const [open, setOpen] = useState(false);
  const l = lean(pair.temperature);
  return (
    <li className="border-t border-line first:border-t-0">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="group flex w-full flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-left">
        <span className="min-w-0 flex-1 basis-40 text-[15px] font-bold text-headline">
          {pair.a.nameKo} ↔ {pair.b.nameKo}
        </span>
        <Thermometer t={pair.temperature} />
        <span className={`w-12 text-[13px] font-bold ${l.className}`}>{l.label}</span>
        <span className="text-[13px] text-muted">
          갈등 {pair.conflict} · 협력 {pair.cooperation}
        </span>
      </button>
      {open && (
        <ul className="mb-2 ml-1 border-l border-line pl-3">
          {pair.events.map((e) => (
            <li key={e.id} className="py-0.5 text-[13px] text-body">
              <span className="mr-2 text-muted">{EVENT_TYPES[e.type]?.label}</span>
              {e.title}
            </li>
          ))}
          {pair.events.length === 0 && <li className="py-0.5 text-[13px] text-muted">근거 사건이 없어요</li>}
        </ul>
      )}
    </li>
  );
}

function Interest({ m }: { m: InterestMatrix }) {
  const max = Math.max(1, ...m.counts.flat());
  return (
    <div className="overflow-x-auto">
      <table aria-label="나라끼리 관심" className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <th className="p-1.5 text-left font-normal text-faint">보도 ↓ · 일어난 곳 →</th>
            {m.targets.map((t) => (
              <th key={t} scope="col" className="p-1.5 text-center font-bold text-headline">
                {countryName(t)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {m.reporters.map((r, i) => (
            <tr key={r} aria-label={`${countryName(r)} 매체`} className="border-t border-line">
              <th scope="row" className="whitespace-nowrap p-1.5 text-left font-normal text-body">
                {countryName(r)} 매체
              </th>
              {m.counts[i].map((n, j) => (
                <td
                  key={m.targets[j]}
                  className="p-1.5 text-center tabular-nums text-headline"
                  style={{ backgroundColor: n ? `color-mix(in srgb, var(--accent) ${Math.round((n / max) * 45) + 5}%, transparent)` : undefined }}
                >
                  {n || <span className="text-faint">–</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Relations({ relations }: { relations: BoardRelations }) {
  return (
    <>
      <section aria-labelledby="h-temp" className="mt-8">
        <h2 id="h-temp" className="text-lg font-bold text-headline">
          관계 온도 <span className="text-sm font-normal text-muted">최근 {relations.days}일</span>
        </h2>
        <p className="mt-1 text-[13px] text-muted">
          누가 누구에게 한 일(주체 → 대상)만 셉니다. 공격·제재·비난은 갈등, 협상·원조는 협력입니다. 말보다 행동을 {RULES.relationActionWeight}배 무겁게 봅니다. 누르면 근거 사건이 나와요.
        </p>
        {relations.pairs.length > 0 ? (
          <ul aria-label="관계 온도" className="mt-3">
            {relations.pairs.map((p) => (
              <PairRow key={`${p.a.id}|${p.b.id}`} pair={p} />
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted">아직 {RULES.relationMinEvents}건 넘게 함께 나온 사이가 없어요.</p>
        )}
      </section>
      <section aria-labelledby="h-interest" className="mt-10">
        <h2 id="h-interest" className="text-lg font-bold text-headline">
          나라끼리 관심 <span className="text-sm font-normal text-muted">최근 24시간</span>
        </h2>
        <p className="mt-1 mb-3 text-[13px] text-muted">어느 나라 매체가 어느 나라에서 일어난 일을 몇 건 보도했나. 자기 나라 일은 뺐습니다.</p>
        <Interest m={relations.interest} />
      </section>
    </>
  );
}

export function RelationsView() {
  const { data, loading } = useWorld();
  return (
    <div className="mx-auto min-h-dvh max-w-4xl px-4 pb-16 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-6">
      <nav className="mb-4 text-[13px] text-muted">
        <Link href="/" className="hover:text-headline">
          오늘의 세계
        </Link>
      </nav>
      <h1 className="font-display text-[clamp(30px,5vw,44px)] font-normal leading-tight text-headline">관계</h1>
      <p className="mt-2 text-sm text-body">누가 누구와 어떤 사이인지, 어느 나라가 어느 나라를 지켜보는지. AI가 뽑은 사건의 주체·대상을 규칙으로 셉니다.</p>
      {data?.relations && <Relations relations={data.relations} />}
      {data && !data.relations && <p className="mt-10 text-sm text-muted">관계를 모으는 중이에요. 다음 갱신(30분 안)부터 보여요.</p>}
      {!data && loading && <div aria-label="불러오는 중" className="mt-8 h-40 animate-pulse rounded bg-panel" />}
    </div>
  );
}
