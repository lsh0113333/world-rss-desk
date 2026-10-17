# 진행 상황 (이어서 작업하기용)

마지막 갱신: 2026-10-17 (오늘 작업 종료). 새 세션은 이 파일 → `CLAUDE.md` → `docs/*.md` 순서로 읽고 "남은 작업"부터 이어서 한다.
같은 대화를 이어가려면 프로젝트 폴더에서 `claude --continue`.

## 완료 (배포됨: https://world-rss-desk.vercel.app)
1. 준실시간(2분) 갱신 + 썸네일(RSS 이미지 → `/api/thumb` og:image → 매체 이니셜)
2. 디자인 v2: 밝은 SaaS형, 사이드바, 오늘의 톱(중복 제외), 카드/목록/텍스트 보기, 넓게 보기, 원문 서랍
3. 쉬운 꾸미기: 온보딩, 2클릭 추가(QuickAdd), Ctrl+K 명령창, 보드(탭), 드래그 앤 드롭, 읽은 기사 흐리게

## 진행 중: 4단계 "RSS 더 가져오기 4가지"
| # | 방법 | 상태 |
|---|------|------|
| ① | 분야·나라·매체 확대 | **완료·배포** — 분야 6→11개(사회·건강·환경·문화·스포츠 추가), 나라·지역 13→36개, 피드 78→177개. 배포 서버에서 177/177 정상 확인 |
| ② | 사이트 주소로 RSS 찾기 | **백엔드 완료·배포(화면 연결 전)** — `src/lib/feed-discovery.ts`, `src/services/discover.ts`, `GET /api/discover?url=`. 카탈로그 매체는 카탈로그 피드로 제안, 중복 제거 |
| ③ | 키워드 패널(구글 뉴스) | 남음 |
| ④ | 자동 점검 | 남음 |

## 남은 작업 (순서대로)
1. **② UI**: `PanelEditor`의 "RSS 주소 직접 추가"를 "RSS 또는 사이트 주소"로 바꾸고 `/api/discover` 결과 목록에서 골라 추가. `catalogId`가 있으면 `feedIds`에, 없으면 `customUrls`에 넣는다. 기존 `validateFeedUrl` prop/테스트를 `discover` 기반으로 교체.
2. **③ 키워드 패널**
   - `Panel.query?: string` (layout-store 검증 포함), 제목 기본값 `🔎 {query}`
   - `/api/feeds`에 `q` 파라미터(반복 가능, 피드 수 제한에 포함) → `https://news.google.com/rss/search?q={q}+when:2d&hl=ko&gl=KR&ceid=KR:ko` (한글이 없으면 `hl=en-US&gl=US&ceid=US:en`)
   - 파서: RSS item의 `<source>`가 있으면 그 텍스트를 `source`로, 제목 끝 " - {source}" 제거
   - `Thumb`: 링크 호스트가 `news.google.com`이면 `/api/thumb` 건너뛰고 바로 이니셜(구글 로고가 나오는 것 방지)
   - 진입점: QuickAdd에 "키워드" 탭, 명령창에 "키워드 패널 추가: '{입력}'", PanelEditor에 키워드 입력
   - 원문 보기는 구글 경유 링크라 대부분 "새 탭에서 열기"가 됨(정상)
3. **④ 자동 점검**
   - `GET /api/feed-health`: 카탈로그 전체를 동시 20개·피드당 6초로 점검, `unstable_cache`로 24시간 캐시, `export const maxDuration = 300`
   - `vercel.json`에 `crons: [{ "path": "/api/feed-health", "schedule": "0 21 * * *" }]` (매일 06:00 KST, Hobby는 하루 1회까지)
   - 설정(⋯) 메뉴에 "피드 상태" → 실패·오래된 피드 목록 대화상자
4. **문서**: `docs/FEEDS.md`(177개 현황표, 제외 목록 추가: 한겨레(날짜 없음·재배포 금지 명시), Nature(쿠키 로그인 리다이렉트), JTBC(갱신 중단), Washington Post(502), 동아 사회(0건), Tuoi Tre·Jakarta Post·Focus Taiwan·Mail&Guardian(404), Tempo·Ahram(403), Taiwan News·Hurriyet·Daily Sabah(0건), News24(연결 실패), New Scientist(406), Antara(시간 초과)), `PRD.md` 분야 목록, `ARCHITECTURE.md` 트리(discover)
5. `npm run lint && npm run build && npm run test` → `npm run feeds:check` → `npx vercel deploy --prod --yes` → 배포 주소에서 `/api/feeds?fresh=1&ids=…`로 신규 피드 점검(서버 IP 차단 확인)

## 작업 기록
| 날짜 | 한 일 | 마지막 커밋 |
|------|------|------------|
| 2026-10-17 | 설계 문서 → MVP(1~11단계) → 분할 원문 보기 → 디자인 v2 → 쉬운 꾸미기 → RSS 확대(177개)·사이트 주소 탐색 백엔드. 테스트 366개 통과 | `70d429d` 이후 문서 갱신 |

## 참고
- 배포: 이 PC는 Vercel CLI 로그인 + 프로젝트 연결 완료(`world-rss-desk`). `npx vercel deploy --prod --yes`
- Node.js: `C:\nodejs`
- 카탈로그 피드 id는 사용자 설정이 참조하므로 바꾸지 않는다
