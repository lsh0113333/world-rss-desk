# 아키텍처

## 디렉토리 구조
```
src/
├── app/
│   ├── layout.tsx               # 루트 레이아웃, 글로벌 스타일, 메타데이터
│   ├── manifest.ts              # PWA 웹 앱 매니페스트
│   ├── page.tsx                 # 메인: 패널 그리드 (Server Component 셸 → Client 컴포넌트)
│   ├── globals.css              # Tailwind v4 + 색상 토큰
│   └── api/
│       └── feeds/route.ts       # GET 병합 기사 API
├── components/                  # UI 컴포넌트 (Client 경계는 여기서 'use client')
│   ├── PanelGrid.tsx
│   ├── Panel.tsx
│   ├── ArticleRow.tsx
│   ├── PanelEditor.tsx          # 추가/편집 모달
│   └── SettingsMenu.tsx         # 내보내기/가져오기/초기화
├── hooks/
│   ├── useLayout.ts             # localStorage 기반 레이아웃 상태
│   └── usePanelFeed.ts          # SWR로 /api/feeds 호출
├── types/
│   ├── catalog.ts               # Continent, Category, CountryCode, CatalogFeed
│   ├── article.ts               # Article, FeedError, FeedsResponse
│   └── layout.ts                # Panel, Layout
├── lib/                         # 순수 로직 (I/O 없음, url-guard의 DNS 조회만 예외)
│   ├── constants.ts             # 대륙/나라(한글명, 국기)/분야 메타데이터
│   ├── catalog.ts               # 카탈로그 조회 함수
│   ├── url-guard.ts             # SSRF 방지 URL 검증
│   ├── layout-store.ts          # 직렬화/검증/마이그레이션/프리셋 (순수 함수)
│   ├── layout-repository.ts     # LayoutRepository 인터페이스 + LocalStorageLayoutRepository
│   ├── merge.ts                 # 중복 제거 + 정렬 + limit
│   └── time.ts                  # 상대시간 포맷 ("12분 전")
├── services/
│   ├── rss.ts                   # 외부 RSS fetch + 파싱/정규화 (서버 전용)
│   └── __fixtures__/            # 테스트용 RSS2/Atom/RDF XML
└── data/
    └── catalog.json             # 큐레이션 피드 카탈로그
scripts/
├── execute.py                   # Harness 실행기
└── check-feeds.ts               # 카탈로그 URL 실동작 점검 (npm run feeds:check, 네트워크 사용)
```
테스트 파일은 대상 옆에 `*.test.ts(x)`로 둔다.

## 핵심 타입
```ts
type Continent = 'asia' | 'europe' | 'north-america' | 'south-america'
               | 'middle-east' | 'africa' | 'oceania' | 'global';
type Category  = 'top' | 'world' | 'politics' | 'economy' | 'tech' | 'science';
type CountryCode = string;            // ISO 3166-1 alpha-2. 지역 단위 'EU'(유럽)·'ME'(중동), 국제 매체 'WORLD'

interface CatalogFeed {
  id: string;                         // 'kr-yonhap-top' 형식, 전역 유일, 불변
  name: string;                       // 표시용 매체명
  url: string;                        // RSS URL (https 우선, 불가하면 http 허용)
  homepage: string;
  continent: Continent;
  country: CountryCode;
  category: Category;
  language: string;                   // 'ko' | 'en' | 'ja' ...
  note?: string;                      // 표시용 주석 (예: '중국 정부 시각')
}

interface Article {
  id: string;                         // link(또는 guid) 해시
  title: string;                      // 순수 텍스트
  link: string;                       // http(s)만
  publishedAt: string | null;         // ISO 8601, 없으면 null
  source: string;                     // 매체명
  summary?: string;                   // 순수 텍스트, 최대 300자
}

interface FeedError { feed: string; message: string }   // feed = 카탈로그 id 또는 URL
interface FeedsResponse { articles: Article[]; errors: FeedError[]; fetchedAt: string }

interface Panel {
  id: string;                         // crypto.randomUUID()
  title?: string;                     // 없으면 "국기 + 나라 + 분야"로 자동 생성
  country?: CountryCode;
  category?: Category;
  feedIds: string[];                  // 카탈로그 id
  customUrls: string[];
  limit: number;                      // 5~30, 기본 10
  lastSeenAt?: string;                // ISO
}

interface Layout { version: 1; panels: Panel[] }
```

## API 계약
`GET /api/feeds?ids=kr-yonhap-top,kr-hankyung-economy&urls=<enc1>&urls=<enc2>&limit=10`
- `ids`: 카탈로그 id 목록(쉼표 구분). 존재하지 않는 id는 `errors`에 기록한다.
- `urls`: 커스텀 피드 URL. **피드마다 파라미터를 반복**한다(URL 안에 쉼표가 있을 수 있어 쉼표로 합치지 않음). 각각 encodeURIComponent 처리, `assertSafeUrl`을 통과해야 한다.
- `fresh=1`(선택): 수동 새로고침용. 서버 fetch를 `cache: 'no-store'`로 하고 응답도 `Cache-Control: no-store`로 보낸다.
- `maxAgeHours`(선택, 기본 72): 이보다 오래된 기사는 제외한다. `publishedAt`이 null이면 제외하지 않는다.
- 제한: ids + urls 합계 최대 12개, `limit` 1~50(기본 10). 넘으면 400.
- 응답 200: `FeedsResponse`. 피드 일부가 실패해도 200이며 실패는 `errors`에 담긴다.
- 헤더(기본): `Cache-Control: public, s-maxage=600, stale-while-revalidate=1800`
- 런타임: Node.js (DNS 조회가 필요하므로 Edge 사용 안 함)

