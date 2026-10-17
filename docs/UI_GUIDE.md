# UI 디자인 가이드

## 디자인 원칙
1. **도구처럼 보여야 한다.** 마케팅 페이지가 아니라 매일 아침 여는 상황판이다. 히어로, 일러스트, 소개 문구를 넣지 않는다.
2. **정보 밀도 최우선.** 데스크톱 1920px 기준 한 화면에 패널 8개, 패널당 헤드라인 8개 이상이 스크롤 없이 보여야 한다.
3. **훑기 좋게.** 제목 → 매체 → 시간 순으로 시선이 흐르게 한다. 새 기사만 포인트 색으로 튀게 하고, 나머지는 모두 무채색이다.

## AI 슬롭 안티패턴 — 하지 마라
| 금지 사항 | 이유 |
|-----------|------|
| backdrop-filter: blur() | glass morphism은 AI 템플릿의 가장 흔한 징후 |
| gradient-text (배경 그라데이션 텍스트) | AI가 만든 SaaS 랜딩의 1번 특징 |
| "Powered by AI" 배지 | 기능이 아니라 장식. 사용자에게 가치 없음 |
| box-shadow 글로우 애니메이션 | 네온 글로우 = AI 슬롭 |
| 보라/인디고 브랜드 색상 | "AI = 보라색" 클리셰 |
| 모든 카드에 동일한 rounded-2xl | 균일한 둥근 모서리는 템플릿 느낌 |
| 배경 gradient orb (blur-3xl 원형) | 모든 AI 랜딩 페이지에 있는 장식 |
| 기사 썸네일 이미지 | 밀도를 떨어뜨리고 로딩이 느려진다. MVP는 텍스트만 |

## 색상
시스템 설정(`prefers-color-scheme`)을 따른다. `globals.css`에 CSS 변수 토큰으로 정의하고, Tailwind v4 `@theme`으로 노출한다.

### 배경
| 용도 | 라이트 | 다크 |
|------|------|------|
| 페이지 | #f5f5f4 | #0c0c0c |
| 패널 | #ffffff | #161616 |
| 패널 헤더 / hover 행 | #fafaf9 | #1c1c1c |
| 테두리 | #e7e5e4 | #262626 |

### 텍스트
| 용도 | 라이트 | 다크 |
|------|------|------|
| 헤드라인 | #1c1917 | #f5f5f5 |
| 요약 / 본문 | #44403c | #d4d4d4 |
| 보조 (매체명, 시간) | #78716c | #8a8a8a |
| 비활성 | #a8a29e | #5c5c5c |

### 데이터/시맨틱 색상
| 용도 | 값 |
|------|------|
| 새 기사 포인트 (유일한 강조색) | #d97706 (amber-600), 다크 #f59e0b |
| 에러 / 피드 실패 | #dc2626, 다크 #f87171 |
| 방문한 링크 | 보조 텍스트 색 (`visited:`) |

## 컴포넌트
### 패널
```
rounded-md border border-[--border] bg-[--panel] flex flex-col h-[28rem]
헤더: flex items-center gap-2 px-3 py-2 border-b border-[--border] bg-[--panel-header]
본문: flex-1 overflow-y-auto divide-y divide-[--border]
푸터(에러 있을 때만): px-3 py-1.5 text-xs text-[--error]
```
- 헤더 구성: `🇰🇷 한국 · 경제` (text-sm font-semibold), 새 기사 수 배지(`+3`, 포인트 색 텍스트, 배경 없음), 오른쪽에 갱신 시각(`10:42`, text-xs 보조), 새로고침/편집 아이콘 버튼.

### 기사 행 (ArticleRow)
```
<a> block px-3 py-2 hover:bg-[--panel-header]
제목: text-sm leading-snug line-clamp-2 text-[--headline]
메타: mt-0.5 text-xs text-[--muted]  "연합뉴스 · 12분 전"
새 기사: 제목 왼쪽에 2px 포인트 색 세로 막대 (border-l-2 border-amber-600 pl-2.5)
```
- `target="_blank" rel="noopener noreferrer"`
- 요약은 기본으로 숨기고, `title` 속성(툴팁)으로만 노출한다.

