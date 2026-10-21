"use client";

import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { useFront } from "@/hooks/useFront";
import { leadOf } from "@/lib/newsstand";
import { LocalStorageNewsstandPrefsRepository } from "@/lib/newsstand-prefs";
import { LocalStorageReadHistoryRepository, addRead } from "@/lib/read-history";
import { formatClock, formatRelative } from "@/lib/time";
import type { Continent } from "@/types/catalog";
import type { FrontContinent, FrontCountry, FrontItem } from "@/types/front";

/** 매체당 보이는 제목 수 (1면을 낸 매체는 1면 + 나머지) */
const LINES = 3;
/** 이보다 최근이면 시간을 대륙 색으로 강조 */
const FRESH_MS = 30 * 60_000;

const continentColor = (id: Continent) => ({ "--c": `var(--c-${id})` }) as CSSProperties;

function localTime(timeZone: string, now: Date): { text: string; night: boolean } | null {
  try {
    const text = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
    const hour = Number(text.slice(0, 2));
    return { text, night: hour < 6 || hour >= 21 };
  } catch {
    return null;
  }
}

interface ItemProps {
  item: FrontItem;
  now: Date | null;
  read: boolean;
  onRead(id: string): void;
}

function Ago({ iso, now, className = "" }: { iso: string | null; now: Date | null; className?: string }) {
  if (!now || !iso) return null;
  const fresh = now.getTime() - new Date(iso).getTime() < FRESH_MS;
  return (
    <span className={`shrink-0 text-[11.5px] tabular-nums ${fresh ? "font-bold text-[var(--c)]" : "text-faint"} ${className}`}>
      {formatRelative(iso, now)}
    </span>
  );
}

function CodeBadge({ code }: { code: string }) {
  return (
    <span
      aria-hidden="true"
      className="inline-grid h-5 min-w-7 place-items-center rounded bg-[var(--c)] px-1.5 font-mono text-[11px] font-bold tracking-wide text-page"
    >
      {code}
    </span>
  );
}

function Lead({ item, outlet, now, read, onRead }: ItemProps & { outlet: string }) {
  return (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      data-lead="true"
      data-read={read || undefined}
      onClick={() => onRead(item.id)}
      className="group block border-b border-line py-3"
    >
      <span
        className={`block text-pretty text-[18px] font-bold leading-snug sm:text-[19px] ${read ? "text-faint" : "text-headline group-hover:text-[var(--c)]"}`}
      >
        {item.title}
      </span>
      <span className="mt-1.5 flex gap-2 text-xs text-muted">
        <span>{outlet}</span>
        <Ago iso={item.publishedAt} now={now} />
      </span>
    </a>
  );
}

function Row({ item, now, read, onRead }: ItemProps) {
  return (
    <li>
      <a
        href={item.link}
        target="_blank"
        rel="noopener noreferrer"
        data-read={read || undefined}
        onClick={() => onRead(item.id)}
        className="group flex items-baseline gap-2.5 py-1"
      >
        <span
          className={`line-clamp-2 min-w-0 flex-1 ${read ? "text-faint" : "text-body group-hover:text-headline group-hover:underline group-hover:decoration-[var(--c)] group-hover:underline-offset-4"}`}
        >
          {item.title}
        </span>
        <Ago iso={item.publishedAt} now={now} />
      </a>
    </li>
  );
}

function CountryBlock({ country, now, read, onRead }: { country: FrontCountry; now: Date | null; read: Set<string>; onRead(id: string): void }) {
  const lead = leadOf(country);
  const time = now ? localTime(country.timeZone, now) : null;
  const headingId = `h-c-${country.code}`;
  return (
    <article id={`c-${country.code}`} aria-labelledby={headingId} className="mb-6 break-inside-avoid scroll-mt-20">
      <div className="flex items-center gap-2.5 border-b-2 border-[var(--c)] pb-2">
        <CodeBadge code={country.code} />
        <h3 id={headingId} className="text-[17px] font-bold text-headline">
          {country.name}
        </h3>
        {time && (
          <span title="현지 시각" className={`ml-auto font-mono text-xs ${time.night ? "text-faint" : "text-muted"}`}>
            {time.night ? "밤 " : ""}
            {time.text}
          </span>
        )}
      </div>
      {lead && <Lead item={lead.item} outlet={lead.outlet} now={now} read={read.has(lead.item.id)} onRead={onRead} />}
      {country.outlets.map((outlet) => {
        const items = outlet.items.filter((it) => it.id !== lead?.item.id).slice(0, outlet.name === lead?.outlet ? LINES - 1 : LINES);
        if (items.length === 0) return null;
        return (
          <div key={outlet.name} className="border-b border-line pb-1 pt-2.5">
            <div className="outlet-name text-[11.5px] font-bold tracking-wide text-[var(--c)]">{outlet.name}</div>
            <ul>
              {items.map((item) => (
                <Row key={item.id} item={item} now={now} read={read.has(item.id)} onRead={onRead} />
              ))}
            </ul>
          </div>
        );
      })}
    </article>
  );
}

