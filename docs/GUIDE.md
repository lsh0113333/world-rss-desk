# 매니저 안내

이 프로젝트를 맡은 사람이 무엇을 어떤 순서로 보고, 무엇을 바꾸려면 어디를 고치는지 정리한 문서다.

사이트: https://world-rss-desk.vercel.app · 저장소: https://github.com/lsh0113333/world-rss-desk

## 1. 보는 순서

처음이거나 오랜만이면 위에서부터 본다. 1~3번이면 전체가 잡힌다.

| 순서 | 볼 것 | 얻는 것 | 시간 |
|---|---|---|---|
| 1 | [사이트](https://world-rss-desk.vercel.app) | 결과물 | 2분 |
| 2 | [`README.md`](../README.md) | 목적과 원리 | 2분 |
| 3 | [`PROGRESS.md`](PROGRESS.md) | 지금 어디까지 왔고 다음에 뭘 하나 | 2분 |
| 4 | 사이트의 [`/ontology`](https://world-rss-desk.vercel.app/ontology) | 실제 숫자와 규칙, 규칙 실험 | 5분 |
| 5 | [`ONTOLOGY.md`](ONTOLOGY.md) | 판단 기준의 설계 | 10분 |
| 6 | [`src/ontology/world.ts`](../src/ontology/world.ts) | 판단 기준의 실제 값. **가장 먼저 읽을 코드** | 5분 |
| 7 | [`ARCHITECTURE.md`](ARCHITECTURE.md) | 코드와 데이터 구조 | 10분 |

코드는 이 순서로 읽으면 흐름대로 따라갈 수 있다.

```
src/ontology/world.ts         무엇을 어떻게 판단하나 (기준)
src/services/pipeline.ts      전체 흐름 (이 파일 하나가 1~6단계 전부)
src/lib/ontology/rules.ts     판단 계산
src/lib/ontology/extract.ts   AI에게 시키는 일
src/components/WorldBoardView.tsx   화면
```

## 2. 시스템 한 장

```
Supabase pg_cron이 30분마다 요청 → GitHub Actions에서 파이프라인 실행
 1. 감지  RSS 수집                              규칙
 2. 묶기  같은 일을 다룬 기사끼리 묶음            규칙
 3. 읽기  새 묶음만 사건·행위자·장소 추출         AI (Gemini)
 4. 저장  객체와 관계로 저장                     규칙 (PostgreSQL)
 5. 판단  점수 = 보도 규모 × 유형 배수 + 떠오름   규칙
 6. 결과  상황판 저장 → 사이트는 이것만 읽음      Vercel
```

온톨로지는 사람이 정한 설계도이고(`world.ts`), Gemini는 칸을 채우고, PostgreSQL은 저장하고, 규칙이 판단한다. 노트북을 꺼도 전부 돌아간다.

## 3. 무엇을 바꾸려면 어디를

| 바꾸고 싶은 것 | 고칠 곳 | 반영 방법 |
|---|---|---|
| 순위 기준 (IT를 더 위로 등) | `src/ontology/world.ts`의 `EVENT_TYPES`, `RULES` | **A** |
| 지켜볼 큰 흐름 | `world.ts`의 `FLOWS` | **A**. 새 사건부터 적용 |
| 사건 유형 | `world.ts`의 `EVENT_TYPES` | **A**. 새 사건부터 적용 |
| 세계 5를 3개로 등 개수 | `world.ts`의 `RULES` | **A** |
| AI에게 시키는 내용 | `src/lib/ontology/extract.ts` | **B** |
| 묶는 방식, AI 호출 수 | `src/lib/ontology/cluster.ts`, `events.ts` | **B** |
| 판단 방식 (연관, 합치기) | `src/lib/ontology/rules.ts` | **A** |
| 매체 추가·삭제 | `src/data/catalog.json`, 필요하면 `src/ontology/outlets.ts` ([FEEDS.md](FEEDS.md) 5절) | **B** |
| 화면 | `src/components/` ([UI_GUIDE.md](UI_GUIDE.md)) | **C** |
| 저장 구조 | `supabase/migrations/`에 파일 추가 후 `bash scripts/apply-migration.sh <파일>` | 코드와 함께 |
| 새 기능 | 먼저 `intent/`에 적기 ([HARNESS.md](HARNESS.md)) | 내용에 따라 |

**반영 방법**: 파이프라인과 사이트가 따로 배포된다.

| | 대상 | 방법 |
|---|---|---|
| **A** | 파이프라인 + 화면 표시 | `git push` 후 `npx vercel deploy --prod --yes` |
| **B** | 파이프라인만 | `git push`. 다음 실행(최대 30분)부터 적용 |
| **C** | 화면만 | `git push` 후 `npx vercel deploy --prod --yes` |

올리기 전에는 항상 `npm run lint && npm run build && npm run test`를 돌린다.

**Claude에게 맡길 때**는 "IT 배수를 3으로 올려 줘"처럼 말하면 된다. 큰 기능이면 Claude가 intent를 먼저 쓰고 확인을 받는다.

**순위를 바꾸기 전에** `/ontology`의 규칙 실험에서 결과를 미리 본다. 실험은 저장되지 않는다.

## 4. 평소 운영

**할 일은 없다.** 사이트 상단 갱신 시각이 30분 안쪽이면 정상이다.

| 증상 | 할 일 |
|---|---|
| "갱신이 늦어지고 있어요" | `gh run list -R lsh0113333/world-rss-desk -w world-pipeline -L 5`. 실패면 `gh run view <id> --log` |
| 실행 자체가 안 뜸 | GitHub 토큰 만료 가능. 새 토큰을 `.env.local`의 `GITHUB_DISPATCH_TOKEN`에 넣고 `bash scripts/setup-scheduler.sh` |
| AI 오류 429 | 무료 한도 초과. 다음 실행에 자동 재시도. 계속되면 `cluster.ts`의 `MAX_EXTRACT`를 줄인다 |
| 어떤 매체가 안 나옴 | `npm run feeds:check` 후 `catalog.json` 수정 |
| 배포가 잘못됨 | Vercel 대시보드 → Deployments → 이전 배포 → Instant Rollback |

## 5. 온톨로지 공부

```bash
npm run query -- "select dst, count(*) from links where type = 'part_of' group by dst"
```
읽기용이다. `/ontology` 아래쪽에 예시 쿼리가 더 있다. 배수 바꿔 보기 → 결과 보기 → `world.ts`에 옮기기 순서가 좋다.

## 6. 비용과 한도

전부 무료 플랜이고 결제 수단은 등록하지 않았다.

| 서비스 | 무료 한도 | 지금 |
|---|---|---|
| Vercel Hobby | 함수 실행 월 100만 회 등 | CDN 캐시로 실행이 적다 |
| GitHub Actions | 공개 저장소 무제한 | 실행당 약 2분, 30분마다 |
| Supabase | DB 500MB, 7일 비활동 시 정지 | 약 100MB. 30분 실행이 정지를 막는다 |
| Gemini | 모델별 호출 한도 (바뀔 수 있음) | 실행당 새 사건 0~3개, 오류 없음 |

광고나 유료화를 하면 Vercel Hobby 약관에 어긋나 Pro($20/월~)가 필요하다. 내 도메인은 구입비만 든다. 새 주소는 `vercel domains add`로 production 도메인에 등록한다.

비밀값은 채팅과 저장소에 넣지 않는다. 위치는 [ARCHITECTURE.md](ARCHITECTURE.md)에 있다.
