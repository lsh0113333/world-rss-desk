"use client";

import { useMemo, useState } from "react";
import { useMe } from "@/hooks/useMe";
import { adviseMe } from "@/lib/ontology/me";
import { allCountryCodes, countryName } from "@/ontology/countries";
import { ME_RULES, SITUATION_IDS, SITUATIONS, type SituationId } from "@/ontology/me";
import type { Advice, Me } from "@/types/me";
import type { BoardEvent } from "@/types/world";
import { EventRow } from "./EventRow";

/** 3단계 "나에게 한 문장" (intent/2026-11-08-me-one-sentence.md). 판단은 lib/ontology/me의 규칙 */

/** 보는 사람의 날짜 YYYY-MM-DD */
const localDate = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);

const COUNTRIES = allCountryCodes()
  .map((code) => ({ code, name: countryName(code) }))
  .sort((a, b) => a.name.localeCompare(b.name, "ko"));

function Editor({ initial, onDone }: { initial: Me | null; onDone: (me: Me | null) => void }) {
  const [situations, setSituations] = useState<SituationId[]>(initial?.situations ?? []);
  const [trips, setTrips] = useState(initial?.trips ?? []);
  const [country, setCountry] = useState("");
  const [until, setUntil] = useState("");
  const toggle = (id: SituationId) => setSituations((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const addTrip = () => {
    if (!country || trips.some((t) => t.country === country)) return;
    setTrips([...trips, until ? { country, until } : { country }]);
    setCountry("");
    setUntil("");
  };
  const travel = situations.includes("travel");
  return (
    <div className="mt-3 grid gap-3 text-sm">
      <fieldset className="flex flex-wrap gap-x-5 gap-y-2">
        <legend className="mb-1 text-[13px] text-muted">내 상황 (이 브라우저에만 저장돼요)</legend>
        {SITUATION_IDS.map((id) => (
          <label key={id} className="flex items-center gap-2 text-headline">
            <input type="checkbox" checked={situations.includes(id)} onChange={() => toggle(id)} className="accent-[var(--accent)]" />
            {SITUATIONS[id].label}
            <span className="text-[12.5px] text-muted">{SITUATIONS[id].hint}</span>
          </label>
        ))}
      </fieldset>
      {travel && (
        <div className="grid gap-2 border-l border-line pl-3">
          {trips.length > 0 && (
            <ul aria-label="해외 일정" className="flex flex-wrap gap-2">
              {trips.map((t) => (
                <li key={t.country} className="flex items-center gap-1.5 rounded-md border border-line bg-panel-header px-2 py-0.5 text-[13px] text-body">
                  {countryName(t.country)}
                  {t.until && <span className="text-muted">~{t.until.slice(5)}</span>}
                  <button type="button" aria-label={`${countryName(t.country)} 빼기`} onClick={() => setTrips(trips.filter((x) => x.country !== t.country))} className="text-muted hover:text-headline">
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          {trips.length < ME_RULES.maxTrips && (
            <div className="flex flex-wrap items-center gap-2">
              <select aria-label="가는 나라" value={country} onChange={(e) => setCountry(e.target.value)} className="rounded-md border border-line bg-panel px-2 py-1 text-headline">
                <option value="">가는 나라</option>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input type="date" aria-label="돌아오는 날 (선택)" value={until} onChange={(e) => setUntil(e.target.value)} className="rounded-md border border-line bg-panel px-2 py-1 text-headline" />
              <button type="button" onClick={addTrip} disabled={!country} className="rounded-md border border-line px-3 py-1 text-headline hover:border-accent disabled:opacity-40">
                일정 추가
              </button>
            </div>
          )}
        </div>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={() => onDone({ situations, trips })} className="rounded-full bg-accent px-4 py-1.5 font-bold text-white">
          완료
        </button>
        {initial && (
          <button type="button" onClick={() => onDone(null)} className="rounded-full border border-line px-4 py-1.5 text-muted hover:text-headline">
            나 지우기
          </button>
        )}
      </div>
    </div>
  );
}

function AdviceBlock({ advice, event, main }: { advice: Advice; event: BoardEvent; main?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={main ? "" : "border-t border-line pt-2"}>
      <p className={main ? "text-[17px] font-bold leading-snug text-headline sm:text-[19px]" : "text-[14.5px] text-body"}>{advice.sentence}</p>
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="mt-1 text-[13px] text-muted underline underline-offset-2 hover:text-headline">
        {open ? "근거 접기" : "근거 보기"}
      </button>
      {open && (
        <div className="mt-2">
          <p className="text-[13px] text-muted">왜 이 문장: {advice.why}</p>
          <ul>
            <EventRow event={event} />
          </ul>
        </div>
      )}
    </div>
  );
}

export function MeCard({ events, now }: { events: readonly BoardEvent[]; now: Date | null }) {
  const { me, ready, update } = useMe();
  const [editing, setEditing] = useState(false);
  const byId = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);
  const advice = useMemo(() => (me && now ? adviseMe(me, events, localDate(now)) : []), [me, events, now]);
  if (!ready) return null;
  const [first, ...rest] = advice;
  const more = rest.slice(0, ME_RULES.moreLimit);
  return (
    <section aria-labelledby="h-me" className="mt-5 rounded-lg border border-line border-l-4 border-l-accent bg-panel px-4 py-3">
      <div className="flex items-baseline gap-3">
        <h2 id="h-me" className="text-[13px] font-bold text-accent">
          나에게 한 문장
        </h2>
        {me && !editing && (
          <button type="button" onClick={() => setEditing(true)} className="ml-auto text-[13px] text-muted hover:text-headline">
            내 상황 바꾸기
          </button>
        )}
      </div>
      {editing ? (
        <Editor
          initial={me}
          onDone={(next) => {
            update(next);
            setEditing(false);
          }}
        />
      ) : !me ? (
        <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className="text-[15px] text-body">내 상황을 알려 주시면, 지금 세계에서 나에게 걸리는 일을 한 문장으로 알려 드려요.</p>
          <button type="button" onClick={() => setEditing(true)} className="text-[14px] font-bold text-accent hover:underline">
            내 상황 정하기
          </button>
        </div>
      ) : first ? (
        <div className="mt-1 grid gap-2">
          <AdviceBlock advice={first} event={byId.get(first.eventId)!} main />
          {more.map((a) => (
            <AdviceBlock key={a.eventId} advice={a} event={byId.get(a.eventId)!} />
          ))}
        </div>
      ) : (
        <p className="mt-1 text-[17px] font-bold text-headline">지금 내 상황에 걸리는 큰 일은 없어요.</p>
      )}
    </section>
  );
}
