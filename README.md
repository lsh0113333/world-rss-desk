# 오늘의 세계 (World RSS Desk)

세계 흐름을 한눈에 잡는 사이트이자, 온톨로지를 직접 만들고 공부하는 실험실입니다.

**사이트**: https://world-rss-desk.vercel.app

궁극 목표는 "지금 상황이 이러시니 이렇게 하시면 돼요"라는 한 문장 솔루션입니다. 먼저 세계 뉴스로 구조를 검증하고, 공공 지원 분야로 넓혀 갑니다.

## 화면

| 주소 | 내용 |
|---|---|
| `/` | 나에게 한 문장(내 상황: 해외 일정·IT 업무, 이 브라우저에 저장, 쓰는 법은 [`docs/ME.md`](docs/ME.md)), 지금 흐름 8개, 세계 5, IT 5, 어제와 달라진 것, 대륙별 사건. 누르면 근거 기사까지 펼쳐짐 |
| `/actors/...` | 행위자가 나온 사건, 함께 나온 행위자 |
| `/relations` | 관계 온도(누가 누구와 갈등·협력하나, 7일), 나라끼리 관심(어느 나라가 어느 나라 일을 보도하나, 24시간) |
| `/ontology` | 시스템 구조, 규칙, 내 기준 정하기 (이 브라우저에 저장, 메인에 반영) |

## 원리

```
Supabase가 30분마다 실행 요청 → GitHub Actions에서 파이프라인 실행

 1. 감지  RSS 278개 피드에서 기사 수집           규칙
 2. 묶기  같은 일을 다룬 기사끼리 묶음            규칙
 3. 읽기  새 묶음만 사건·행위자·장소 추출         AI (Gemini)
 4. 저장  객체와 관계로 저장                     규칙 (PostgreSQL)
 5. 판단  점수 = 보도 규모 × 유형 배수 + 떠오름   규칙
 6. 결과  상황판 저장 → 사이트는 이것만 읽음      Vercel
```

- **온톨로지는 사람이 정한 설계도입니다.** 무엇이 있고 어떤 관계인지, 무엇이 더 중요한지를 [`src/ontology/world.ts`](src/ontology/world.ts)에 정합니다.
- **판단은 규칙, AI는 읽기와 말하기만.** 같은 입력이면 같은 순위가 나오고, 모든 결론에 근거 기사가 붙습니다.
- 모두 무료 플랜으로 돌아가고, 노트북을 꺼도 동작합니다.

## 문서

**처음이면 [매니저 안내](docs/GUIDE.md)부터 보세요.** 보는 순서, 무엇을 바꾸려면 어디를 고치는지, 운영 방법이 있습니다.

| 문서 | 내용 |
|---|---|
| [매니저 안내](docs/GUIDE.md) | 보는 순서, 바꾸는 법, 운영, 비용 |
| [진행 상황](docs/PROGRESS.md) | 지금 상태와 다음 할 일 |
| [온톨로지](docs/ONTOLOGY.md) | 객체, 관계, 사건 유형, 판단 규칙 |
| [아키텍처](docs/ARCHITECTURE.md) | 코드 구조, 테이블, 비밀값 위치 |
| [제품 요구사항](docs/PRD.md) | 목표, 사용자, 화면별 요구사항 |
| [설계 결정](docs/ADR.md) | 왜 이렇게 만들었나 |
| [UI 가이드](docs/UI_GUIDE.md) | 색, 글꼴, 화면 규칙 |
| [RSS 수집 기준](docs/FEEDS.md) | 매체 선정 기준, 뺀 매체와 이유, 추가 방법 |
| [하네스](docs/HARNESS.md) | AI와 일하는 틀 |
| [개발 규칙](CLAUDE.md) | 코드를 고칠 때 지킬 규칙 |
| [의도](intent/README.md) | 진행 중인 일의 "무엇을, 왜" |

## 실행

Node.js 24가 필요합니다. 화면을 로컬에서 보려면 `.env.local`에 `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`가 있어야 합니다.

```bash
npm install
npm run dev                # 로컬 화면 http://localhost:3000
npm run lint && npm run build && npm run test   # 올리기 전 확인
npm run query -- "select dst, count(*) from links group by dst"   # 그래프에 읽기 쿼리
npm run feeds:check        # RSS 피드 점검
npx vercel deploy --prod --yes   # 사이트 배포
```

파이프라인 코드는 `main`에 push하면 다음 실행부터 반영됩니다. 사이트는 Vercel 배포까지 해야 반영됩니다.
