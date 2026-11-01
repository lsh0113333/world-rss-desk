# 진행 상황

마지막 갱신: 2026-11-01. 새 대화는 이 파일 → `CLAUDE.md` → `intent/` 순서로 읽고 "남은 작업"부터 이어 간다. 사람이 처음 볼 때는 `docs/GUIDE.md`.

## 지금 상태 (배포됨: https://world-rss-desk.vercel.app)
**오늘의 세계 + 온톨로지 실험실** — `intent/2026-10-23-ontology-lab.md` 로드맵 0·1단계 완료. 구조는 `docs/ARCHITECTURE.md`, 판단 기준은 `docs/ONTOLOGY.md`.
- 파이프라인: Supabase pg_cron 30분 → GitHub Actions → 수집 → 규칙 묶기 → Gemini 읽기(새 묶음만) → objects/links → 규칙 판단 → board_snapshots
- 화면: `/`(지금 흐름, 세계 5, IT 5, 대륙별, 사건 펼침), `/actors/[id]`, `/ontology`(규칙 실험)
- 로컬: `npm run query -- "select ..."`, 판단 기준 수정은 `src/ontology/world.ts`
- **매니저 안내: `docs/GUIDE.md`** (보는 순서, 무엇을 어디서 바꾸나), 작업 틀: `docs/HARNESS.md`

이전 버전(패널, 세계 흐름, 가판대)은 지웠다. 필요하면 git 기록에 있다.

## 남은 작업 (사용자 확인 필요한 것 포함)
0. **사용자가 직접 실행**: `! bash scripts/apply-migration.sh supabase/migrations/0004_drop_old_tables.sql` (옛 테이블 6개와 `articles.image` 삭제, 되돌릴 수 없음. 안전 장치가 Claude의 실행을 막았다. 안 해도 동작에는 영향 없음)
1. **사용자 피드백**: 실제 사이트를 PC와 폰에서 써 본 의견
   - **답변 대기**: `/ontology` 슬라이더를 메인 화면에도 반영되게 할지 (Claude 추천: 브라우저에 저장하는 방식. 사용자는 화면에서 바꾸면 메인이 바뀌는 것으로 이해하고 있었다)
2. **2단계 분석** (로드맵): 일별 기록 → 어제 대비 변화, 나라 × 나라 관심 행렬, 행위자 관계 온도
3. **3단계**: "나" 객체 + 규칙 → 나에게 한 문장 + 근거. 그다음 4단계(로그인), 5단계(공공 지원)
4. **추출 품질**: AI가 장소를 틀리게 잡는 경우가 있다(스포츠 사건이 엉뚱한 나라로). 같은 일의 다른 표현은 제목 합치기로 못 잡는다(프랑스·독일 시위가 따로). 관찰 후 규칙·프롬프트 조정
5. **Vercel 자동 배포**: 사용자가 https://vercel.com/account/login-connections 에서 GitHub 연결하면 `npx vercel git connect`. 지금은 `npx vercel deploy --prod --yes`. 파이프라인 코드는 GitHub에 올리면 다음 실행부터 바로 반영된다
6. 현지어 매체 보강: 번역 문제는 사건 요약이 한국어라 해결됐으므로 "영어판만" 원칙을 풀 수 있다. 중남미·아프리카 보강 후보

## 지나온 길
패널 대시보드(10/17) → 세계 흐름 AI(10/19) → 가판대(10/22) → 오늘의 세계 + 온톨로지(11/1) → 정리(11/1). 자세한 기록은 `git log`.

## 참고
- 배포: 이 PC는 Vercel CLI 로그인 + 프로젝트 연결 완료. `npx vercel deploy --prod --yes`. GitHub CLI `C:\gh\bin\gh.exe`, Supabase CLI `C:\supabase\supabase.exe`, Node.js `C:\nodejs` (Bash에서는 `export PATH="/c/nodejs:$PATH"`)
- DB 변경: `supabase/migrations/`에 파일을 추가하고 `bash scripts/apply-migration.sh <파일>`로 적용한다. Supabase ref `vzsdvpmnrrwyizeszimq`
- 파이프라인 수동 실행: `gh workflow run world-pipeline -R lsh0113333/world-rss-desk`
- 카탈로그 피드 id는 기사 기록이 참조하므로 바꾸지 않는다
