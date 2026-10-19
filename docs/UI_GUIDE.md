# UI 디자인 가이드 (v3, 2026-10-19)

> v1(어두운 무채색, 텍스트 위주)에서 v2로 개편. 방향: **Feedly·Inoreader 같은 밝고 정돈된 SaaS형 리더** — 왼쪽 메뉴, 사진 카드, 넉넉하지만 정보량은 유지.

> **v3 (2026-10-19, `intent/2026-10-19-app-dark.md`)**: 기본 테마를 **어두운 "뉴스룸"**으로 바꾸고(설정 ⋯ → "밝은 화면으로"로 v2 밝은 테마 선택, `Layout.theme`에 저장), 폰·설치형 앱 사용을 우선했다.
> - 색 토큰: 기본 `:root` = 어두운 값(page `#0a0e17`, panel `#111723`, line `#222c3f`, headline `#eef2f8`, accent `#4f8ff7`), `:root[data-theme="light"]` = v2 값. Tailwind `dark:`는 `data-theme="dark"` 기준(`@custom-variant`). `<html data-theme>`는 Dashboard가 맞추고, 상태 표시줄 색(theme-color)도 같이 바꾼다.
> - 기본 보기는 **세계 흐름**(보드에 보기 선택이 없으면). 대표 사건은 사진 위에 제목(아래→위 검은 그라데이션 오버레이, 흰 글자)인 1면 카드, 나머지는 사진 카드.
> - 폰(lg 미만): **아래 탭 바**(세계·패널·헤드라인·검색·메뉴, 높이 56px+safe-area, 불투명), 위 보기 전환 버튼은 숨김. 사건 상세는 **아래에서 올라오는 시트**(손잡이를 90px 넘게 쓸어내리면 닫힘, `animate-sheet-in`). 상단 바·탭 바·시트는 노치/홈 바 safe-area를 반영(`viewport-fit=cover`).
> - 사진 위 그라데이션 오버레이는 가독성용으로만 허용(장식용 gradient·blur·glow 금지는 그대로).

## 디자인 원칙
1. **한눈에, 빠르게.** 첫 화면에서 "오늘의 톱" 카드 줄과 나라별 패널로 세계 흐름이 5초 안에 들어와야 한다.
2. **사진은 빠르게 훑는 도구.** 큰 사진은 패널당 1개(톱 기사)까지, 나머지는 작은 썸네일. 사진이 없어도 레이아웃이 무너지지 않는다(매체 이니셜 배지).
3. **새 소식이 눈에 띈다.** 새로 들어온 기사는 패널 맨 위로 들어오며 잠깐 파란 배경으로 강조된다.
4. **꾸미기는 그 자리에서.** 매체 칩, 보기 방식, 순서 변경을 모달 없이 패널 위에서 처리한다.

