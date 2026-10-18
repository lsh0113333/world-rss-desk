"use client";

import { useEffect } from "react";
import useSWR from "swr";
import { formatRelative } from "@/lib/time";
import type { FeedHealthReport, FeedIssue } from "@/services/feed-health";
import { CloseIcon } from "./Icons";

async function fetchReport(url: string): Promise<FeedHealthReport> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as FeedHealthReport;
}

function IssueList({ title, issues, tone }: { title: string; issues: FeedIssue[]; tone: string }) {
  if (issues.length === 0) return null;
  return (
    <section aria-label={title} className="mt-4">
      <h3 className={`text-xs font-semibold ${tone}`}>
        {title} {issues.length}
      </h3>
      <ul className="mt-1 divide-y divide-line rounded border border-line">
        {issues.map((f) => (
          <li key={f.id} className="flex gap-2 px-3 py-1.5 text-sm">
            <span className="text-body">{f.name}</span>
            <span className="truncate text-xs leading-5 text-muted">{f.id}</span>
            <span className="ml-auto shrink-0 text-xs leading-5 text-muted">{f.detail}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** 설정 메뉴 "피드 상태": 매일 자동 점검한 결과 (실패·오래된 피드) */
export function FeedHealthDialog({ onClose }: { onClose(): void }) {
  const { data, error, isLoading } = useSWR<FeedHealthReport>("/api/feed-health", fetchReport, { revalidateOnFocus: false, shouldRetryOnError: false });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/30 p-3 pt-[8vh]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="피드 상태" className="flex max-h-[80vh] w-full max-w-xl flex-col rounded-xl border border-line bg-panel shadow-xl">
        <header className="flex items-center border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold text-headline">피드 상태</h2>
          <button type="button" onClick={onClose} aria-label="닫기" className="ml-auto rounded p-1 text-muted hover:text-headline">
            <CloseIcon />
          </button>
        </header>
        <div className="overflow-y-auto px-4 py-4">
          {isLoading && <p className="text-sm text-muted">전체 피드를 점검하는 중… (처음에는 1~2분 걸릴 수 있어요)</p>}
          {error && <p className="text-sm text-error">점검 결과를 불러오지 못했습니다</p>}
          {data && (
            <>
              <p className="text-sm text-body">
                전체 {data.total}개 중 정상 <strong className="text-headline">{data.ok}</strong> · 오래됨 {data.stale.length} · 실패 {data.failed.length}
              </p>
              <p className="mt-1 text-xs text-muted">마지막 점검 {formatRelative(data.checkedAt)} · 매일 오전 6시 자동 점검</p>
              {data.stale.length + data.failed.length === 0 && <p className="mt-4 text-sm text-muted">모든 피드가 정상입니다.</p>}
              <IssueList title="실패" issues={data.failed} tone="text-error" />
              <IssueList title="오래됨 (3일 넘게 새 기사 없음)" issues={data.stale} tone="text-muted" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
