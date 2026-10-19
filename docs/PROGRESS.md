# 진행 상황 (이어서 작업하기용)

마지막 갱신: 2026-10-19. 새 세션은 이 파일 → `CLAUDE.md` → `intent/` → `docs/*.md` 순서로 읽고 "남은 작업"부터 이어서 한다.
같은 대화를 이어가려면 프로젝트 폴더에서 `claude --continue`.

## 일하는 방식 (2026-10-18부터)
- 새 기능은 **`intent/YYYY-MM-DD-이름.md`부터** (문제·원하는 결과·영향·제약·열린 질문, 사용자의 말 인용) → 사용자 확인 → 설계·TDD → 배포 후 상태 `done`. (`intent/README.md`, CLAUDE.md 규칙)
- **돈이 안 나가는 기준**. AI(2차)는 나중에 무료 수준으로 — 지금 만드는 것은 그 확장을 고려해 둔다.

## 완료 (배포됨: https://world-rss-desk.vercel.app)
1. 준실시간(2분) 갱신 + 썸네일(RSS 이미지 → `/api/thumb` og:image → 매체 이니셜)
2. 디자인 v2: 밝은 SaaS형, 사이드바, 오늘의 톱, 카드/목록/텍스트 보기, 넓게 보기, 원문 서랍
3. 쉬운 꾸미기: 온보딩, 2클릭 추가, Ctrl+K 명령창, 보드, 드래그 앤 드롭, 읽은 기사 흐리게
4. RSS 더 가져오기 4가지 — 카탈로그 확대(**270개, 55개 나라·지역, 해외는 영어판만**), 사이트 주소로 RSS 찾기(편집 창), 키워드 패널(구글 뉴스: 빠른 추가·명령창·편집 창), 자동 점검(매일 06:00 KST cron + 설정 "피드 상태"). 배포 서버 점검: 270개 중 269 정상(Nikkei Asia만 날짜 없음, 알려진 예외)
5. 원문 보기 개선 — 읽기 모드 우선 + "원본 페이지" 전환, 못 여는 기사는 RSS 요약 카드, "같은 소식, 다른 매체", 페이지 한도 5MB (ADR-014)
6. 세계 흐름 1차(무료, 브라우저 안 계산) — 같은 소식 묶기("+N개 매체"), 오늘의 이슈(나라별 비교), 헤드라인 벽(보드별 전환), 키워드 워치, 내 관심사 추천 + 패널 제안. 엔진은 `InsightEngine` 타입으로 분리(ADR-013)

7. **관점 비교 개편 1·2단계 (2026-10-19)** — `intent/2026-10-18-sensemaking.md`, ADR-015
   - GitHub 공개 저장소 https://github.com/lsh0113333/world-rss-desk , 매시 17분 Actions 파이프라인(수집 → 단어 쌍 사건 → Gemini 한국어 요약·나라별 시각·엔티티 → Supabase)
   - 화면: 보드 보기 "세계 흐름"(사건 카드·대표 이미지·급상승·12시간 추세, 지금 세계 지도, 상세: 요약·왜 중요한가·나라별 시각·근거 기사), 기사 → 원문 서랍 + 같은 사건 다른 매체
   - 첫 실행: 피드 264개, 기사 5,385개 → 사건 40개, AI 보강 16개, 59초. 나라별 시각 평균 2.5개(프롬프트 조정 후)
8. **앱처럼 보기 + 어두운 디자인 (2026-10-19)** — `intent/2026-10-19-app-dark.md`, UI_GUIDE v3: 기본 어두운 테마(설정에서 밝게, 저장), 기본 보기 세계 흐름, 폰 아래 탭 바·사건 상세 바텀 시트(쓸어내려 닫기)·safe-area, 대표 사건 1면 카드

