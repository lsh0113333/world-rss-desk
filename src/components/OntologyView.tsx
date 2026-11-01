"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useWorld } from "@/hooks/useWorld";
import { multipliersFromConfig, rankWorld, type Multipliers } from "@/lib/ontology/rules";
import { EVENT_TYPE_IDS, EVENT_TYPES, LINK_TYPES, OBJECT_TYPES, RULES, type EventType } from "@/ontology/world";
import type { BoardEvent, WorldBoard } from "@/types/world";

/**
 * 온톨로지 공부 페이지: 시스템이 무엇으로 이루어졌고 어떻게 판단하는지 들여다보고, 규칙을 바꿔 결과를 본다.
 * 규칙 실험은 브라우저 안에서만 다시 계산한다. 저장하지 않는다.
 */

const nf = new Intl.NumberFormat("ko-KR");
const SECTION = "mt-9";
const TH = "py-1.5 pr-3 text-left text-xs font-bold text-faint";
const TD = "border-t border-line py-1.5 pr-3 align-top text-[13.5px]";

const QUERIES = [
  {
    title: "요즘 가장 많이 나오는 행위자",
    sql: "select dst, count(*) from links\nwhere type in ('subject','target','participant')\ngroup by dst order by 2 desc limit 20;",
  },
  {
    title: "미국이 대상이 된 사건",
    sql: "select o.props->>'title' from links l join objects o on o.id = l.src\nwhere l.type = 'target' and l.dst = 'country:US'\norder by o.last_seen desc limit 20;",
  },
  {
    title: "큰 흐름별 사건 수",
    sql: "select dst, count(*) from links where type = 'part_of'\ngroup by dst order by 2 desc;",
  },
];

