#!/usr/bin/env bash
# 파이프라인 예약 실행 설정 (사용자가 직접 실행: ! bash scripts/setup-scheduler.sh)
# 준비: .env.local 에 GITHUB_DISPATCH_TOKEN=<fine-grained 토큰> 한 줄 (저장소 world-rss-desk, Actions: Read and write)
# 하는 일 (값은 출력하지 않음):
#   1) 토큰을 Supabase Vault 'github_dispatch_token'에 저장 (있으면 교체)
#   2) supabase/migrations/0002_scheduler.sql 적용 → pg_cron이 30분마다 GitHub Actions 실행 요청
#   3) 바로 한 번 실행 요청을 보내 확인
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="/c/nodejs:/c/gh/bin:$PATH"

REF="vzsdvpmnrrwyizeszimq"
REPO="lsh0113333/world-rss-desk"

set -a; . ./.env.local; set +a
: "${SUPABASE_ACCESS_TOKEN:?.env.local에 SUPABASE_ACCESS_TOKEN이 없습니다}"
: "${GITHUB_DISPATCH_TOKEN:?.env.local에 GITHUB_DISPATCH_TOKEN=<토큰> 한 줄을 먼저 넣어 주세요}"

# SQL을 Management API로 실행 (본문 JSON은 node로 만들어 따옴표 문제를 피한다)
sql() {
  node -e 'process.stdout.write(JSON.stringify({query: require("fs").readFileSync(0, "utf8")}))' |
    curl -sS -f -X POST "https://api.supabase.com/v1/projects/$REF/database/query" \
      -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" --data-binary @- >/dev/null
}

echo "1) Vault에 토큰 저장..."
TOKEN="$GITHUB_DISPATCH_TOKEN" node -e '
const t = process.env.TOKEN.replace(/\x27/g, "\x27\x27");
process.stdout.write(`do $$ declare sid uuid; begin
  select id into sid from vault.secrets where name = \x27github_dispatch_token\x27;
  if sid is null then perform vault.create_secret(\x27${t}\x27, \x27github_dispatch_token\x27, \x27GitHub Actions workflow_dispatch (world-rss-desk)\x27);
  else perform vault.update_secret(sid, \x27${t}\x27); end if; end $$;`)' | sql

echo "2) 예약 실행 등록 (30분마다)..."
sql < supabase/migrations/0002_scheduler.sql

echo "3) 지금 한 번 실행 요청..."
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  "https://api.github.com/repos/$REPO/actions/workflows/pipeline.yml/dispatches" \
  -H "Authorization: Bearer $GITHUB_DISPATCH_TOKEN" -H "Accept: application/vnd.github+json" \
  -d '{"ref":"main"}')
if [ "$code" = "204" ]; then
  echo "완료: 토큰이 정상입니다. 1~2분 뒤 실행 목록:"
  echo "  gh run list -R $REPO -w world-pipeline -L 3"
else
  echo "토큰으로 실행 요청이 실패했습니다 (HTTP $code). 토큰의 저장소와 Actions 권한(Read and write)을 확인해 주세요."
  exit 1
fi
