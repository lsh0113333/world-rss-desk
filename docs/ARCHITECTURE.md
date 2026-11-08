# 아키텍처

한 줄 요약: **30분마다 RSS를 읽어 온톨로지(객체·관계)에 쌓고, 규칙으로 판단한 상황판을 저장한다. 화면은 저장된 상황판만 읽는다.**

```
 Supabase pg_cron (30분마다)
   │ workflow_dispatch (토큰은 Vault)
   ▼
 GitHub Actions: scripts/run-pipeline.ts → src/services/pipeline.ts
   1. 감지   RSS 피드 수집 (services/rss, url-guard 통과)             ─규칙
   2. 묶기   같은 일을 다룬 기사 묶음 (lib/ontology/cluster)          ─규칙
   3. 읽기   새 묶음만 Gemini로 추출 (lib/ontology/extract)           ─AI
   4. 저장   objects / links (lib/ontology/graph로 검증)              ─규칙
   5. 판단   점수·순위·연관·추세 (lib/ontology/rules)                 ─규칙
            관계 온도·나라끼리 관심 (lib/ontology/relations)          ─규칙
   6. 결과   board_snapshots에 상황판 JSON 저장
   ▼
 Supabase (PostgreSQL, RLS: 공개 읽기 전용)
   ▲ publishable 키로 읽기
 Vercel: /api/world, /api/actors (CDN 캐시)
   ▲
 브라우저: /, /actors/[id], /relations, /ontology
```

## 디렉토리
```
src/
├── ontology/                # 온톨로지 정의 (코드가 아니라 데이터)
│   ├── world.ts             # 객체·관계 종류, 사건 유형과 배수, 큰 흐름, 규칙 숫자 ← 판단 기준은 전부 여기
│   ├── countries.ts         # 대륙 7개, 나라 → 대륙 (매체 없는 나라 포함)
│   └── outlets.ts           # 매체 → 본사 나라
├── lib/ontology/
│   ├── events.ts            # 단어 쌍으로 같은 일을 다룬 기사 찾기
│   ├── cluster.ts           # 규칙 묶기, AI에 보낼 묶음 정하기
│   ├── extract.ts           # AI 프롬프트·스키마·응답 검증
│   ├── graph.ts             # 관계가 설정에 맞는지 검사
│   ├── rules.ts             # 판단: 점수, 세계 5, IT 5, 대륙별, 흐름, 연관, 같은 사건 합치기
│   └── relations.ts         # 관계 온도(7일), 나라끼리 관심(24시간)
├── lib/board-prefs.ts       # 방문 기록과 내 기준 (BoardPrefsRepository, localStorage)
├── services/
│   ├── pipeline.ts          # 파이프라인 전체 흐름
│   ├── world.ts             # 화면용 읽기 (상황판, 행위자)
│   ├── rss.ts, http.ts      # RSS 수집 (charset 판별, 크기·시간 제한)
│   ├── gemini.ts            # AI 호출 (무료 모델 순서대로, 재시도)
│   └── supabase.ts          # PostgREST 최소 클라이언트
├── app/
│   ├── page.tsx             # 오늘의 세계
│   ├── actors/[id]/, ontology/
│   └── api/world, api/actors
├── components/              # WorldBoardView, EventRow, ActorView, OntologyView
├── hooks/useWorld.ts
├── data/catalog.json        # RSS 카탈로그
scripts/
├── run-pipeline.ts          # 파이프라인 실행 (npm run pipeline)
├── query.ts                 # 로컬 읽기 쿼리 (npm run query)
├── check-feeds.ts           # 카탈로그 점검 (npm run feeds:check)
├── setup-secrets.sh, setup-scheduler.sh, apply-migration.sh  # 비밀값·예약 실행·DB 변경 (사용자가 직접 실행)
supabase/migrations/         # 0001 기사, 0002 예약 실행, 0003 온톨로지, 0004 옛 테이블 삭제
```

## 저장소 (Supabase)
| 테이블 | 내용 | 보관 |
|---|---|---|
| `articles` | 수집한 기사 | 14일 |
| `objects` | 사건, 행위자, 큰 흐름, 나라, 대륙, 매체 | 30일 |
| `links` | 관계 + 관측 시각 + 근거 기사 + 누가 만들었나(ai/rule/config) | 30일 |
| `extraction_log` | AI에 이미 보낸 기사 (중복 호출 방지) | 14일 |
| `board_snapshots` | 규칙으로 계산한 화면 결과. 어제와 비교에도 쓴다 | 2일 |
| `pipeline_runs` | 실행 기록 | - |

## AI 호출을 아끼는 방법
- 이미 사건이 있는 묶음의 새 기사는 AI 없이 규칙으로 붙인다.
- AI에 보낸 기사는 기록해 두고 사건이 아니었어도 다시 보내지 않는다.
- 한 번 실행에 새 묶음 최대 48개(6개씩 묶어 8번 호출), 다시 정리 최대 6개. 사건이 2배 커지고 6시간 지나면 다시 정리한다.

## 비밀값
| 값 | 위치 | 쓰는 곳 |
|---|---|---|
| SUPABASE_SECRET_KEY, GEMINI_API_KEY | GitHub Secrets | 파이프라인 쓰기 |
| SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY | Vercel env, `.env.local` | 화면 읽기 |
| GitHub 실행 토큰 | Supabase Vault | pg_cron |
| SUPABASE_ACCESS_TOKEN | `.env.local` | 로컬 쿼리·마이그레이션 |

## 캐시
`/api/world`: CDN 1분 + stale 10분. `/api/actors`: CDN 5분 + stale 15분. 화면은 2분마다 다시 확인한다.