### 버튼
```
Primary: rounded bg-[--headline] text-[--panel] px-3 py-1.5 text-sm hover:opacity-90
Ghost:   rounded px-2 py-1 text-sm text-[--muted] hover:text-[--headline] hover:bg-[--panel-header]
Icon:    p-1 rounded text-[--muted] hover:text-[--headline]  (aria-label 필수)
```

### 입력 필드 / 셀렉트
```
rounded border border-[--border] bg-[--panel] px-3 py-2 text-sm focus:outline-2 focus:outline-amber-600
```

### 모달 (PanelEditor)
- 네이티브 `<dialog>`를 쓴다. 배경 오버레이는 `bg-black/40`이며 blur는 쓰지 않는다.
- 폭 `max-w-lg`, 데스크톱에서는 화면 중앙, 모바일에서는 하단 시트처럼 전체 폭.
- 단계: 대륙 셀렉트 → 나라 셀렉트 → 분야 칩 → 매체 체크박스 목록 → 커스텀 URL 입력 → 개수 → 저장.

## 레이아웃
- 상단 바: 높이 44px, sticky. 좌측에 앱 이름(text-sm font-semibold)과 오프라인일 때만 "오프라인"(text-xs, 에러색). 우측에 `모두 확인`, `↻ 전체 새로고침`, `+ 패널`, 설정(⋯) 메뉴.
- 새로고침 버튼: 누르면 아이콘 옆에 "갱신 중…"(text-xs 보조)을 표시한다. 완료 후 30초간 `disabled`(비활성 색)로 두고, 툴팁에 "30초 후 다시 가능"을 표시한다. 아이콘 회전 애니메이션은 쓰지 않는다.
- 토스트(삭제 되돌리기): 화면 하단 중앙, `rounded border bg-[--panel] px-3 py-2 text-sm`, "패널 삭제됨 · 되돌리기". 5초 후 사라지며 애니메이션은 없다.
- 그리드: `grid gap-3 p-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4`
- 전체 너비 제한 없음(와이드 모니터 활용). 텍스트는 좌측 정렬이 기본이며, 중앙 정렬은 빈 상태 안내에만 쓴다.

## 타이포그래피
- 폰트: 시스템 산세리프 스택 (`-apple-system, "Segoe UI", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`). 웹폰트는 로드하지 않는다.
| 용도 | 스타일 |
|------|--------|
| 앱 이름 | text-sm font-semibold tracking-tight |
| 패널 제목 | text-sm font-semibold |
| 헤드라인 | text-sm leading-snug |
| 메타 정보 | text-xs tabular-nums |

## 애니메이션
- 로딩 skeleton의 `animate-pulse`만 허용한다(회색 막대 6개).
- 그 외 전환, 슬라이드, 페이드 애니메이션은 모두 금지한다.

## 아이콘
- SVG 인라인, `strokeWidth={1.5}`, 16px. 아이콘 라이브러리는 쓰지 않는다(새로고침, 편집, 닫기, 화살표, 더보기 5~6개만 필요).
- 아이콘을 둥근 배경 박스로 감싸지 않는다.
- 국기는 이모지를 쓴다(Windows에서는 국가 코드 텍스트로 보일 수 있으니, 국기 옆에 항상 한글 나라명을 함께 쓴다).

## 상태 표시
| 상태 | 표시 |
|------|------|
| 로딩 | skeleton 6행 |
| 전체 실패 | 패널 본문 중앙에 "불러오지 못했습니다" + 다시 시도 버튼 |
| 부분 실패 | 푸터에 "2개 매체 불러오기 실패" (hover 시 매체명 목록) |
| 기사 없음 | "최근 기사가 없습니다" |
| 패널 0개 | 화면 중앙에 "패널을 추가하세요" + `+ 패널` 버튼 + "기본 구성 불러오기" |
