# 아키텍처 — 원리와 구조

한 줄 요약: **30분마다 RSS를 읽어 온톨로지(객체·관계)에 쌓고, 규칙으로 판단한 상황판을 저장한다. 화면은 저장된 상황판만 읽고, 개인 설정(내 기준, 나)은 브라우저에서 규칙으로 다시 계산한다.**

온톨로지 자체(무엇을 어떤 기준으로 판단하나)는 [`ONTOLOGY.md`](ONTOLOGY.md), 화면 쓰는 법은 [`USAGE.md`](USAGE.md)에 있다.

---

## 1. 원리 6가지

1. **감지 → 이해 → 판단 → 한 문장.** RSS로 감지하고, 객체·관계로 이해하고, 규칙으로 판단하고, 나에게 한 문장으로 말한다.
2. **판단은 규칙, AI는 읽기만.** Gemini는 기사 묶음에서 사건·행위자·장소를 뽑는 일만 한다. 순위, 연관, 관계 온도, 권고는 전부 순수 함수 규칙이다. 그래서 같은 입력이면 같은 결과가 나오고, "왜"를 화면에 보여 줄 수 있다 (ADR-017).
3. **정의는 설정에, 사실은 그래프에.** 객체·관계 종류, 유형, 숫자는 `src/ontology/`에 있고, 사실은 `objects`·`links` 두 테이블에 있다. 분야를 바꾸려면 설정을 하나 더 만든다.
4. **무거운 일은 미리, 화면은 읽기만.** 수집·AI·판단은 파이프라인이 30분마다 하고 결과(상황판 JSON)를 저장한다. 화면은 그 JSON 하나만 읽어 빠르다.
5. **개인 데이터는 브라우저에.** 내 기준(유형 배수)과 나(내 상황, 일정)는 localStorage에만 저장하고, 상황판에 규칙을 다시 적용해 화면에서 계산한다. 서버로 보내지 않는다 (ADR-022·024).
6. **무료, 노트북 없이.** Supabase(DB·예약), GitHub Actions(실행), Gemini 무료 티어(AI), Vercel Hobby(사이트).

## 2. 전체 흐름

```
 Supabase pg_cron (30분마다)
   │ GitHub workflow_dispatch 요청 (토큰은 Supabase Vault)
   ▼
 GitHub Actions: scripts/run-pipeline.ts → src/services/pipeline.ts
   1. 감지   RSS 275개 수집 (services/rss, url-guard, charset 판별)        규칙
   2. 묶기   같은 일을 다룬 기사 묶음 (lib/ontology/events, cluster)        규칙
   3. 읽기   새 묶음만 Gemini로 추출 (lib/ontology/extract, services/gemini) AI
   4. 저장   objects / links, 행위자 소속 (lib/ontology/graph로 관계 검사) 규칙
   5. 판단   점수·세계 5·IT 5·대륙별·연관·추세·어제와 비교 (rules)         규칙
            관계 온도(7일)·나라끼리 관심(24시간) (relations)              규칙
   6. 결과   board_snapshots에 상황판 JSON 한 줄 저장
   ▼
 Supabase PostgreSQL (RLS: 공개 읽기 전용)
   ▲ publishable 키로 읽기 (services/world)
 Vercel: /api/world (상황판), /api/actors (행위자) — CDN 캐시
   ▲ SWR로 2분마다 확인
 브라우저
   /            나에게 한 문장 ← adviseMe(나, 사건)        (lib/ontology/me)
                지금 흐름, 세계 5, IT 5 ← applyMultipliers(상황판, 내 기준) (rules)
                어제와 달라진 것, 대륙별
   /relations   관계 온도, 나라끼리 관심 (상황판에 이미 계산됨)
   /actors/[id] 행위자 한 명의 사건과 함께 나온 행위자
   /ontology    구조, 규칙, 실제 숫자, 내 기준 정하기
   localStorage ── BoardPrefsRepository ── 방문 기록, 내 기준, 나
```

## 3. 파이프라인 한 번에 일어나는 일

| 단계 | 하는 일 | 아끼는 방법 |
|---|---|---|
| 감지 | 피드 20개씩 동시에 받아 48시간 안 기사만 `articles`에 저장 | 한 피드가 실패해도 계속 (allSettled 방식) |
| 묶기 | 최근 24시간 기사에서 제목 단어 쌍으로 같은 일을 묶는다 | — |
| 계획 | 묶음마다: 이미 사건이 있으면 규칙으로 붙이고, 새 묶음만 AI로, 2배 커지고 6시간 지난 사건은 다시 정리 | AI에 보낸 기사는 기록해 다시 안 보낸다 |
| 읽기 | 새 묶음 최대 48개(6개씩 8번 호출), 다시 정리 최대 6개 | 무료 모델 순서대로, 재시도 |
| 저장 | 사건·행위자 객체, 보도·역할·장소·흐름 관계 | 설정에 어긋나는 관계는 버린다 |
| 판단 | 24시간 사건으로 상황판, 24시간 전 상황판과 비교, 7일 사건으로 관계 온도 | — |
| 정리 | 기사 14일, 그래프 30일, 상황판 2일 지난 것 삭제 | 무료 DB 용량 |

