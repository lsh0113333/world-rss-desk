# UI 디자인 가이드 (v4, 2026-11-01)

방향: **답 먼저, 나머지는 눌렀을 때.** 어두운 화면에 제목 글자가 주인공이다. 사진은 쓰지 않는다.

## 원칙
1. 5초 안에 오늘의 흐름이 들어온다. 첫 화면 사건은 제목과 나라 수만.
2. 설명 없이 쓴다. 설정이 없다. 행은 누르면 그 자리에서 펼쳐진다.
3. 모든 결론은 근거로 내려갈 수 있다.
4. 공부 기능(왜 이 순위, 관계로 보기, 온톨로지)은 눌렀을 때만 보인다.

## 금지
blur, gradient 장식, 글로우, 보라색, "Powered by AI" 배지, 큰 마케팅 문구, 그래프 거미줄, `dangerouslySetInnerHTML`.

## 색 (`globals.css`, 어두운 테마 고정)
| 토큰 | 값 | 용도 |
|---|---|---|
| page / panel | #0a0e17 / #111723 | 배경 / 펼친 상세 |
| line | #222c3f | 구분선 |
| headline / body / muted / faint | #eef2f8 / #c5cedc / #8d9ab0 / #5e6b82 | 글자 |
| accent | #4f8ff7 | 새 사건 |
| --it | #7ee0a1 | IT 5, AI가 한 단계 표시 |
| --c-asia 주황, --c-europe 파랑, --c-north-america 장미, --c-south-america 노랑, --c-middle-east 모래, --c-africa 초록, --c-oceania 청록 | | 대륙 |

대륙 색은 대륙 제목, 순위 숫자, 보도 대륙 점에 쓴다.

## 글꼴
제목은 Black Han Sans(`font-display`), 본문은 Pretendard, 숫자와 코드는 JetBrains Mono(`font-mono`).

## 화면
- 폭: 첫 화면 최대 1240px. 세계 5 + IT 5는 md 이상 2단, 대륙은 sm 2단, lg 3단. 폰은 1단.
- 사건 행: 순위, 제목(굵게), 보도 대륙 점, N개 나라, 새, 떠오름.
- 흐름 행: 이름, 추세(▲ 커지는 중, – 유지, ▼ 잦아드는 중, 조용), 사건 수, 대표 사건 한 줄.
- 노치·홈 바는 safe-area로 비운다 (`viewport-fit=cover`).

## 애니메이션
불러오는 동안 pulse만.
