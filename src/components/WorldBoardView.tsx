"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useWorld } from "@/hooks/useWorld";
import { advanceVisit, isNewSince, LocalStorageBoardPrefsRepository } from "@/lib/board-prefs";
import { formatRelative } from "@/lib/time";
import type { BoardContinent, BoardEvent, BoardFlow, FlowTrend, WorldBoard } from "@/types/world";
import { BoardContext, continentColor, EventRow } from "./EventRow";

/** 파이프라인은 30분마다 돈다. 이보다 오래되면 늦어지고 있다고 알린다 */
const STALE_MS = 2 * 3_600_000;
const COUNTRY_ROWS = 8;

const TREND: Record<FlowTrend, { mark: string; label: string; className: string }> = {
  up: { mark: "▲", label: "커지는 중", className: "text-[var(--c-asia)]" },
  flat: { mark: "–", label: "유지", className: "text-muted" },
  down: { mark: "▼", label: "잦아드는 중", className: "text-[var(--c-europe)]" },
  quiet: { mark: "", label: "조용", className: "text-faint" },
};

function FlowRow({ flow, events }: { flow: BoardFlow; events: Map<string, BoardEvent> }) {
  const [open, setOpen] = useState(false);
  const list = flow.eventIds.map((id) => events.get(id)).filter((e): e is BoardEvent => !!e);
  const trend = TREND[flow.trend];
  const quiet = list.length === 0;
  return (
    <li className="border-t border-line first:border-t-0">
      <button
        type="button"
        aria-expanded={open}
        disabled={quiet}
        onClick={() => setOpen(!open)}
        className="group flex w-full items-baseline gap-3 py-2 text-left disabled:cursor-default"
      >
        <span className={`w-28 shrink-0 text-[14.5px] font-bold sm:w-36 ${quiet ? "text-faint" : "text-headline"}`}>{flow.label}</span>
        <span className={`w-14 shrink-0 text-xs font-bold sm:w-20 ${trend.className}`}>
          {trend.mark} {trend.label}
        </span>
        <span className="hidden w-12 shrink-0 text-xs text-muted sm:inline">{quiet ? "" : `사건 ${list.length}`}</span>
        <span className="min-w-0 flex-1 truncate text-sm text-body group-enabled:group-hover:text-headline">{list[0]?.title ?? ""}</span>
      </button>
      {open && (
        <ul className="mb-2 ml-3 border-l border-line pl-3">
          {list.map((e) => (
            <EventRow key={e.id} event={e} />
          ))}
        </ul>
      )}
    </li>
  );
}

function CountryRow({ code, name, event }: { code: string; name: string; event: BoardEvent }) {
  const [open, setOpen] = useState(false);
  return (
    <li>
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="group flex w-full items-baseline gap-2 py-0.5 text-left text-[13px]" data-country={code}>
        <span className="w-20 shrink-0 truncate text-muted">{name}</span>
        <span className="min-w-0 flex-1 truncate text-body group-hover:text-headline">{event.title}</span>
      </button>
      {open && (
        <ul>
          <EventRow event={event} />
        </ul>
      )}
    </li>
  );
}

function ContinentBlock({ continent, events }: { continent: BoardContinent; events: Map<string, BoardEvent> }) {
  const headingId = `h-${continent.id}`;
  const top = continent.top.map((id) => events.get(id)).filter((e): e is BoardEvent => !!e);
  const rows = continent.countries.slice(0, COUNTRY_ROWS).flatMap((c) => {
    const event = events.get(c.eventIds[0]);
    return event ? [{ code: c.code, name: c.name, event }] : [];
  });
  return (
    <section aria-labelledby={headingId} style={continentColor(continent.id)} className="min-w-0">
      <h3 id={headingId} className="mb-1 border-b-2 border-[var(--c)] pb-1.5 font-display text-3xl font-normal leading-tight text-[var(--c)]">
        {continent.label}
      </h3>
      {top.length === 0 && rows.length === 0 && <p className="py-2.5 text-[13px] text-faint">지금 이곳에서 일어난 큰 일이 잡히지 않았어요.</p>}
      {top.length > 0 && (
        <ol>
          {top.map((e, i) => (
            <EventRow key={e.id} event={e} rank={i + 1} />
          ))}
        </ol>
      )}
      {rows.length > 0 && (
        <ul className="mt-2 border-t border-line pt-2">
          {rows.map((r) => (
            <CountryRow key={r.code} {...r} />
          ))}
        </ul>
      )}
    </section>
  );
}

