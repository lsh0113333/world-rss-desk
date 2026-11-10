# 진행 상황

마지막 갱신: 2026-11-10. 새 대화는 이 파일 → `CLAUDE.md` → `intent/` 순서로 읽고 "남은 작업"부터 이어 간다. 사람이 처음 볼 때는 `docs/GUIDE.md`. 핵심 문서: 사용법 `USAGE.md`, 원리·구조 `ARCHITECTURE.md`, 온톨로지(수준 포함) `ONTOLOGY.md`.

## 지금 상태 (배포됨: https://world-rss-desk.vercel.app)
**오늘의 세계 + 온톨로지 실험실** — `intent/2026-10-23-ontology-lab.md` 로드맵 0·1·2·3단계 완료(순환 첫 한 바퀴). 구조는 `docs/ARCHITECTURE.md`, 판단 기준은 `docs/ONTOLOGY.md`.
- 파이프라인: Supabase pg_cron 30분 → GitHub Actions → 수집 → 규칙 묶기 → Gemini 읽기(새 묶음만) → objects/links → 규칙 판단 → board_snapshots
- 화면: `/`(나에게 한 문장(ADR-024), 지금 흐름, 세계 5, IT 5, 어제와 달라진 것, 대륙별, 사건 펼침), `/actors/[id]`, `/relations`(관계 온도 7일, 나라끼리 관심 24시간, ADR-023), `/ontology`(내 기준 정하기: 브라우저에 저장, 메인에 반영)
- 로컬: `npm run query -- "select ..."`, 판단 기준 수정은 `src/ontology/world.ts`
- **매니저 안내: `docs/GUIDE.md`** (보는 순서, 무엇을 어디서 바꾸나), 작업 틀: `docs/HARNESS.md`

이전 버전(패널, 세계 흐름, 가판대)은 지웠다. 필요하면 git 기록에 있다.

## 남은 작업 (사용자 확인 필요한 것 포함)
1. **사용자 피드백 대기** (2026-11-10): 3단계 "나에게 한 문장"과 사이트 전체를 써 보고 의견 주기로 함. 의견이 오면 `src/ontology/me.ts`(문구·규칙·상황 추가: 돈, 한국 생활 등)부터 고친다. 쓰는 법은 `docs/USAGE.md`
2. **4단계 (로그인)**: 피드백 반영 뒤, 다른 사람에게 보여 줄 때. "나"를 서버로 옮기는 것이라 개인 정보 설계 먼저. 그다음 5단계(공공 지원)
3. **온톨로지 다음 공부 거리** (`docs/ONTOLOGY.md` 0절 "없는 것"): 행위자 → 소속 나라 관계(같은 편 알기), Wikidata로 이름 합치기, 규칙 결과를 관계로 저장(추론), 행동(Action)
4. **추출 품질**: AI가 장소를 틀리게 잡는 경우(스포츠 사건이 엉뚱한 나라로), 같은 일의 다른 표현이 따로 잡히는 경우(프랑스·독일 시위). 관찰 후 규칙·프롬프트 조정
5. **확인 못 한 것**: 슬라이더·나에게 한 문장을 실제 브라우저로 눌러 보지는 않았다(테스트와 실제 데이터 미리보기로만 확인)
6. **사용자가 직접 실행** (안 해도 동작에는 영향 없음, 안전 장치가 Claude 실행을 막음)
   - `! bash scripts/apply-migration.sh supabase/migrations/0004_drop_old_tables.sql` (옛 테이블 6개와 `articles.image` 삭제, 되돌릴 수 없음)
   - `! npx vercel env rm CRON_SECRET production --yes` (안 쓰는 Vercel 비밀값 삭제)
   - Vercel 자동 배포: https://vercel.com/account/login-connections 에서 GitHub 연결 → `npx vercel git connect`. 지금은 `npx vercel deploy --prod --yes`
7. 피드: 실패하는 피드는 GitHub Actions 로그의 "실패 피드:" 줄로 바로 보인다(2026-11-10부터). 아프리카 매체는 후보 8곳 중 2곳만 들어갔다

## 지나온 길
패널 대시보드(10/17) → 세계 흐름 AI(10/19) → 가판대(10/22) → 오늘의 세계 + 온톨로지(11/1) → 정리(11/1). 자세한 기록은 `git log`.

## 참고
- 배포: 이 PC는 Vercel CLI 로그인 + 프로젝트 연결 완료. `npx vercel deploy --prod --yes`. GitHub CLI `C:\gh\bin\gh.exe`, Supabase CLI `C:\supabase\supabase.exe`, Node.js `C:\nodejs` (Bash에서는 `export PATH="/c/nodejs:$PATH"`)
- DB 변경: `supabase/migrations/`에 파일을 추가하고 `bash scripts/apply-migration.sh <파일>`로 적용한다. Supabase ref `vzsdvpmnrrwyizeszimq`
- 파이프라인 수동 실행: `gh workflow run world-pipeline -R lsh0113333/world-rss-desk`
- 카탈로그 피드 id는 기사 기록이 참조하므로 바꾸지 않는다
