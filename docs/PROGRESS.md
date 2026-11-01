# 진행 상황 (이어서 작업하기용)

마지막 갱신: 2026-11-01. 문서 목차는 `README.md`. 새 세션은 이 파일 → `CLAUDE.md` → `intent/` → `docs/*.md` 순서로 읽고 "남은 작업"부터 이어서 한다.
같은 대화를 이어가려면 프로젝트 폴더에서 `claude --continue`.

## 일하는 방식 (2026-10-18부터)
- 새 기능은 **`intent/YYYY-MM-DD-이름.md`부터** (문제·원하는 결과·영향·제약·열린 질문, 사용자의 말 인용) → 사용자 확인 → 설계·TDD → 배포 후 상태 `done`. (`intent/README.md`, CLAUDE.md 규칙)
- **돈이 안 나가는 기준**. AI(2차)는 나중에 무료 수준으로 — 지금 만드는 것은 그 확장을 고려해 둔다.

## 지금 상태 (배포됨: https://world-rss-desk.vercel.app)
**오늘의 세계 + 온톨로지 실험실** — `intent/2026-10-23-ontology-lab.md` 로드맵 0·1단계 완료. 구조는 `docs/ARCHITECTURE.md`, 판단 기준은 `docs/ONTOLOGY.md`.
- 파이프라인: Supabase pg_cron 30분 → GitHub Actions → 수집 → 규칙 묶기 → Gemini 읽기(새 묶음만) → objects/links → 규칙 판단 → board_snapshots
- 화면: `/`(지금 흐름, 세계 5, IT 5, 대륙별, 사건 펼침), `/actors/[id]`, `/ontology`(규칙 실험)
- 로컬: `npm run query -- "select ..."`, 판단 기준 수정은 `src/ontology/world.ts`
- **작업 틀: `docs/HARNESS.md`**, **운영 안내: `docs/GUIDE.md`** (목적, 원리, 운영자·온톨로지 엔지니어·개발자가 할 일)

이전 버전(패널, 세계 흐름, 가판대)은 지웠다. 필요하면 git 기록에 있다.

## 남은 작업 (사용자 확인 필요한 것 포함)
1. **사용자 피드백**: 실제 사이트를 PC와 폰에서 써 본 의견
   - **답변 대기**: `/ontology` 슬라이더를 메인 화면에도 반영되게 할지 (Claude 추천: 브라우저에 저장하는 방식. 사용자는 화면에서 바꾸면 메인이 바뀌는 것으로 이해하고 있었다)
2. **2단계 분석** (로드맵): 일별 기록 → 어제 대비 변화, 나라 × 나라 관심 행렬, 행위자 관계 온도
3. **3단계**: "나" 객체 + 규칙 → 나에게 한 문장 + 근거. 그다음 4단계(로그인), 5단계(공공 지원)
4. **추출 품질**: AI가 장소를 틀리게 잡는 경우가 있다(스포츠 사건이 엉뚱한 나라로). 같은 일의 다른 표현은 제목 합치기로 못 잡는다(프랑스·독일 시위가 따로). 관찰 후 규칙·프롬프트 조정
5. **사용자 결정 대기**: 운영 DB의 안 쓰는 옛 테이블(`stories`, `story_articles`, `story_snapshots`, `story_insights`, `entities`, `story_entities`, 약 7MB)과 `articles.image` 열 삭제 여부. 코드는 더 이상 쓰지 않는다. 되돌릴 수 없어 명시적 확인을 받는다
6. **Vercel 자동 배포**: 사용자가 https://vercel.com/account/login-connections 에서 GitHub 연결하면 `npx vercel git connect`. 지금은 `npx vercel deploy --prod --yes`. 파이프라인 코드는 GitHub에 올리면 다음 실행부터 바로 반영된다
7. 현지어 매체 보강: 번역 문제는 사건 요약이 한국어라 해결됐으므로 "영어판만" 원칙을 풀 수 있다. 중남미·아프리카 보강 후보

