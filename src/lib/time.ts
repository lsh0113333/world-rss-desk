const pad = (n: number) => String(n).padStart(2, "0");

/** 24시간 이내 "12분 전"/"3시간 전", 이후 "10/16 14:20" (브라우저 로컬 시간) */
export function formatRelative(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "";
  const date = new Date(iso);
  const diff = now.getTime() - date.getTime();
  if (diff < 60_000) return "방금 전";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`;
  return `${date.getMonth() + 1}/${date.getDate()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** "07:03" */
export function formatClock(iso: string): string {
  const date = new Date(iso);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
