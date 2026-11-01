"use client";

import Link from "next/link";
import { useActor } from "@/hooks/useWorld";
import { ACTOR_KINDS, EVENT_TYPES, LINK_TYPES } from "@/ontology/world";

/** 행위자 페이지: 온톨로지의 관계를 따라가 보는 곳. 사건 → 행위자 → 다른 행위자 */
export function ActorView({ id }: { id: string }) {
  const { data, error, notFound, loading } = useActor(id);
  return (
    <div className="mx-auto min-h-dvh max-w-3xl px-4 pb-16 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-6">
      <nav className="mb-4 text-[13px] text-muted">
        <Link href="/" className="hover:text-headline">
          오늘의 세계
        </Link>
      </nav>
      {loading && !data && <div aria-label="불러오는 중" className="h-10 w-48 animate-pulse rounded bg-panel" />}
      {notFound && <p className="mt-16 text-center text-headline">이 행위자는 최근 30일 사건에 나오지 않았어요</p>}
      {error && !notFound && !data && <p className="mt-16 text-center text-headline">불러오지 못했습니다</p>}
      {data && (
        <>
          <header>
            <h1 className="font-display text-4xl font-normal leading-tight text-headline">{data.nameKo}</h1>
            <p className="mt-1 text-[13px] text-muted">
              {ACTOR_KINDS[data.kind]} · {data.name}
            </p>
          </header>

          <section aria-labelledby="h-together" className="mt-7">
            <h2 id="h-together" className="mb-2 text-lg font-bold text-headline">
              함께 나온 행위자
            </h2>
            {data.together.length === 0 && <p className="text-sm text-faint">아직 없어요.</p>}
            <ul className="flex flex-wrap gap-1.5">
              {data.together.map((t) => (
                <li key={t.id}>
                  <Link href={`/actors/${encodeURIComponent(t.id)}`} className="inline-flex items-baseline gap-1.5 rounded-md border border-line bg-panel px-2.5 py-1 text-[13px] text-body hover:border-accent hover:text-headline">
                    {t.nameKo}
                    <span className="font-mono text-[11px] text-faint">{t.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="h-events" className="mt-7">
            <h2 id="h-events" className="mb-1 text-lg font-bold text-headline">
              나온 사건
            </h2>
            <ul>
              {data.events.map((e) => (
                <li key={e.id} className="border-t border-line py-2.5 first:border-t-0">
                  <p className="text-[15px] font-bold text-headline">{e.title}</p>
                  <p className="mt-0.5 text-sm text-body">{e.summary}</p>
                  <p className="mt-1 text-xs text-muted">
                    {LINK_TYPES[e.role].label} · {EVENT_TYPES[e.type]?.label ?? e.type}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