function Steps({ board }: { board: WorldBoard | undefined }) {
  const s = board?.stats;
  const steps = [
    { name: "감지", who: "규칙", text: s ? `피드 ${nf.format(s.feedsOk)}개에서 최근 24시간 기사 ${nf.format(s.articles)}건` : "RSS 피드에서 기사 수집" },
    { name: "묶기", who: "규칙", text: s ? `같은 일을 다룬 기사끼리 묶음 ${nf.format(s.clusters)}개` : "같은 일을 다룬 기사끼리 묶음" },
    { name: "읽기", who: "AI", text: s ? `이번에 새 사건 ${nf.format(s.extracted)}개 추출: 유형, 행위자, 장소, 큰 흐름, 한국어 문장` : "새 묶음에서 유형, 행위자, 장소, 큰 흐름 추출" },
    { name: "저장", who: "규칙", text: "설정에 맞는 객체와 관계만 그래프에 저장" },
    { name: "판단", who: "규칙", text: board ? `점수를 매겨 사건 ${nf.format(board.events.length)}개의 순위와 연관 계산` : "점수를 매겨 순위와 연관 계산" },
    { name: "화면", who: "규칙", text: "답을 먼저 보여 주고, 누르면 근거로 내려감" },
  ];
  return (
    <section aria-labelledby="h-steps" className={SECTION}>
      <h2 id="h-steps" className="mb-2 text-lg font-bold text-headline">
        시스템이 도는 순서
      </h2>
      <p className="mb-2 text-sm text-muted">30분마다 한 바퀴 돈다. AI는 읽기만 하고, 판단은 사람이 정한 규칙이 한다.</p>
      <ol className="grid gap-1">
        {steps.map((step, i) => (
          <li key={step.name} className="flex items-baseline gap-2.5 text-[13.5px]">
            <span className="w-4 shrink-0 font-mono text-xs text-faint">{i + 1}</span>
            <span className="w-9 shrink-0 font-bold text-headline">{step.name}</span>
            <span className={`w-8 shrink-0 text-xs font-bold ${step.who === "AI" ? "text-[var(--it)]" : "text-muted"}`}>{step.who}</span>
            <span className="min-w-0 text-body">{step.text}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Model({ board }: { board: WorldBoard | undefined }) {
  const stats = board?.stats.ontology;
  const count = (n: number | undefined) => (n === undefined ? "" : nf.format(n));
  return (
    <section aria-labelledby="h-model" className={SECTION}>
      <h2 id="h-model" className="mb-2 text-lg font-bold text-headline">
        객체와 관계
      </h2>
      <div className="grid gap-6 sm:grid-cols-2">
        <table className="w-full">
          <thead>
            <tr>
              <th className={TH}>객체</th>
              <th className={TH}>개수</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(OBJECT_TYPES).map(([id, t]) => (
              <tr key={id}>
                <td className={`${TD} text-headline`}>{t.label}</td>
                <td className={`${TD} font-mono text-body`}>{count(stats?.objects[id])}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table className="w-full">
          <thead>
            <tr>
              <th className={TH}>관계</th>
              <th className={TH}>방향</th>
              <th className={TH}>개수</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(LINK_TYPES).map(([id, t]) => (
              <tr key={id}>
                <td className={`${TD} text-headline`}>{t.label}</td>
                <td className={`${TD} text-xs text-muted`}>
                  {t.from.join("/")} → {t.to.join("/")}
                </td>
                <td className={`${TD} font-mono text-body`}>{count(stats?.links[id])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MadeBy({ board }: { board: WorldBoard | undefined }) {
  const made = board?.stats.ontology?.madeBy;
  if (!made) return null;
  const rows = [
    { label: "AI 읽기", value: made.ai, note: "기사에서 뽑은 관계" },
    { label: "규칙", value: made.rule, note: "새 기사를 기존 사건에 붙인 관계" },
    { label: "설정", value: made.config, note: "사람이 정한 뼈대" },
  ];
  return (
    <section aria-labelledby="h-made" className={SECTION}>
      <h2 id="h-made" className="mb-2 text-lg font-bold text-headline">
        누가 만들었나
      </h2>
      <dl className="grid gap-1">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline gap-2 text-[13.5px]">
            <dt className="w-16 shrink-0 font-bold text-headline">{r.label}</dt>
            <dd className="w-14 shrink-0 font-mono text-body">{nf.format(r.value ?? 0)}</dd>
            <dd className="text-muted">{r.note}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function RuleList() {
  const rows = [
    `보도 규모 = 나라 수 × ${RULES.countryWeight} + 대륙 수 × ${RULES.continentWeight} + 매체 수(최대 ${RULES.outletCap})`,
    `점수 = 보도 규모 × 유형 배수 + 떠오름 ${RULES.risingBonus}`,
    `떠오름: 최근 ${RULES.risingWindowHours}시간 기사가 그 전 ${RULES.risingWindowHours}시간의 2배 이상`,
    `세계 사건: ${RULES.worldMinCountries}개 이상 나라의 매체가 보도 (스포츠·연예 제외)`,
    `사건 자격: 매체 ${RULES.minOutlets}곳 이상. ${RULES.fadeHours}시간 넘게 새 기사가 없으면 내려감`,
    `연관: 나라·기관 행위자 공유 또는 같은 큰 흐름. 사건 ${Math.round(RULES.commonActorShare * 100)}% 이상에 나오는 행위자 하나만 겹치면 제외`,
    `흐름 추세: 최근 ${RULES.trendWindowHours}시간 ÷ 그 전 ${RULES.trendWindowHours}시간 (${RULES.trendUp} 이상 ▲, ${RULES.trendDown} 이하 ▼)`,
  ];
  return (
    <section aria-labelledby="h-rules" className={SECTION}>
      <h2 id="h-rules" className="mb-2 text-lg font-bold text-headline">
        판단 규칙
      </h2>
      <ul className="grid list-disc gap-1 pl-4 text-[13.5px] text-body">
        {rows.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
    </section>
  );
}

function RuleLab({ events, actual }: { events: BoardEvent[]; actual: string[] }) {
  const [multipliers, setMultipliers] = useState<Multipliers>(multipliersFromConfig);
  const ranked = useMemo(() => rankWorld(events, multipliers).slice(0, RULES.worldLimit), [events, multipliers]);
  const set = (id: EventType, value: number) => setMultipliers((m) => ({ ...m, [id]: value }));
  return (
    <section aria-labelledby="h-lab" className={SECTION}>
      <h2 id="h-lab" className="mb-1 text-lg font-bold text-headline">
        규칙 실험
      </h2>
      <p className="mb-3 text-sm text-muted">&quot;무엇이 더 중요한가&quot;를 바꿔 보세요. 지금 사건들로 세계 5를 바로 다시 계산합니다. 저장되지 않아요.</p>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="grid gap-1.5">
          {EVENT_TYPE_IDS.map((id) => (
            <label key={id} className="flex items-center gap-2 text-[13px] text-body">
              <span className="w-24 shrink-0">{EVENT_TYPES[id].label}</span>
              <input
                id={`mult-${id}`}
                type="range"
                min={0}
                max={3}
                step={0.25}
                aria-label={`${EVENT_TYPES[id].label} 배수`}
                value={multipliers[id]}
                onChange={(e) => set(id, Number(e.target.value))}
                className="min-w-0 flex-1 accent-[var(--accent)]"
              />
              <span className="w-9 shrink-0 text-right font-mono text-xs text-headline">{multipliers[id]}</span>
            </label>
          ))}
          <button type="button" onClick={() => setMultipliers(multipliersFromConfig())} className="mt-1 justify-self-start rounded-full border border-line px-3 py-1 text-[13px] text-body hover:border-accent hover:text-headline">
            원래 규칙으로
          </button>
        </div>
        <ol aria-label="실험 결과 세계 5" className="grid content-start gap-2">
          {ranked.map((e, i) => {
            const before = actual.indexOf(e.id);
            const moved = before === -1 ? "새로 진입" : before === i ? "" : before > i ? `▲ ${before - i}` : `▼ ${i - before}`;
            return (
              <li key={e.id} className="flex items-baseline gap-2 text-[13.5px]">
                <span className="w-4 shrink-0 font-mono text-xs font-bold text-faint">{i + 1}</span>
                <span className="min-w-0 flex-1 text-headline">{e.title}</span>
                {moved && <span className="shrink-0 text-xs font-bold text-accent">{moved}</span>}
                <span className="shrink-0 font-mono text-xs text-muted">{e.score.total}</span>
              </li>
            );
          })}
          {ranked.length === 0 && <li className="text-sm text-faint">대상 사건이 없어요.</li>}
        </ol>
      </div>
    </section>
  );
}

function Study() {
  return (
    <section aria-labelledby="h-study" className={SECTION}>
      <h2 id="h-study" className="mb-2 text-lg font-bold text-headline">
        직접 해 보기
      </h2>
      <ul className="mb-3 grid list-disc gap-1 pl-4 text-[13.5px] text-body">
        <li>
          규칙과 유형을 바꾸려면 <code className="font-mono text-xs text-headline">src/ontology/world.ts</code> 파일만 고치면 됩니다.
        </li>
        <li>
          설계 설명은 <code className="font-mono text-xs text-headline">docs/ONTOLOGY.md</code>에 있어요.
        </li>
        <li>
          아래 쿼리는 로컬에서 <code className="font-mono text-xs text-headline">npm run query -- &quot;...&quot;</code> 로 돌려 볼 수 있어요.
        </li>
      </ul>
      <div className="grid gap-3">
        {QUERIES.map((q) => (
          <div key={q.title}>
            <h3 className="mb-1 text-[13px] font-bold text-headline">{q.title}</h3>
            <pre className="overflow-x-auto rounded-lg border border-line bg-panel p-3 font-mono text-xs leading-relaxed text-body [font-variant-ligatures:none]">{q.sql}</pre>
          </div>
        ))}
      </div>
    </section>
  );
}

export function OntologyView() {
  const { data } = useWorld();
  return (
    <div className="mx-auto min-h-dvh max-w-4xl px-4 pb-16 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-6">
      <nav className="mb-4 text-[13px] text-muted">
        <Link href="/" className="hover:text-headline">
          오늘의 세계
        </Link>
      </nav>
      <h1 className="font-display text-[clamp(30px,5vw,44px)] font-normal leading-tight text-headline">온톨로지</h1>
      <p className="mt-2 text-sm text-body">세상을 객체와 관계로 옮겨 적고, 사람이 정한 기준으로 판단하는 구조입니다. 이 사이트가 실제로 쓰는 값을 그대로 보여 줍니다.</p>
      <Steps board={data} />
      <Model board={data} />
      <MadeBy board={data} />
      <RuleList />
      {data && <RuleLab events={data.events} actual={data.world} />}
      <Study />
    </div>
  );
}
