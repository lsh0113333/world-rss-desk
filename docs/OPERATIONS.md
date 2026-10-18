# 운영 개요

서비스가 어디서 어떻게 돌아가는지, 무엇이 돈이 드는지, 문제가 생기면 어디를 보면 되는지 정리한다.
(2026-10-17 기준. Vercel 요금 정책은 바뀔 수 있으니 [vercel.com/pricing](https://vercel.com/pricing)에서 최종 확인)

## 1. 한눈에 보기

```
 [내 폰·PC 브라우저]
   │  https://world-rss-desk.vercel.app
   │  · 화면(HTML/JS)          → Vercel CDN이 바로 응답 (정적 파일)
   │  · 패널 설정(어떤 매체)   → 내 브라우저 localStorage에만 저장 (서버에 없음)
   │  · 기사 목록 요청         → GET /api/feeds
   │  · 기사 원문 보기         → GET /api/article (iframe 허용 판정 / 읽기 모드 본문)
   ▼
 [Vercel CDN (서울 icn1)] ── 2분 캐시 적중 시 여기서 바로 응답 (함수 실행 안 함)
   │ 캐시 없음 / 수동 새로고침(fresh=1)
   ▼
 [Vercel Function: /api/feeds (Node.js, 서울)]
   │ 매체 RSS 병렬 요청 (8초 타임아웃, 2MB 제한, 내부망 주소 차단)
   ▼
 [각 언론사 RSS 서버]  연합뉴스, BBC, NYT ... (78개)
```

- **노트북이 꺼져도 동작한다.** 코드는 Vercel 서버에서 돌고, 노트북은 개발·배포할 때만 쓴다.
- **DB가 없다.** 사용자 설정은 각 브라우저에만 있으므로, 기기를 바꿀 때는 ⋯ 메뉴의 내보내기/가져오기를 쓴다.

## 2. 구성 요소

| 무엇 | 어디 | 비고 |
|------|------|------|
| 소스 코드 | `C:\claude\RSS` (로컬 git, `main` 브랜치) | GitHub에는 아직 올리지 않음 |
| 호스팅 | Vercel 프로젝트 `world-rss-desk` | 계정 `lsh0113333-6451` (Google 로그인), Hobby(무료) 플랜 |
| 주소 | `https://world-rss-desk.vercel.app` | 무료 `*.vercel.app` 주소. 프로젝트의 production 도메인으로 등록됨 |
| 서버 리전 | `icn1` (서울) | `vercel.json`에서 지정 |
| 매체 목록 | `src/data/catalog.json` | 바꾸면 재배포해야 반영 |
| Node.js | `C:\nodejs` (v24) | 개발·빌드용 |

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
| Function Invocations | 100만 회 | 약 3~5만 회 | `/api/feeds`·`/api/article` 실행 횟수. CDN 캐시 적중은 포함 안 됨 |
| Active CPU | 4시간 | 약 30분~1시간 | 함수가 실제 CPU를 쓴 시간. RSS를 기다리는 시간은 안 셈 |
| Provisioned Memory | 360 GB-시간 | 수 GB-시간 | 함수 실행 중 잡은 메모리 × 시간 |
| Fast Data Transfer | 100 GB | 1 GB 미만 | 브라우저로 내려간 데이터 |
| Fast Origin Transfer | 10 GB | 1 GB 미만 | CDN ↔ 함수 사이 데이터 |
| 빌드 | 시간당 100회, 동시 1개 | 하루 몇 회 | 배포 횟수 |

예상치 계산: 패널 8개 × 2분마다 갱신 × 하루 3시간 열어둠 ≈ 하루 720회 + 썸네일 보완(/api/thumb, 기사당 하루 1회 캐시) 수십~수백 회 + 원문 열람 수십 회 ≈ 하루 1천 회, 월 3만 회 안팎.
한도의 3~5% 수준이라 **혼자 쓰는 한 한도에 닿을 일은 사실상 없다.** 실제 사용량은 Vercel 대시보드 → Usage에서 확인.

### 한도를 넘으면?
- **Hobby는 카드 등록이 없어서 요금이 청구되지 않는다.** 대신 지속적으로 넘으면 Vercel이 먼저 연락하고, 그래도 계속되면 **프로젝트가 일시정지(paused)**된다.
- 정지되면 자동으로 풀리지 않는다. 사용량을 줄인 뒤 대시보드에서 재개하거나 Pro 플랜으로 올려야 한다.
- **Pro 플랜**은 월 $20 + 사용량 과금. 지금 규모에선 필요 없다.

### 돈이 들 수 있는 경우 (지금은 해당 없음)
| 상황 | 비용 |
|------|------|
| 광고를 붙이거나 유료화 등 **상업적 사용** | Hobby 약관 위반 → Pro 필요 ($20/월~) |
| 내 도메인(예: `myrss.com`)을 쓰고 싶을 때 | 도메인 구입비 연 1.5~2만 원 정도 (Vercel 연결 자체는 무료) |
| 다른 사람들이 대량으로 접속·API 남용 | 무료 한도 초과 → 정지 (아래 6번 참고) |
| 번역 기능 추가 (로드맵 2단계) | DeepL 무료 API는 월 50만 자까지 0원 |

## 5. 도메인

- **`*.vercel.app` 주소는 무료로 계속 쓸 수 있다.** 이름이 비어 있으면 원하는 걸로 바꿀 수 있다.
- 내 도메인을 쓰려면: 도메인 등록업체(가비아, Cloudflare, Namecheap 등)에서 구입 → `npx vercel domains add <도메인>` → 안내대로 DNS 설정. HTTPS 인증서는 Vercel이 무료로 붙여준다.
- **주의:** 새 주소를 붙일 때는 반드시 프로젝트의 **production 도메인**으로 등록해야 한다(`vercel domains add`). `vercel alias`로만 붙이면 Vercel 배포 보호(Deployment Protection)에 걸려 로그인 화면으로 넘어간다 — 실제로 한 번 겪었다.

## 6. 알아둘 위험과 대응

| 위험 | 현재 상태 | 대응 |
|------|----------|------|
| 매체가 RSS를 없애거나 주소를 바꿈 | 패널 하단에 "N개 매체 불러오기 실패" 표시 | `npm run feeds:check`로 점검 → `catalog.json` 수정 후 재배포 |
| 매체가 Vercel 서버 IP를 차단 | Japan Today가 실제로 차단(403)해서 제외함 | 집에서 되는 매체도 배포 후 `/api/feeds?fresh=1&ids=<id>`로 재확인 |
| `/api/feeds`·`/api/article`은 공개 주소라 누구나 호출 가능 | 요청당 피드 12개·기사 3MB 제한, 내부망 주소 차단만 있음 | 남용이 보이면(Usage 급증) 요청 횟수 제한이나 간단한 접근 키 추가 |
| 원문 보기: 일부 매체는 여기서 못 염 | NYT·SCMP·Japan Times(403), SMH(본문 추출 실패) → "새 탭에서 열기" | 정상 동작. 매체 정책이라 우회하지 않음 |
| 브라우저 데이터 삭제 시 패널 설정 소실 | 서버 백업 없음 | 가끔 ⋯ → 설정 내보내기로 JSON 백업 |
| Vercel 런타임 로그 보관 1시간 (Hobby) | 오류 원인 추적이 어려울 수 있음 | 문제 생기면 바로 대시보드 → Logs 확인 |

## 6-1. 자동 점검 (cron)
- `vercel.json`의 `crons`: 매일 21:00 UTC(06:00 KST)에 `/api/feed-health` 호출. Hobby 플랜은 cron 하루 1회까지 무료.
- Vercel 환경 변수 `CRON_SECRET`(Production)이 있으면 cron 요청에 `Authorization: Bearer …`가 붙고, 그때만 결과 캐시를 지우고 다시 점검한다. 그 밖의 호출은 24시간 캐시된 결과만 돌려준다(남용 방지).
- 한 번 점검 = 카탈로그 270개 요청(동시 20개, 피드당 6초 제한, 함수 최대 300초). 하루 1회라 무료 한도에 영향이 거의 없다.
- 결과는 앱의 설정(⋯) → **피드 상태**.

## 7. 자주 쓰는 명령

```bash
npm run dev               # 로컬 개발 서버 http://localhost:3000
npm run feeds:check       # 78개 매체 실동작 점검 (내 PC에서)
npx vercel deploy --prod  # 배포
npx vercel ls             # 배포 목록
npx vercel logs world-rss-desk.vercel.app   # 최근 서버 로그
```
