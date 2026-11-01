# 운영 개요

서비스가 어디서 어떻게 돌아가는지, 무엇이 돈이 드는지, 문제가 생기면 어디를 보면 되는지 정리한다. (2026-11-01 기준)

## 1. 한눈에 보기

구조는 `docs/ARCHITECTURE.md`. 노트북이 꺼져도 전부 동작한다.

| 구성 요소 | 하는 일 | 플랜 |
|---|---|---|
| Vercel `world-rss-desk` (서울 icn1) | 사이트, `/api/world`, `/api/actors`, 매일 피드 점검 | Hobby 무료 |
| GitHub `lsh0113333/world-rss-desk` (공개) | 코드, Actions로 파이프라인 실행 | 무료 |
| Supabase `vzsdvpmnrrwyizeszimq` (싱가포르) | PostgreSQL, 30분 예약 실행(pg_cron), 토큰 보관(Vault) | 무료 |
| Gemini (Flash-Lite 계열) | 기사에서 사건 추출 | 무료 티어 |

## 2. 문제가 생기면
| 증상 | 볼 곳 |
|---|---|
| "갱신이 늦어지고 있어요" | `gh run list -R lsh0113333/world-rss-desk -w world-pipeline -L 5`, 실패 시 `gh run view <id> --log` |
| 실행 자체가 안 뜸 | GitHub 토큰 만료 가능. 새 토큰을 `.env.local`에 넣고 `bash scripts/setup-scheduler.sh` |
| AI 오류 429 | 무료 한도 초과. 다음 실행에 자동 재시도. 계속되면 `MAX_EXTRACT`(cluster.ts) 줄이기 |
| 피드 실패 | `npm run feeds:check`, `/api/feed-health` |

## 3. 배포 방법

코드를 고친 뒤 프로젝트 폴더에서:

```bash
npm run lint && npm run build && npm run test   # 먼저 확인
npx vercel deploy --prod                         # Vercel 서버에서 빌드 후 같은 주소에 반영 (1~2분)
```

- 이 PC는 Vercel CLI에 로그인되어 있고 폴더가 프로젝트에 연결되어 있다(`.vercel/`, git에는 안 올라감).
- 로그인이 풀렸다면 `npx vercel login` → 브라우저에 뜬 페이지에서 Approve (코드 유효시간 10분).
- 배포가 잘못됐을 때: Vercel 대시보드 → Deployments → 이전 배포의 ⋯ → **Instant Rollback**.

## 4. 비용 — 지금은 0원

### Hobby(무료) 플랜에서 매달 무료로 주는 양

| 항목 | 무료 한도/월 | 이 서비스 예상 사용량/월 | 설명 |
|------|-------------|------------------------|------|
| Function Invocations | 100만 회 | 수천~수만 회 | `/api/world`·`/api/actors` 실행 횟수. CDN 캐시 적중은 포함 안 됨 |
| Active CPU | 4시간 | 약 30분~1시간 | 함수가 실제 CPU를 쓴 시간. RSS를 기다리는 시간은 안 셈 |
| Provisioned Memory | 360 GB-시간 | 수 GB-시간 | 함수 실행 중 잡은 메모리 × 시간 |
| Fast Data Transfer | 100 GB | 1 GB 미만 | 브라우저로 내려간 데이터 |
| Fast Origin Transfer | 10 GB | 1 GB 미만 | CDN ↔ 함수 사이 데이터 |
| 빌드 | 시간당 100회, 동시 1개 | 하루 몇 회 | 배포 횟수 |

화면은 저장된 결과만 읽고 CDN에 캐시되어 함수 실행이 적다.
한도의 3~5% 수준이라 **혼자 쓰는 한 한도에 닿을 일은 사실상 없다.** 실제 사용량은 Vercel 대시보드 → Usage에서 확인.

### 한도를 넘으면?
- **Hobby는 카드 등록이 없어서 요금이 청구되지 않는다.** 대신 지속적으로 넘으면 Vercel이 먼저 연락하고, 그래도 계속되면 **프로젝트가 일시정지(paused)**된다.
- 정지되면 자동으로 풀리지 않는다. 사용량을 줄인 뒤 대시보드에서 재개하거나 Pro 플랜으로 올려야 한다.
- **Pro 플랜**은 월 $20 + 사용량 과금. 지금 규모에선 필요 없다.

### 돈이 들 수 있는 경우 (지금은 해당 없음)
| 상황 | 비용 |
|------|------|
| 광고나 유료화 등 **상업적 사용** | Hobby 약관 위반 → Pro 필요 ($20/월~) |
| 내 도메인 | 도메인 구입비 연 1.5~2만 원 정도 |

## 5. 도메인

- **`*.vercel.app` 주소는 무료로 계속 쓸 수 있다.** 이름이 비어 있으면 원하는 걸로 바꿀 수 있다.
- 내 도메인을 쓰려면: 도메인 등록업체(가비아, Cloudflare, Namecheap 등)에서 구입 → `npx vercel domains add <도메인>` → 안내대로 DNS 설정. HTTPS 인증서는 Vercel이 무료로 붙여준다.
- **주의:** 새 주소를 붙일 때는 반드시 프로젝트의 **production 도메인**으로 등록해야 한다(`vercel domains add`). `vercel alias`로만 붙이면 Vercel 배포 보호(Deployment Protection)에 걸려 로그인 화면으로 넘어간다 — 실제로 한 번 겪었다.

## 6. 알아둘 위험과 대응

| 위험 | 대응 |
|------|------|
| 매체가 RSS를 없애거나 주소를 바꿈 | `npm run feeds:check` → `catalog.json` 수정 |
| GitHub 실행 토큰 만료 | 새 토큰 → `scripts/setup-scheduler.sh`. 그동안은 GitHub 예비 schedule이 드물게 돈다 |
| Gemini 무료 한도·정책 변경 | `GEMINI_MODELS`로 모델 교체, `MAX_EXTRACT` 조절 |
| Supabase 무료 500MB | 파이프라인이 오래된 데이터를 정리한다. 대시보드에서 용량 확인 |
| Supabase 7일 비활동 정지 | 30분 예약 실행이 돌면 생기지 않는다 |

## 6-1. 자동 점검 (cron)
- `vercel.json`의 `crons`: 매일 21:00 UTC(06:00 KST)에 `/api/feed-health` 호출. Hobby 플랜은 cron 하루 1회까지 무료.
- Vercel 환경 변수 `CRON_SECRET`(Production)이 있으면 cron 요청에 `Authorization: Bearer …`가 붙고, 그때만 결과 캐시를 지우고 다시 점검한다. 그 밖의 호출은 24시간 캐시된 결과만 돌려준다(남용 방지).
- 한 번 점검 = 카탈로그 270개 요청(동시 20개, 피드당 6초 제한, 함수 최대 300초). 하루 1회라 무료 한도에 영향이 거의 없다.
- 결과는 `/api/feed-health`.

## 7. 자주 쓰는 명령

```bash
npm run dev               # 로컬 개발 서버 http://localhost:3000
npm run feeds:check       # 카탈로그 실동작 점검 (내 PC에서)
npm run query -- "select ..."   # 그래프에 읽기 쿼리
npx vercel deploy --prod  # 배포
npx vercel ls             # 배포 목록
npx vercel logs world-rss-desk.vercel.app   # 최근 서버 로그
```
