/**
 * 온톨로지 공부용: 그래프에 SQL을 직접 돌려 본다. npm run query -- "select dst, count(*) from links group by 1"
 * .env.local의 SUPABASE_ACCESS_TOKEN을 쓴다 (로컬 전용, 값은 출력하지 않는다).
 * 읽기 쿼리만 허용한다. 데이터를 바꾸려면 Supabase 대시보드나 마이그레이션을 쓴다.
 */
import { readFileSync } from "node:fs";

const REF = "vzsdvpmnrrwyizeszimq";

function token(): string {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = /^SUPABASE_ACCESS_TOKEN=(.*)$/.exec(line);
    if (m) return m[1].trim();
  }
  throw new Error(".env.local에 SUPABASE_ACCESS_TOKEN이 없습니다");
}

async function main() {
  const sql = process.argv.slice(2).join(" ").trim();
  if (!sql) throw new Error('사용법: npm run query -- "select ..."');
  if (!/^(select|with)\b/i.test(sql) || /;\s*\S/.test(sql)) throw new Error("select 또는 with로 시작하는 쿼리 하나만 돌릴 수 있습니다");

  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
    // 하위 쿼리로 감싼다: Postgres는 하위 쿼리 안의 데이터 변경 문장을 받지 않는다
    body: JSON.stringify({ query: `select * from (${sql.replace(/;\s*$/, "")}) as q` }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`쿼리 실패 (${res.status}): ${body.slice(0, 300)}`);
  console.table(JSON.parse(body));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