## 작업 기록
| 날짜 | 한 일 | 마지막 커밋 |
|------|------|------------|
| 2026-10-17 | 설계 문서 → MVP(1~11단계) → 분할 원문 보기 → 디자인 v2 → 쉬운 꾸미기 → RSS 확대(177개)·사이트 주소 탐색 백엔드. 테스트 366개 | `8414c6e` |
| 2026-10-18 | intent.md 도입 → 원문 보기 읽기 모드 우선·요약 카드 → RSS 2차 확대(270개, 유럽·북유럽·아일랜드·IT·중동, 영어판) → 세계 흐름 1차(묶기·이슈·헤드라인 벽·키워드 워치·추천) → 사이트 주소 찾기 화면·키워드 패널·자동 점검(cron). 테스트 465개, 배포·실서버 확인 | `74335cd` |
| 2026-10-19 | 관점 비교 개편 intent → GitHub 공개 저장소·Supabase·Gemini 준비 → 파이프라인(Actions 매시간)·사건 단어 쌍 묶기·AI 보강 → 세계 흐름 화면(사건 카드·지도·상세) 배포. 테스트 540개 | 이 파일 커밋 |
| 2026-10-20 | 앱처럼 보기·어두운 테마 배포 → 현황 점검(두 갈래 데이터 경로, Actions 예약 미실행, 메뉴 섞임) → **전면 개편 "세계 신문 가판대" intent accepted** (RSS만, AI·소스 추가 제외). 테스트 546개 | 이 파일 커밋 |
| 2026-10-21~22 | 가판대 시안 1(별로) → 시안 2(대륙 색·1면 제목, "7개의 대륙 좋아") → 국제·묶음 지역 제거 → 번역 방향 결정(기본 한국어, 2단계) → **가판대 1단계 TDD 구현·배포**. 테스트 571개 | 이 파일 커밋 |
| 2026-10-23 | 사용자: 가판대도 눈에 안 들어옴 → 원인 진단(재료만 보여 줌, 압축과 단순함을 동시에 못 함) → 큰 목표 공유("한문장 솔루션", 팔란티어·온톨로지) → **온톨로지 실험실 intent 초안**(draft, 답변 대기). 코드 변경 없음 | 이 파일 커밋 |
| 2026-10-24~11-01 | 온톨로지 실험실 0단계(옛 코드 정리, pg_cron 30분, 온톨로지 v0) → 시안 → **1단계 전면 개편**: 파이프라인 교체, 오늘의 세계·행위자·/ontology, 가판대 제거. 실행 결과: 기사 5,332건 → 묶음 122개 → 사건 43개, 110초. 테스트 262개 | 이 파일 커밋 |
| 2026-11-01 | 운영 안내 GUIDE, README를 개요·목차로 새로 작성, 안 쓰는 코드·실행기 삭제, 우리 하네스 정리(HARNESS, ADR-020). 시연용 claude.ai 링크 삭제. 테스트 230개 | 이 파일 커밋 |

## 참고
- 배포: 이 PC는 Vercel CLI 로그인 + 프로젝트 연결 완료(`world-rss-desk`). `npx vercel deploy --prod --yes`. GitHub CLI `C:\gh\bin\gh.exe`(로그인됨), Supabase CLI `C:\supabase\supabase.exe`
- 파이프라인 수동 실행: `gh workflow run world-pipeline -R lsh0113333/world-rss-desk`, 로그 `gh run view <id> --log`. Supabase 프로젝트 ref `vzsdvpmnrrwyizeszimq`(싱가포르). `.env.local`에 SUPABASE_ACCESS_TOKEN·GEMINI_API_KEY·SUPABASE_URL·SUPABASE_PUBLISHABLE_KEY (git 제외, 값 출력 금지)
- Vercel 환경 변수: `CRON_SECRET`(Production) — cron 재점검용. 값은 Vercel에만 있음(필요하면 `vercel env rm` 후 새로 추가)
- Node.js: `C:\nodejs` (사용자 PATH에 등록됨. Bash에서는 `export PATH="/c/nodejs:$PATH"`)
- 카탈로그 피드 id는 사용자 설정이 참조하므로 바꾸지 않는다
- 새 피드 추가 절차: `docs/FEEDS.md` 5절
