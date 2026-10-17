/**
 * 카탈로그의 모든 피드를 실제로 받아 파싱해 본다 (네트워크 사용, 테스트 AC와 무관).
 * Usage: npm run feeds:check [-- --stale-hours=72]
 */
import { CATALOG } from "@/lib/catalog";
import { loadFeed } from "@/services/rss";

const staleArg = process.argv.find((a) => a.startsWith("--stale-hours="));
const STALE_HOURS = staleArg ? Number(staleArg.split("=")[1]) : 72;
const CONCURRENCY = 8;

interface Row {
  id: string;
  status: "OK" | "STALE" | "FAIL";
  detail: string;
}

async function check(feed: (typeof CATALOG)[number]): Promise<Row> {
  try {
    const { articles } = await loadFeed(feed.url, { source: feed.name });
    if (articles.length === 0) return { id: feed.id, status: "FAIL", detail: "기사 0개" };
    const dated = articles.map((a) => a.publishedAt).filter((d): d is string => d !== null);
    const newest = dated.length ? Math.max(...dated.map((d) => Date.parse(d))) : NaN;
    const ageHours = (Date.now() - newest) / 3_600_000;
    const detail = `${articles.length}개, 최신 ${Number.isNaN(ageHours) ? "날짜 없음" : `${ageHours.toFixed(1)}시간 전`}, 날짜 없는 기사 ${articles.length - dated.length}개`;
    const stale = Number.isNaN(ageHours) || ageHours > STALE_HOURS;
    return { id: feed.id, status: stale ? "STALE" : "OK", detail };
  } catch (err) {
    return { id: feed.id, status: "FAIL", detail: err instanceof Error ? err.message : String(err) };
  }
}

async function main() {
  const rows: Row[] = [];
  const queue = [...CATALOG];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let feed = queue.shift(); feed; feed = queue.shift()) rows.push(await check(feed));
    }),
  );

  rows.sort((a, b) => a.id.localeCompare(b.id));
  for (const r of rows) console.log(`${r.status.padEnd(5)} ${r.id.padEnd(28)} ${r.detail}`);

  const bad = rows.filter((r) => r.status !== "OK");
  console.log(`\n${rows.length}개 중 OK ${rows.length - bad.length}, STALE ${rows.filter((r) => r.status === "STALE").length}, FAIL ${rows.filter((r) => r.status === "FAIL").length}`);
  process.exitCode = rows.some((r) => r.status === "FAIL") ? 1 : 0;
}

void main();
