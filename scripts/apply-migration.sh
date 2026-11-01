#!/usr/bin/env bash
# DB 마이그레이션 파일 하나를 운영 DB에 적용한다 (사용자가 직접 실행)
# 사용법: bash scripts/apply-migration.sh supabase/migrations/0004_drop_old_tables.sql
# .env.local의 SUPABASE_ACCESS_TOKEN을 쓴다 (값은 출력하지 않음)
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="/c/nodejs:$PATH"

FILE="${1:?사용법: bash scripts/apply-migration.sh <마이그레이션 파일>}"
REF="vzsdvpmnrrwyizeszimq"

set -a; . ./.env.local; set +a
: "${SUPABASE_ACCESS_TOKEN:?.env.local에 SUPABASE_ACCESS_TOKEN이 없습니다}"

node -e 'process.stdout.write(JSON.stringify({query: require("fs").readFileSync(process.argv[1], "utf8")}))' "$FILE" |
  curl -sS -f -X POST "https://api.supabase.com/v1/projects/$REF/database/query" \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" --data-binary @- >/dev/null

echo "적용 완료: $FILE"
