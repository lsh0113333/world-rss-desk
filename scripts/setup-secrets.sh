#!/usr/bin/env bash
# 파이프라인 비밀값 등록 (사용자가 직접 실행: ! bash scripts/setup-secrets.sh)
# .env.local 의 SUPABASE_ACCESS_TOKEN, GEMINI_API_KEY 를 읽어 값을 출력하지 않고
#   GitHub Actions Secrets: SUPABASE_URL, SUPABASE_SECRET_KEY, GEMINI_API_KEY
#   Vercel env (production): SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY
#   .env.local: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY (로컬 개발 읽기용, 공개 가능한 키)
# 로 옮긴다.
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="/c/nodejs:/c/gh/bin:/c/supabase:$PATH"

REF="vzsdvpmnrrwyizeszimq"
REPO="lsh0113333/world-rss-desk"
URL="https://$REF.supabase.co"

set -a; . ./.env.local; set +a

key() {
  supabase projects api-keys --project-ref "$REF" -o json 2>/dev/null |
    node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const k=JSON.parse(s).find(x=>x.type===process.argv[1]);if(!k)process.exit(1);process.stdout.write(k.api_key)})' "$1"
}

echo "GitHub Secrets 등록..."
printf '%s' "$URL" | gh secret set SUPABASE_URL -R "$REPO"
key secret | gh secret set SUPABASE_SECRET_KEY -R "$REPO"
printf '%s' "$GEMINI_API_KEY" | gh secret set GEMINI_API_KEY -R "$REPO"

echo "Vercel 환경 변수 등록..."
for name in SUPABASE_URL SUPABASE_PUBLISHABLE_KEY; do
  npx vercel env rm "$name" production --yes >/dev/null 2>&1 || true
done
printf '%s' "$URL" | npx vercel env add SUPABASE_URL production >/dev/null
key publishable | npx vercel env add SUPABASE_PUBLISHABLE_KEY production >/dev/null

echo ".env.local 갱신..."
grep -vE '^(SUPABASE_URL|SUPABASE_PUBLISHABLE_KEY)=' .env.local > .env.local.tmp || true
{ echo "SUPABASE_URL=$URL"; printf 'SUPABASE_PUBLISHABLE_KEY=%s\n' "$(key publishable)"; } >> .env.local.tmp
mv .env.local.tmp .env.local

echo "완료:"
gh secret list -R "$REPO"
npx vercel env ls production 2>/dev/null | grep -E 'SUPABASE|CRON' || true