## 남은 작업 (사용자 확인 필요한 것 포함)
1. **관점 비교 개편 3단계 (시간축·알림)**: 사건 타임라인(스냅샷은 이미 쌓는 중), 급상승 알림, **텔레그램 아침 브리핑** — 사용자가 @BotFather로 봇 토큰을 만들어 `.env.local`에 넣은 뒤 시작
2. **4단계 (온톨로지)**: 엔티티 관계도(entities·story_entities 이미 쌓는 중), "내 질문"(질문 단위 추적·주간 변화), GDELT 논조 결합
3. **사건 품질**: 흔한 단어 조합이 다른 일을 섞는 경우(예: bomb+threat), 같은 사건이 여러 개로 갈리는 경우(프랑스 소요 3~4개) → AI로 사건 합치기/나누기 단계 추가 검토. 한국어·영어 사건 묶기도 같은 단계에서
4. **Vercel 자동 배포**: 사용자가 https://vercel.com/account/login-connections 에서 GitHub 연결하면 `npx vercel git connect`. 지금은 `npx vercel deploy --prod --yes`
5. 사용자 피드백: 세계 흐름·어두운 디자인·폰 탭 바를 실제로 써 본 의견 (특히 홈 화면에 설치한 앱에서)
6. 작은 개선 후보: 헤드라인 벽 j/k, 이슈 대화상자 "패널 만들기·워치 추가", 추천 "관심 없음"

## 작업 기록
| 날짜 | 한 일 | 마지막 커밋 |
|------|------|------------|
| 2026-10-17 | 설계 문서 → MVP(1~11단계) → 분할 원문 보기 → 디자인 v2 → 쉬운 꾸미기 → RSS 확대(177개)·사이트 주소 탐색 백엔드. 테스트 366개 | `8414c6e` |
| 2026-10-18 | intent.md 도입 → 원문 보기 읽기 모드 우선·요약 카드 → RSS 2차 확대(270개, 유럽·북유럽·아일랜드·IT·중동, 영어판) → 세계 흐름 1차(묶기·이슈·헤드라인 벽·키워드 워치·추천) → 사이트 주소 찾기 화면·키워드 패널·자동 점검(cron). 테스트 465개, 배포·실서버 확인 | `74335cd` |
| 2026-10-19 | 관점 비교 개편 intent → GitHub 공개 저장소·Supabase·Gemini 준비 → 파이프라인(Actions 매시간)·사건 단어 쌍 묶기·AI 보강 → 세계 흐름 화면(사건 카드·지도·상세) 배포. 테스트 540개 | 이 파일 커밋 |

## 참고
- 배포: 이 PC는 Vercel CLI 로그인 + 프로젝트 연결 완료(`world-rss-desk`). `npx vercel deploy --prod --yes`. GitHub CLI `C:\gh\bin\gh.exe`(로그인됨), Supabase CLI `C:\supabase\supabase.exe`
- 파이프라인 수동 실행: `gh workflow run world-pipeline -R lsh0113333/world-rss-desk`, 로그 `gh run view <id> --log`. Supabase 프로젝트 ref `vzsdvpmnrrwyizeszimq`(싱가포르). `.env.local`에 SUPABASE_ACCESS_TOKEN·GEMINI_API_KEY·SUPABASE_URL·SUPABASE_PUBLISHABLE_KEY (git 제외, 값 출력 금지)
- Vercel 환경 변수: `CRON_SECRET`(Production) — cron 재점검용. 값은 Vercel에만 있음(필요하면 `vercel env rm` 후 새로 추가)
- Node.js: `C:\nodejs` (사용자 PATH에 등록됨. Bash에서는 `export PATH="/c/nodejs:$PATH"`)
- 카탈로그 피드 id는 사용자 설정이 참조하므로 바꾸지 않는다
- 새 피드 추가 절차: 후보 probe → `catalog.json` 추가 → `npm run feeds:check` → 배포 → 배포 서버에서 `/api/feeds?fresh=1&ids=…` (서버 IP 차단 확인) → `docs/FEEDS.md`
