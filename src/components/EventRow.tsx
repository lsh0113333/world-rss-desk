"use client";

import Link from "next/link";
import { type CSSProperties, createContext, useContext, useState } from "react";
import { triplesOf } from "@/lib/ontology/rules";
import { isNewSince } from "@/lib/board-prefs";
import { formatRelative } from "@/lib/time";
import { countryName } from "@/ontology/countries";
import { EVENT_TYPES, RULES } from "@/ontology/world";
import type { Continent } from "@/types/catalog";
import type { BoardEvent } from "@/types/world";

export const continentColor = (id: Continent) => ({ "--c": `var(--c-${id})` }) as CSSProperties;

/** 사건 행이 공유하는 것: 연관 사건을 찾을 전체 목록, "새" 기준, 현재 시각 */
export interface BoardContextValue {
  events: Map<string, BoardEvent>;
  since: string | null;
  now: Date | null;
}
export const BoardContext = createContext<BoardContextValue>({ events: new Map(), since: null, now: null });

function Dots({ continents }: { continents: Continent[] }) {
  return (
    <span aria-hidden="true" className="inline-flex items-center gap-[3px]">
      {continents.map((c) => (
        <span key={c} style={continentColor(c)} className="size-2 rounded-full bg-[var(--c)]" />
      ))}
    </span>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return <h4 className="mb-1 text-[11.5px] font-bold tracking-wide text-faint">{children}</h4>;
}

function EventDetail({ event }: { event: BoardEvent }) {
  const { now } = useContext(BoardContext);
  const triples = triplesOf(event);
  const s = event.score;
  return (
    <div className="mb-3 ml-7 mt-1 grid gap-3 rounded-lg border border-line bg-panel p-3.5 text-sm">
      <p className="text-headline">{event.summary}</p>

      <div>
        <Heading>왜 이 순위?</Heading>
        <p className="text-[13px] text-body">
          보도 규모 {s.scale} (나라 {s.countries}×{RULES.countryWeight} + 대륙 {s.continents}×{RULES.continentWeight} + 매체 {Math.min(s.outlets, RULES.outletCap)}) × {EVENT_TYPES[event.type].label} {s.multiplier}
          {s.risingBonus > 0 ? ` + 떠오름 ${s.risingBonus}` : ""} = <b className="font-mono text-headline">{s.total}</b>
        </p>
      </div>

      {triples.length > 0 && (
        <div>
          <Heading>관계로 보기</Heading>
          <ul className="grid gap-0.5 text-[13px] text-body">
            {triples.map((t, i) => (
              <li key={i}>{t.to ? `${t.from} ─${t.relation}→ ${t.to}` : `${t.from} ─${t.relation}`}</li>
            ))}
          </ul>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {event.actors.map((a) => (
              <Link key={a.id} href={`/actors/${encodeURIComponent(a.id)}`} className="rounded-md border border-line bg-panel-header px-2 py-0.5 text-[12.5px] text-body hover:border-accent hover:text-headline">
                {a.nameKo}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div>
        <Heading>
          {event.occurs.length > 0 ? `일어난 곳 ${event.occurs.map(countryName).join(", ")} · ` : ""}보도 {event.reporting.length}개 나라 · 매체 {event.outlets}곳 · 기사 {event.articleCount}건
        </Heading>
        <p className="text-[13px] text-muted">{event.reporting.map(countryName).join(", ")}</p>
      </div>

      {event.related.length > 0 && (
        <div>
          <Heading>연관 사건</Heading>
          <ul>
            {event.related.map((r) => (
              <RelatedRow key={r.id} id={r.id} title={r.title} why={r.why} />
            ))}
          </ul>
        </div>
      )}

      <div>
        <Heading>근거 기사 (원문)</Heading>
        <ul className="grid gap-1">
          {event.articles.map((a) => (
            <li key={a.id}>
              <a href={a.link} target="_blank" rel="noopener noreferrer" className="group flex items-baseline gap-2 text-[13px]">
                <span className="shrink-0 text-[11.5px] text-muted">{a.source}</span>
                <span className="min-w-0 flex-1 text-body group-hover:text-headline group-hover:underline">{a.title}</span>
                {now && <span className="shrink-0 text-[11px] text-faint">{formatRelative(a.publishedAt, now)}</span>}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function RelatedRow({ id, title, why }: { id: string; title: string; why: string }) {
  const { events } = useContext(BoardContext);
  const [open, setOpen] = useState(false);
  const event = events.get(id);
  return (
    <li>
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex w-full flex-wrap items-baseline gap-x-2 py-0.5 text-left text-[13px] text-body hover:text-headline">
        <span>{title}</span>
        <span className="text-[11.5px] text-muted">{why}</span>
      </button>
      {open && event && <EventDetail event={event} />}
    </li>
  );
}

/** 사건 한 줄: 제목 + 보도한 대륙·나라 수. 누르면 그 자리에서 근거까지 펼친다 */
export function EventRow({ event, rank }: { event: BoardEvent; rank?: number }) {
  const { since } = useContext(BoardContext);
  const [open, setOpen] = useState(false);
  const fresh = isNewSince(event.firstSeenAt, since);
  return (
    <li className="border-t border-line first:border-t-0">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="group flex w-full gap-2.5 py-2.5 text-left">
        {rank !== undefined && <span className="w-5 shrink-0 pt-px font-mono text-sm font-bold text-[var(--c,var(--faint))]">{rank}</span>}
        <span className="min-w-0 flex-1">
          <span className="block text-[15.5px] font-bold leading-snug text-headline group-hover:underline group-hover:underline-offset-4">{event.title}</span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
            <Dots continents={event.continents} />
            <span>{event.reporting.length}개 나라</span>
            {fresh && <span className="rounded-full bg-accent px-1.5 font-bold text-page">새</span>}
            {event.rising && <span className="rounded-full border border-[var(--c-asia)] px-1.5 font-bold text-[var(--c-asia)]">떠오름</span>}
          </span>
        </span>
      </button>
      {open && <EventDetail event={event} />}
    </li>
  );
}
