# 프로젝트: World RSS Desk

대륙 > 나라 > 분야별 무료 RSS를 한 화면의 패널 그리드에 모아, 매일 빠르게 세계 흐름을 훑는 1인용 뉴스 대시보드.

## 기술 스택
- Next.js 15 (App Router), Vercel 배포
- TypeScript strict mode
- Tailwind CSS v4
- SWR (클라이언트 데이터 fetch / 주기 갱신)
- fast-xml-parser (RSS 2.0 / Atom / RDF 파싱)
- @mozilla/readability + linkedom (읽기 모드 본문 추출, 서버 전용)
- Vitest + Testing Library (jsdom)

## 아키텍처 규칙
- CRITICAL: 외부 RSS 요청은 반드시 `src/app/api/` Route Handler → `src/services/`를 거친다. 클라이언트 컴포넌트에서 외부 URL을 직접 fetch하지 말 것. (CORS 회피, 캐시 일원화)
- CRITICAL: 화면 데이터는 `/api/*` JSON으로만 주고받는다. Server Action을 쓰지 말 것. (향후 네이티브 앱이 같은 API를 재사용)
- CRITICAL: 사용자 데이터 저장은 Repository 인터페이스(`LayoutRepository`, `ReadHistoryRepository`)만 통해 접근한다. 컴포넌트나 훅에서 localStorage를 직접 호출하지 말 것. (향후 DB 동기화로 교체)
- CRITICAL: 사용자가 입력한 RSS URL은 fetch 전에 반드시 `src/lib/url-guard.ts`의 `assertSafeUrl`을 통과시킬 것(카탈로그 URL도 같은 fetch 경로를 쓴다). http/https만 허용, 사설·루프백·링크로컬 IP 차단, 리다이렉트 대상도 재검증, 타임아웃 8초, 응답 2MB 제한. (공개 배포 → SSRF·오픈 프록시 방지)
- CRITICAL: 외부 콘텐츠(RSS, 기사 페이지)의 HTML을 그대로 렌더링하지 말 것. 제목·요약은 순수 텍스트로, 읽기 모드 본문은 서버에서 `ReaderBlock[]`(문단/제목/인용/목록/이미지 데이터)로 변환해 React 요소로만 그린다. `dangerouslySetInnerHTML` 사용 금지. (XSS 방지)
- CRITICAL: 원문 iframe은 서버(`/api/article`)가 해당 페이지의 X-Frame-Options/CSP frame-ancestors를 확인해 허용된 경우에만 띄운다. iframe에는 `sandbox`와 `referrerPolicy="no-referrer"`를 붙인다.
- 피드 하나가 실패해도 패널 전체가 실패하면 안 된다. `Promise.allSettled`로 부분 결과 + 에러 목록을 반환한다.
- 테스트는 네트워크에 의존하지 않는다. fixture XML(`src/**/__fixtures__/`)과 fetch mock을 사용한다.
- MVP에서 사용자 설정은 서버에 저장하지 않는다. 구현체는 `LocalStorageLayoutRepository`(`src/lib/layout-repository.ts`) 하나다.
- RSS 응답은 `ArrayBuffer`로 받아 charset을 판별해 디코딩한다(EUC-KR 등). `res.text()` 사용 금지.
- 컴포넌트는 `src/components/`, 훅은 `src/hooks/`, 타입은 `src/types/`, 순수 로직은 `src/lib/`, 외부 I/O는 `src/services/`에 둔다.

## 개발 프로세스
- CRITICAL: 새 기능(또는 요청 묶음)은 코드보다 먼저 `intent/YYYY-MM-DD-<이름>.md`(형식: `intent/TEMPLATE.md` — 문제·원하는 결과·영향받는 사용자와 시스템·제약·열린 질문)에 사용자의 말로 의도를 적고, 사용자 확인(accepted) 후 구현한다. 구현 중 의도가 바뀌면 intent 파일부터 고친다. 배포까지 끝나면 상태를 done으로. (`intent/README.md`)
- CRITICAL: 새 기능 구현 시 반드시 테스트를 먼저 작성하고, 테스트가 통과하는 구현을 작성할 것 (TDD)
- 커밋 메시지는 conventional commits 형식을 따를 것 (feat:, fix:, docs:, refactor:)
- 작업을 마칠 때(세션 종료 전) `docs/PROGRESS.md`의 완료/남은 작업/작업 기록을 갱신하고 커밋할 것. 새 세션은 이 파일부터 읽고 이어서 한다.

## 명령어
npm run dev      # 개발 서버
npm run build    # 프로덕션 빌드
npm run lint     # ESLint
npm run test     # 테스트 (vitest run)