function ContinentSection(props: {
  continent: FrontContinent;
  folded: boolean;
  now: Date | null;
  read: Set<string>;
  onRead(id: string): void;
  onToggle(): void;
}) {
  const { continent, folded, now } = props;
  const outlets = continent.countries.reduce((n, c) => n + c.outlets.length, 0);
  return (
    <section id={continent.id} aria-labelledby={`h-${continent.id}`} style={continentColor(continent.id)} className="scroll-mt-14 pt-9">
      <div className="mb-3.5 flex flex-wrap items-end gap-x-4 gap-y-1.5">
        <h2 id={`h-${continent.id}`} className="font-display text-[clamp(36px,6vw,64px)] leading-[0.95] text-[var(--c)]">
          {continent.label}
        </h2>
        <span className="pb-1.5 text-[13px] text-muted">
          {continent.countries.length}개 나라 · 매체 {outlets}곳
        </span>
        <button
          type="button"
          onClick={props.onToggle}
          aria-expanded={!folded}
          aria-label={`${continent.label} ${folded ? "펼치기" : "접기"}`}
          className="mb-1 ml-auto rounded-full border border-line px-3 py-1.5 text-[13px] text-muted hover:border-[var(--c)] hover:text-headline"
        >
          {folded ? "펼치기" : "접기"}
        </button>
      </div>
      {!folded && (
        <>
          <div className="mb-5 flex flex-wrap gap-1.5">
            {continent.countries.map((c) => {
              const time = now ? localTime(c.timeZone, now) : null;
              return (
                <a
                  key={c.code}
                  href={`#c-${c.code}`}
                  className="inline-flex items-center gap-1.5 rounded-md border border-line bg-panel py-1 pl-1 pr-2.5 text-[12.5px] text-body hover:border-[var(--c)] hover:text-headline"
                >
                  <CodeBadge code={c.code} />
                  {c.name}
                  {time && <span className="font-mono text-[11px] text-faint">{time.text}</span>}
                </a>
              );
            })}
          </div>
          <div className="columns-1 gap-7 md:columns-[340px]">
            {continent.countries.map((c) => (
              <CountryBlock key={c.code} country={c} now={now} read={props.read} onRead={props.onRead} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

export function Newsstand() {
  const { data, error, loading, retry } = useFront();
  const prefsRepo = useMemo(() => new LocalStorageNewsstandPrefsRepository(), []);
  const readRepo = useMemo(() => new LocalStorageReadHistoryRepository(), []);
  const [folded, setFolded] = useState<Continent[]>([]);
  const [readIds, setReadIds] = useState<string[]>([]);
  const readRef = useRef<string[]>([]);
  // 시각은 브라우저에서만 (서버 렌더와 어긋나지 않게)
  const [now, setNow] = useState<Date | null>(null);
  const [active, setActive] = useState<Continent | null>(null);

  useEffect(() => {
    void prefsRepo.load().then((p) => setFolded(p.folded));
    void readRepo.load().then((ids) => {
      readRef.current = ids;
      setReadIds(ids);
    });
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, [prefsRepo, readRepo]);

  const continents = data?.continents;
  useEffect(() => {
    if (!continents?.length) return;
    const sync = () => {
      let current = continents[0].id;
      for (const c of continents) {
        const el = document.getElementById(c.id);
        if (el && el.getBoundingClientRect().top - 120 <= 0) current = c.id;
      }
      setActive(current);
    };
    sync();
    window.addEventListener("scroll", sync, { passive: true });
    return () => window.removeEventListener("scroll", sync);
  }, [continents]);

  const read = useMemo(() => new Set(readIds), [readIds]);

  function markRead(id: string) {
    const next = addRead(readRef.current, id);
    readRef.current = next;
    setReadIds(next);
    void readRepo.save(next);
  }

  function toggle(id: Continent) {
    const next = folded.includes(id) ? folded.filter((x) => x !== id) : [...folded, id];
    setFolded(next);
    void prefsRepo.save({ folded: next });
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-line bg-page pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-[1520px] items-center gap-4 px-4 sm:px-6">
          <span className="whitespace-nowrap font-display text-[17px] text-headline sm:text-[19px]">세계 가판대</span>
          <nav aria-label="대륙 바로가기" className="flex min-w-0 flex-1 gap-0.5 overflow-x-auto [scrollbar-width:none]">
            {continents?.map((c) => (
              <a
                key={c.id}
                href={`#${c.id}`}
                style={continentColor(c.id)}
                aria-current={active === c.id || undefined}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[13.5px] font-medium ${
                  active === c.id ? "bg-[var(--c)] text-page" : "text-muted hover:text-headline"
                }`}
              >
                <span aria-hidden="true" className={`size-2 rounded-full ${active === c.id ? "bg-page" : "bg-[var(--c)]"}`} />
                {c.label}
              </a>
            ))}
          </nav>
          {data && <span className="hidden whitespace-nowrap font-mono text-xs text-faint sm:inline">갱신 {formatClock(data.fetchedAt)}</span>}
        </div>
      </header>

      <main className="mx-auto max-w-[1520px] px-4 pb-16 pt-2 sm:px-6">
        {error && !data && (
          <div className="mx-auto mt-24 flex max-w-sm flex-col items-center gap-3 text-center">
            <p className="text-headline">뉴스를 불러오지 못했습니다</p>
            <p className="text-sm text-muted">잠시 후 다시 시도해 주세요.</p>
            <button type="button" onClick={retry} className="rounded-full border border-line px-4 py-2 text-sm text-headline hover:border-accent">
              다시 시도
            </button>
          </div>
        )}
        {loading && !data && (
          <div aria-label="불러오는 중" className="mt-10 grid gap-6 md:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex animate-pulse flex-col gap-3">
                <div className="h-5 w-32 rounded bg-panel" />
                <div className="h-6 w-full rounded bg-panel" />
                <div className="h-4 w-5/6 rounded bg-panel" />
                <div className="h-4 w-4/6 rounded bg-panel" />
              </div>
            ))}
          </div>
        )}
        {continents?.map((c) => (
          <ContinentSection
            key={c.id}
            continent={c}
            folded={folded.includes(c.id)}
            now={now}
            read={read}
            onRead={markRead}
            onToggle={() => toggle(c.id)}
          />
        ))}
      </main>
    </div>
  );
}
