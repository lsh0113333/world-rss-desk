# World RSS Desk

대륙 > 나라 > 분야별 무료 RSS 헤드라인을 한 화면의 패널 그리드로 모아 보는 1인용 뉴스 대시보드.

- 기본 패널 8개(한국·미국·일본·중국·유럽·국제), 패널 추가/편집/순서 변경
- 78개 검증된 매체 카탈로그 + RSS 주소 직접 추가
- 10분 자동 갱신, 패널별/전체 수동 새로고침, 새 기사 강조
- 설정은 브라우저에 저장, JSON 내보내기/가져오기로 기기 간 이동
- 폰 홈 화면에 앱처럼 설치(PWA)

설계 문서: [PRD](docs/PRD.md) · [아키텍처](docs/ARCHITECTURE.md) · [ADR](docs/ADR.md) · [UI 가이드](docs/UI_GUIDE.md) · [운영·비용](docs/OPERATIONS.md) · [RSS 수집 기준](docs/FEEDS.md)

운영 주소: https://world-rss-desk.vercel.app

## 실행

Node.js 24 필요.

```bash
npm install
npm run dev          # http://localhost:3000
```

| 명령 | 설명 |
|------|------|
| `npm run dev` | 개발 서버 |
| `npm run build` / `npm start` | 프로덕션 빌드 / 실행 |
| `npm run lint` | ESLint |
| `npm run test` | 테스트 (네트워크 사용 안 함) |
| `npm run feeds:check` | 카탈로그 피드가 실제로 동작하는지 점검 (네트워크 사용) |

## 배포 (Vercel, 무료)

```bash
npx vercel login     # 최초 1회, 브라우저에서 로그인
npx vercel --prod    # 배포 → https://<프로젝트명>.vercel.app
```

서울 리전(`icn1`)은 `vercel.json`에 설정되어 있다. 환경변수는 필요 없다.

## 매체 추가

`src/data/catalog.json`에 항목을 추가하고 `npm run test`(스키마 검사)와 `npm run feeds:check`(실동작)를 통과시킨다.
일부 매체는 집에서는 되지만 Vercel 서버 IP를 차단한다(예: Japan Today 403). 배포 후 `/api/feeds?fresh=1&ids=<id>`로 한 번 더 확인한다.
id는 `{나라}-{매체}-{분야}` 형식이며, 사용자 설정이 참조하므로 한번 정하면 바꾸지 않는다.