## AI 슬롭 안티패턴 — 하지 마라
| 금지 사항 | 이유 |
|-----------|------|
| backdrop-filter: blur() | glass morphism은 AI 템플릿의 가장 흔한 징후 |
| gradient-text, 배경 gradient orb | AI가 만든 SaaS 랜딩의 클리셰 |
| "Powered by AI" 배지 | 장식일 뿐 |
| box-shadow 글로우 애니메이션 | 네온 글로우 = AI 슬롭 |
| 보라/인디고 브랜드 색상 | "AI = 보라색" 클리셰. 강조색은 파랑(#2563EB) |
| 큰 히어로, 마케팅 문구 | 도구다. 첫 화면부터 기사 |

## 색상 (토큰: `globals.css`, Tailwind 클래스 `bg-page` `bg-panel` `text-headline` …)
| 토큰 | 라이트 | 다크 | 용도 |
|------|--------|------|------|
| page | #F6F7F9 | #0B1220 | 페이지 배경 |
| panel | #FFFFFF | #111A2E | 카드·패널·사이드바 |
| panel-header | #F8FAFC | #16213A | hover, 선택 행 |
| line | #E5E7EB | #1F2A44 | 테두리·구분선 |
| headline | #0F172A | #E2E8F0 | 제목 |
| body | #334155 | #CBD5E1 | 본문 |
| muted | #64748B | #94A3B8 | 매체명·시간·보조 |
| faint | #94A3B8 | #64748B | 비활성, 읽은 기사 |
| accent | #2563EB | #60A5FA | 강조(버튼, 새 기사, 선택, 켜진 칩) |
| accent-soft | #EFF6FF | #172554 | 강조 배경(새 기사 하이라이트, 켜진 칩) |
| error | #DC2626 | #F87171 | 실패 |

- 다크 모드는 시스템 설정을 따른다.
- 그림자: 카드에 `shadow-sm` 한 단계만. 글로우 금지.

## 타이포그래피
- 글꼴: **Pretendard**(한글·영문, jsDelivr CDN) → 시스템 산세리프 폴백.

| 용도 | 스타일 |
|------|--------|
| 앱 이름 | text-[15px] font-bold tracking-tight |
| 패널 제목 | text-sm font-semibold |
| 톱 카드 제목 | text-sm font-semibold leading-snug line-clamp-3 |
| 헤드라인 | text-sm leading-snug line-clamp-2 |
| 메타 | text-xs text-muted tabular-nums |

## 레이아웃
```
┌ 사이드바(w-60) ┬ 상단 바(h-14) ─────────────────────────────┐
│ 로고           │ 제목 · 갱신시각      [모두 확인][↻][+ 패널][⋯] │
│ 나라 목록      ├────────────────────────────────────────────┤
│  🇰🇷 한국  12  │ 오늘의 톱 (가로 스크롤 사진 카드)            │
│  🇺🇸 미국   8  │ 패널 그리드 1~4열                             │
└────────────────┴──────────────────────── 원문 슬라이드 패널 ──┘
```
- **사이드바**: lg 이상 고정, 그 미만은 ☰로 여는 서랍. 패널에 쓰인 나라 목록 + 나라별 새 기사 수. 누르면 해당 패널로 스크롤.
- **오늘의 톱**: 패널마다 최신 기사 1개를 사진 카드(폭 240px, 16:9 사진)로 가로 나열.
- **패널 그리드**: `grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4`, gap-4. 넓게 보기(`wide`) 패널은 2칸.
- **원문 패널**: 기사를 누르면 오른쪽에서 **밀려 나오는 서랍**(lg 이상 폭 `min(760px, 50vw)`, 그 미만 전체 화면). 평소에는 숨겨져 그리드가 넓게 보인다. 배경을 가리지 않아 왼쪽 목록을 계속 누를 수 있다.

## 컴포넌트
### 패널
```
rounded-xl border border-line bg-panel shadow-sm flex flex-col h-[30rem]
헤더: px-4 pt-3 pb-2 — 국기+제목, 새 기사 배지, 시간, 아이콘(↻ ✎ ←→)
칩 줄: px-4 pb-2 가로 스크롤
```
- 새 기사 배지: `rounded-full bg-accent px-1.5 text-[11px] font-semibold text-white` "+3" (누르면 확인 처리)

### 보기 방식 (패널마다)
| 방식 | 모양 |
|------|------|
| 카드 | 첫 기사: 16:9 큰 사진 + 제목, 나머지: 목록 |
| 목록 (기본) | 왼쪽 64×48 썸네일 + 제목 2줄 + 메타 |
| 텍스트 | 사진 없이 제목 + 메타 (v1과 같음) |

### 썸네일
- `article.image` → 없으면 `/api/thumb?url=<기사>`(og:image) → 실패하면 **매체 이니셜 배지**(매체명 해시로 고른 옅은 배경 + 첫 글자).
- `loading="lazy"`, `referrerPolicy="no-referrer"`, `object-cover`.

### 매체 칩
```
켜짐: rounded-full border border-accent/30 bg-accent-soft px-2 py-0.5 text-xs text-accent
꺼짐: rounded-full border border-line px-2 py-0.5 text-xs text-muted hover:text-body
```

### 세계 흐름 (2026-10-18)
- 화면 위에서부터: 보드 보기 전환(오른쪽, "패널 | 헤드라인 벽") → **오늘의 이슈** 줄 → **내 관심사 추천** 줄 → 오늘의 톱(패널 보기) → 그리드 또는 벽.
- 이슈 칩: `rounded-lg border border-line bg-panel px-3 py-2 shadow-sm` — 순위(accent 숫자) · 이슈명(굵게, 최대 14rem) · 국기 최대 5개(+n) · "기사 N" · "1시간 +N"(accent-soft 배지). 가로 스크롤.
- 이슈 비교 대화상자: 나라별 열(기사 많은 나라부터), 1/2/3열 반응형.
- 추천 카드: 폭 16rem, 이유 한 줄(accent, 11px) + 제목 2줄 + 매체·시간. 패널 제안은 둥근 칩 버튼 "+ 🇸🇦 사우디아라비아 패널".
- **"+N개 매체"**: 메타 옆 `rounded bg-panel-header px-1 text-[11px] text-muted`.
- **키워드 강조**: `<mark>` `bg-amber-100 dark:bg-amber-900/60 rounded-sm px-0.5` (앰버는 강조 전용, 포인트 색 파랑과 구분). 키워드 칩도 같은 앰버.
- **헤드라인 벽**: 사진 없음. `columns-1 sm:2 xl:3 2xl:4`, 한 줄 = 국기(20px 칸) + 제목 13px + 매체·시간·"+N개 매체" 11px. 같은 소식은 한 줄.
- 원문 서랍: "읽기 모드 | 원본 페이지" 세그먼트(iframe 허용 매체만). 못 여는 기사는 RSS 요약 카드 + 회색 상자 안 "새 탭에서 열기". 아래에 "같은 소식, 다른 매체" 목록.

### 버튼
```
Primary: rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90
Ghost:   rounded-lg px-2.5 py-1.5 text-sm text-muted hover:bg-panel-header hover:text-headline
Icon:    rounded-md p-1.5 text-muted hover:bg-panel-header hover:text-headline (aria-label 필수)
```

### 입력
```
rounded-lg border border-line bg-panel px-3 py-2 text-sm focus:outline-2 focus:outline-accent
```

## 애니메이션 (허용 목록만)
| 이름 | 용도 | 사양 |
|------|------|------|
| fresh-in | 새로 들어온 기사 | 위에서 4px 내려오며 나타남(0.3s) + accent-soft 배경이 3초에 걸쳐 사라짐 |
| drawer-in | 원문 서랍 | 오른쪽에서 밀려 나옴(0.2s ease-out) |
| pulse | 로딩 skeleton | Tailwind animate-pulse |

- 그 외 애니메이션 금지. `prefers-reduced-motion`이면 모두 끈다.

## 아이콘
- SVG 인라인, strokeWidth 1.5, 16~18px. 아이콘을 둥근 배경 박스로 감싸지 않는다.
- 국기는 이모지(Windows는 글자로 보이므로 옆에 나라 이름을 항상 함께 쓴다).

## 상태 표시
| 상태 | 표시 |
|------|------|
| 로딩 | skeleton (썸네일 박스 + 줄 2개) × 6 |
| 전체 실패 | "불러오지 못했습니다" + 다시 시도 |
| 부분 실패 | 패널 하단 "N개 매체 불러오기 실패" (hover 시 사유) |
| 기사 없음 | "최근 기사가 없습니다" |
| 패널 0개 | 가운데 "패널을 추가하세요" + `+ 패널` + "기본 구성 불러오기" |
| 원문 | iframe / 읽기 모드 / "새 탭에서 열기" |