function Ranked({ title, note, ids, events, itStyle = false }: { title: string; note: string; ids: string[]; events: Map<string, BoardEvent>; itStyle?: boolean }) {
  const headingId = itStyle ? "h-it" : "h-world";
  const list = ids.map((id) => events.get(id)).filter((e): e is BoardEvent => !!e);
  return (
    <section aria-labelledby={headingId} style={itStyle ? { ["--c" as string]: "var(--it)" } : undefined} className="min-w-0">
      <div className="mb-1 flex items-baseline gap-2.5">
        <h2 id={headingId} className={`text-lg font-bold ${itStyle ? "text-[var(--it)]" : "text-headline"}`}>
          {title}
        </h2>
        <span className="text-[12.5px] text-muted">{note}</span>
      </div>
      {list.length === 0 ? (
        <p className="py-3 text-sm text-faint">지금은 없어요.</p>
      ) : (
        <ol>
          {list.map((e, i) => (
            <EventRow key={e.id} event={e} rank={i + 1} />
          ))}
        </ol>
      )}
    </section>
  );
}

function Board({ board, since, now }: { board: WorldBoard; since: string | null; now: Date | null }) {
  const events = useMemo(() => new Map(board.events.map((e) => [e.id, e])), [board]);
  const context = useMemo(() => ({ events, since, now }), [events, since, now]);
  return (
    <BoardContext.Provider value={context}>
      <section aria-labelledby="h-flows" className="mt-5">
        <h2 id="h-flows" className="mb-1 text-lg font-bold text-headline">
          지금 흐름
        </h2>
        <ul>
          {board.flows.map((f) => (
            <FlowRow key={f.id} flow={f} events={events} />
          ))}
        </ul>
      </section>

      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <Ranked title="세계 5" note="여러 나라가 함께 보도한 일" ids={board.world} events={events} />
        <Ranked title="IT 5" note="최우선 분야" ids={board.it} events={events} itStyle />
      </div>

      <div className="mt-10">
        <div className="mb-3 flex items-baseline gap-2.5">
          <h2 className="text-lg font-bold text-headline">대륙별</h2>
          <span className="text-[12.5px] text-muted">위에 없는 일 상위 3 · 아래는 나라별 1위</span>
        </div>
        <div className="grid gap-x-7 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {board.continents.map((c) => (
            <ContinentBlock key={c.id} continent={c} events={events} />
          ))}
        </div>
      </div>
    </BoardContext.Provider>
  );
}

export function WorldBoardView() {
  const { data, error, preparing, loading, retry } = useWorld();
  const prefs = useMemo(() => new LocalStorageBoardPrefsRepository(), []);
  const [since, setSince] = useState<string | null>(null);
  // 시각은 브라우저에서만 (서버 렌더와 어긋나지 않게)
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const current = new Date();
    setNow(current);
    void prefs.load().then((state) => {
      const next = advanceVisit(state, current);
      setSince(next.previousVisitAt);
      if (next !== state) void prefs.save(next);
    });
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, [prefs]);

  const newCount = data ? data.events.filter((e) => isNewSince(e.firstSeenAt, since)).length : 0;
  const stale = !!data && !!now && now.getTime() - Date.parse(data.generatedAt) > STALE_MS;

  return (
    <div className="mx-auto min-h-dvh max-w-[1240px] px-4 pb-16 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-6">
      <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="font-display text-[clamp(34px,6vw,52px)] font-normal leading-none text-headline">오늘의 세계</h1>
        {data && now && <span className="text-[13px] text-muted">{formatRelative(data.generatedAt, now).replace(/ 전$/, " 전")} 갱신</span>}
        {newCount > 0 && <span className="text-[13px] font-bold text-accent">지난 방문 이후 새 사건 {newCount}개</span>}
        <Link href="/ontology" className="ml-auto text-[13px] text-muted hover:text-headline">
          온톨로지
        </Link>
      </header>
      {stale && <p className="mt-2 text-[13px] text-[var(--c-south-america)]">갱신이 늦어지고 있어요. 지금 보이는 내용은 조금 전 기준이에요.</p>}

      {data && <Board board={data} since={since} now={now} />}

      {!data && preparing && <p className="mt-24 text-center text-headline">첫 상황판을 만드는 중이에요</p>}
      {!data && error && !preparing && (
        <div className="mx-auto mt-24 flex max-w-sm flex-col items-center gap-3 text-center">
          <p className="text-headline">세계 상황을 불러오지 못했습니다</p>
          <button type="button" onClick={retry} className="rounded-full border border-line px-4 py-2 text-sm text-headline hover:border-accent">
            다시 시도
          </button>
        </div>
      )}
      {!data && loading && !error && (
        <div aria-label="불러오는 중" className="mt-8 grid animate-pulse gap-3">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="h-6 rounded bg-panel" />
          ))}
        </div>
      )}
    </div>
  );
}
