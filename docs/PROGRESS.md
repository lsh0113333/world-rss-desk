# 진행 상황

마지막 갱신: 2026-11-08. 새 대화는 이 파일 → `CLAUDE.md` → `intent/` 순서로 읽고 "남은 작업"부터 이어 간다. 사람이 처음 볼 때는 `docs/GUIDE.md`.

## 지금 상태 (배포됨: https://world-rss-desk.vercel.app)
**오늘의 세계 + 온톨로지 실험실** — `intent/2026-10-23-ontology-lab.md` 로드맵 0·1·2·3단계 완료(순환 첫 한 바퀴). 구조는 `docs/ARCHITECTURE.md`, 판단 기준은 `docs/ONTOLOGY.md`.
- 파이프라인: Supabase pg_cron 30분 → GitHub Actions → 수집 → 규칙 묶기 → Gemini 읽기(새 묶음만) → objects/links → 규칙 판단 → board_snapshots
- 화면: `/`(나에게 한 문장(ADR-024), 지금 흐름, 세계 5, IT 5, 어제와 달라진 것, 대륙별, 사건 펼침), `/actors/[id]`, `/relations`(관계 온도 7일, 나라끼리 관심 24시간, ADR-023), `/ontology`(내 기준 정하기: 브라우저에 저장, 메인에 반영)
- 로컬: `npm run query -- "select ..."`, 판단 기준 수정은 `src/ontology/world.ts`
- **매니저 안내: `docs/GUIDE.md`** (보는 순서, 무엇을 어디서 바꾸나), 작업 틀: `docs/HARNESS.md`

이전 버전(패널, 세계 흐름, 가판대)은 지웠다. 필요하면 git 기록에 있다.

## 남은 작업 (사용자 확인 필요한 것 포함)
0. **확인 필요**: ("어제와 달라진 것"은 2026-11-03 실제 사이트에서 확인 완료) 슬라이더와 메인 연동은 테스트로만 확인했고 실제 브라우저로는 아직 안 봤다. 새 매체 추가 뒤 실패 피드가 2~3개에서 3~4개로 늘어 어떤 피드인지 확인한다.
   **사용자가 직접 실행**: `! bash scripts/apply-migration.sh supabase/migrations/0004_drop_old_tables.sql` (옛 테이블 6개와 `articles.image` 삭제, 되돌릴 수 없음. 2026-11-02에 다시 시도했지만 안전 장치가 또 막았다. 안 해도 동작에는 영향 없음)
   `! npx vercel env rm CRON_SECRET production --yes` (안 쓰는 Vercel 비밀값 삭제. 같은 이유로 직접 실행)
1. **사용자 피드백**: 실제 사이트를 PC와 폰에서 써 본 의견
2. **2단계 관찰** (2026-11-08 배포): 첫 결과 1위는 러시아 ↔ 우크라이나(갈등 15). "트럼프 ↔ 미국"처럼 사람과 자기 나라가 쌍이 되는 잡음이 있고, 관심 표는 하루치라 숫자가 작다(한국 매체가 상위 8개에 안 듦). 며칠 보고 사람→나라 묶기나 기간 조정을 정한다
3. **3단계 피드백** (2026-11-08 배포): 메인 맨 위 "내 상황 정하기"로 IT 업무·해외 일정을 넣고 써 보기. 문장 틀 문구, 걸리는 규칙(`src/ontology/me.ts`)을 의견대로 고친다. 상황 종류 추가(돈·한국 생활 등)도 여기서. 그다음 4단계(로그인), 5단계(공공 지원)
4. **추출 품질**: AI가 장소를 틀리게 잡는 경우가 있다(스포츠 사건이 엉뚱한 나라로). 같은 일의 다른 표현은 제목 합치기로 못 잡는다(프랑스·독일 시위가 따로). 관찰 후 규칙·프롬프트 조정
5. **Vercel 자동 배포**: 사용자가 https://vercel.com/account/login-connections 에서 GitHub 연결하면 `npx vercel git connect`. 지금은 `npx vercel deploy --prod --yes`. 파이프라인 코드는 GitHub에 올리면 다음 실행부터 바로 반영된다
6. 아프리카 매체 추가 보강: 2026-11-02에 후보 8곳 중 2곳만 넣었다(나머지는 접속 실패 또는 차단). 현지어 매체는 넣어도 다른 언어 기사와 규칙으로 잘 묶이지 않는다

## 지나온 길
패널 대시보드(10/17) → 세계 흐름 AI(10/19) → 가판대(10/22) → 오늘의 세계 + 온톨로지(11/1) → 정리(11/1). 자세한 기록은 `git log`.

## 참고
- 배포: 이 PC는 Vercel CLI 로그인 + 프로젝트 연결 완료. `npx vercel deploy --prod --yes`. GitHub CLI `C:\gh\bin\gh.exe`, Supabase CLI `C:\supabase\supabase.exe`, Node.js `C:\nodejs` (Bash에서는 `export PATH="/c/nodejs:$PATH"`)
- DB 변경: `supabase/migrations/`에 파일을 추가하고 `bash scripts/apply-migration.sh <파일>`로 적용한다. Supabase ref `vzsdvpmnrrwyizeszimq`
- 파이프라인 수동 실행: `gh workflow run world-pipeline -R lsh0113333/world-rss-desk`
- 카탈로그 피드 id는 기사 기록이 참조하므로 바꾸지 않는다