## 패턴
- Server Component는 셸(`page.tsx`, `layout.tsx`)만 맡는다. 레이아웃이 localStorage에 있으므로 그리드 이하는 Client Component다.
- `services/`는 I/O만, `lib/`는 순수 함수로 둔다. Route Handler는 둘을 조립하는 얇은 계층이다.
- **플랫폼 중립 API**: 화면에 필요한 데이터는 모두 `/api/*`의 JSON으로 받는다. 웹 UI만 쓰는 서버 전용 로직(Server Action 등)은 만들지 않는다. 나중에 네이티브 앱이 같은 API를 그대로 재사용하기 위함이다.
- **저장소 추상화**: 컴포넌트와 훅은 localStorage를 직접 만지지 않고 `LayoutRepository`만 호출한다.
  ```ts
  interface LayoutRepository {
    load(): Promise<Layout | null>;   // 없으면 null
    save(layout: Layout): Promise<void>;
  }
  ```
  MVP 구현체는 `LocalStorageLayoutRepository` 하나다. 3단계에서 `RemoteLayoutRepository`(DB)로 교체한다. 지금은 동기 저장이지만 원격 전환을 위해 인터페이스는 Promise로 둔다.
- 파싱 정규화 규칙(`services/rss.ts`):
  - **문자 인코딩**: 응답을 `ArrayBuffer`로 받는다. 인코딩은 Content-Type의 `charset` → XML 선언의 `encoding` → UTF-8 순으로 정하고, `TextDecoder`로 디코딩한다(EUC-KR, Shift_JIS 등 대응). `res.text()`를 쓰지 않는다.
  - RSS 2.0 `item`, Atom `entry`, RDF(RSS 1.0) `item`을 모두 지원한다.
  - 날짜는 `pubDate` / `updated` / `published` / `dc:date` 순으로 찾고, 파싱 실패 시 null.
  - 제목과 요약에서 HTML 태그를 제거하고 엔티티를 디코딩한다. CDATA를 처리하고 공백을 정규화한다.
  - link가 http(s)가 아니면 기사를 버린다.
- 병합 규칙(`lib/merge.ts`): 정규화한 link 기준으로 중복을 제거한다(쿼리의 utm_* 제거). `publishedAt` 내림차순, null은 맨 뒤. 그 뒤 limit을 적용한다.

## 데이터 흐름
```
[localStorage Layout]
      │ useLayout
      ▼
PanelGrid ──▶ Panel ──usePanelFeed (SWR, refreshInterval 10분)──▶ GET /api/feeds
                                                                 │
                                    ┌────────────────────────────┤
                                    ▼                            ▼
                          lib/catalog.getById            lib/url-guard.assertSafeUrl
                                    └──────────┬─────────────────┘
                                               ▼
                         services/rss.fetchFeed × N (Promise.allSettled, 타임아웃 8s, 2MB)
                                               ▼
                         services/rss.parseFeed → Article[]
                                               ▼
                         lib/merge.mergeArticles (중복 제거, 정렬, limit)
                                               ▼
                         FeedsResponse (CDN 캐시 10분) ──▶ Panel 렌더링
```

## 상태 관리
- **서버 상태**: SWR. 키는 `/api/feeds?…` URL이며, 같은 패널 구성은 자동으로 dedupe된다. `refreshInterval: 600_000`, `revalidateOnFocus: true`, `keepPreviousData: true`(오프라인·실패 시 마지막 데이터 유지).
  - 수동 새로고침: `usePanelFeed`가 `refresh()`를 노출한다. `fresh=1`을 붙인 URL로 fetch한 결과를 `mutate(data, { revalidate: false })`로 기본 키 캐시에 덮어쓴다.
  - 전체 새로고침: 상단 바가 이벤트(예: `refreshAll` 카운터 context)를 올리고 각 패널이 자기 `refresh()`를 호출한다.
- **사용자 설정**: `useLayout` 훅 하나만 쓴다. 변경 시 `LayoutRepository.save`로 즉시 저장한다(MVP: localStorage 키 `world-rss-desk:layout`).
  - 읽기 시 `validateLayout`으로 검증하고, 깨진 데이터면 프리셋으로 대체한다(원본은 `…:layout-backup`에 보관).
  - `version` 필드로 마이그레이션한다(`migrate(raw): Layout`).
  - SSR hydration mismatch를 막기 위해 첫 렌더는 빈 상태로 그리고, mount 후 localStorage를 읽는다.
- 전역 상태 라이브러리(Redux, Zustand 등)는 쓰지 않는다.

## 배포와 소스 관리
```
노트북(개발) ── git push ──▶ GitHub private repo ── 자동 연동 ──▶ Vercel (24시간 서비스)
     │                                                         ▲
     └ python scripts/execute.py 0-mvp (로컬 git에 step별 커밋)    └ 폰·다른 PC에서 접속
```
- **로컬 git**: Harness 실행기(`execute.py`)가 step마다 브랜치(`feat-0-mvp`)와 커밋을 만들기 때문에 필수다. 외부 저장소 없이도 동작한다.
- **GitHub**: 배포와 백업용이다. phase가 끝나면 `feat-*` 브랜치를 push하고 main에 머지한다. Vercel은 main을 production으로, 그 외 브랜치를 preview URL로 배포한다.
- **Vercel 설정**: Framework preset Next.js, 환경변수 없음(MVP). 함수 리전은 `icn1`(서울)로 설정한다(`vercel.json`). 한국 매체의 응답 속도와 지역 차단에 대응하기 위함이다.