## 4. 디렉토리
```
src/
├── ontology/                # 온톨로지 정의 (코드가 아니라 설정)
│   ├── world.ts             # 객체·관계 종류, 사건 유형과 배수, 큰 흐름, 규칙 숫자 ← 판단 기준
│   ├── me.ts                # 나: 내 상황, 권고 규칙과 문장 틀
│   ├── countries.ts         # 대륙 7개, 나라 → 대륙
│   └── outlets.ts           # 매체 → 본사 나라
├── lib/ontology/            # 순수 함수 (네트워크 없음, 테스트로 고정)
│   ├── events.ts            # 단어 쌍으로 같은 일을 다룬 기사 찾기
│   ├── cluster.ts           # 묶기, AI에 보낼 묶음 정하기
│   ├── extract.ts           # AI 프롬프트·스키마·응답 검증
│   ├── graph.ts             # 관계가 설정에 맞는지 검사
│   ├── rules.ts             # 상황판: 점수, 세계 5, IT 5, 대륙별, 흐름, 연관, 합치기, 어제와 비교, 내 기준 적용
│   ├── relations.ts         # 관계 온도, 나라끼리 관심
│   └── me.ts                # 나에게 한 문장 (브라우저에서 실행)
├── lib/board-prefs.ts       # BoardPrefsRepository: 방문 기록, 내 기준, 나 (localStorage)
├── lib/url-guard.ts         # 외부 URL 검사 (SSRF 방지)
├── services/                # 외부 I/O
│   ├── pipeline.ts          # 파이프라인 전체 흐름
│   ├── world.ts             # 화면용 읽기 (상황판, 행위자)
│   ├── rss.ts, http.ts      # RSS 수집 (charset 판별, 8초·2MB 제한)
│   ├── gemini.ts            # AI 호출
│   └── supabase.ts          # PostgREST 최소 클라이언트
├── app/                     # 페이지: /, /relations, /actors/[id], /ontology / API: /api/world, /api/actors
├── components/              # WorldBoardView, MeCard, EventRow, RelationsView, ActorView, OntologyView
├── hooks/                   # useWorld(상황판), useMyRules(내 기준), useMe(나)
├── types/                   # world.ts(상황판), me.ts(나), catalog.ts
└── data/catalog.json        # RSS 카탈로그 275개
scripts/
├── run-pipeline.ts          # 파이프라인 실행 (npm run pipeline)
├── query.ts                 # 로컬 읽기 쿼리 (npm run query)
├── check-feeds.ts           # 카탈로그 점검 (npm run feeds:check)
└── setup-secrets.sh, setup-scheduler.sh, apply-migration.sh  # 비밀값·예약 실행·DB 변경 (사용자가 직접 실행)
supabase/migrations/         # 0001 기사, 0002 예약 실행, 0003 온톨로지, 0004 옛 테이블 삭제
```

## 5. 상황판 JSON (`/api/world`)
`WorldBoard` (`src/types/world.ts`): `generatedAt`, `stats`(수집·AI·그래프 숫자), `flows`, `world`, `it`, `continents`, `events`(점수 내역, 행위자, 보도 나라, 연관, 근거 기사), `changes?`(어제와 비교), `relations?`(관계 온도, 나라끼리 관심). 화면은 이것 하나로 모든 페이지를 그린다(행위자 페이지만 `/api/actors`).

## 6. 저장소 (Supabase)
| 테이블 | 내용 | 보관 |
|---|---|---|
| `articles` | 수집한 기사 | 14일 |
| `objects` | 사건, 행위자, 큰 흐름, 나라, 대륙, 매체 | 30일 |
| `links` | 관계 + 관측 시각 + 근거 기사 + 만든 주체(ai/rule/config) | 30일 |
| `extraction_log` | AI에 이미 보낸 기사 | 14일 |
| `board_snapshots` | 상황판 JSON. 어제와 비교에도 쓴다 | 2일 |
| `pipeline_runs` | 실행 기록과 숫자 | - |

브라우저 localStorage: `world-rss-desk:visits`(방문), `world-rss-desk:rules`(내 기준), `world-rss-desk:me`(나).

## 7. 보안
- 외부 RSS는 파이프라인(`services/`)에서만 받는다. URL은 `url-guard`로 http/https만, 사설 IP 차단, 리다이렉트 재검사, 8초·2MB 제한.
- 외부 글(RSS, AI 결과)은 텍스트로만 그린다. HTML을 그대로 넣지 않는다.
- DB는 RLS로 공개 읽기만 허용하고, 쓰기 키는 GitHub Secrets에만 있다.

| 비밀값 | 위치 | 쓰는 곳 |
|---|---|---|
| SUPABASE_SECRET_KEY, GEMINI_API_KEY | GitHub Secrets | 파이프라인 쓰기 |
| SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY | Vercel env, `.env.local` | 화면 읽기 |
| GitHub 실행 토큰 | Supabase Vault | pg_cron |
| SUPABASE_ACCESS_TOKEN | `.env.local` | 로컬 쿼리·마이그레이션 |

## 8. 캐시와 배포
- `/api/world`: CDN 1분 + stale 10분. `/api/actors`: CDN 5분 + stale 15분. 화면은 2분마다 확인한다.
- 파이프라인 코드는 `main`에 push하면 다음 실행부터 반영된다. 화면·API는 `npx vercel deploy --prod --yes`로 배포한다.
