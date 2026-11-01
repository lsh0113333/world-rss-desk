# 오늘의 세계: 운영자 안내

사이트: https://world-rss-desk.vercel.app · 저장소: https://github.com/lsh0113333/world-rss-desk

## 무엇을 위한 사이트인가
1. **세계 흐름을 한눈에 잡는 사이트**: 오늘 세계에서 큰 일이 무엇인지 빠르게 본다.
2. **온톨로지 실험실**: 세상을 객체와 관계로 옮기고, 사람이 정한 기준으로 판단하는 구조를 직접 만들고 공부한다.

궁극 목표는 "지금 상황이 이러시니 이렇게 하시면 돼요"라는 한 문장 솔루션이다 (`intent/2026-10-23-ontology-lab.md`).

## 기능
| 화면 | 기능 |
|---|---|
| `/` 오늘의 세계 | 지금 흐름 8개, 세계 5, IT 5, 대륙별. 사건을 누르면 요약, 왜 이 순위, 관계, 연관 사건, 근거 기사 |
| `/actors/...` 행위자 | 그 행위자가 나온 사건, 함께 나온 행위자 |
| `/ontology` 온톨로지 | 도는 순서, 객체·관계 개수, 규칙, 규칙 실험 (실험은 저장되지 않고 메인에 반영되지 않는다) |

## 원리
```
Supabase pg_cron이 30분마다 실행 요청 → GitHub Actions에서 파이프라인 실행
 1. 감지  RSS 수집                          규칙
 2. 묶기  같은 일을 다룬 기사끼리 묶음        규칙
 3. 읽기  새 묶음만 사건·행위자·장소 추출     AI (Gemini)
 4. 저장  객체와 관계로 PostgreSQL에 저장     규칙
 5. 판단  점수 = 보도 규모 × 유형 배수 + 떠오름  규칙
 6. 결과  상황판 저장 → 사이트는 이것만 읽는다 (Vercel)
```
- **온톨로지는 설계도다.** `src/ontology/world.ts`에 사람이 정한다. Gemini는 칸을 채우고, PostgreSQL은 저장하고, 규칙이 판단한다.
- **판단은 규칙, AI는 읽기와 말하기만.** 같은 입력이면 같은 순위가 나오고, 이유를 설명할 수 있다.
- 노트북을 꺼도 전부 돌아간다. 모두 무료 플랜이다.

## 평소 운영
**할 일은 없다.** 사이트를 보다가 이것만 확인한다.
- 상단 갱신 시각이 30분 안쪽인가
- "갱신이 늦어지고 있어요"가 떠 있지 않은가

## 문제가 생기면
| 증상 | 할 일 |
|---|---|
| 갱신이 멈춤 | `gh run list -R lsh0113333/world-rss-desk -w world-pipeline -L 5`로 실행 기록 확인. 실패면 `gh run view <id> --log` |
| 실행 자체가 안 뜸 | GitHub 토큰 만료 가능. 새 토큰을 `.env.local`의 `GITHUB_DISPATCH_TOKEN`에 넣고 `bash scripts/setup-scheduler.sh` |
| AI 오류 429 | 무료 한도 초과. 다음 실행에 자동 재시도. 계속되면 `src/lib/ontology/cluster.ts`의 `MAX_EXTRACT`를 줄인다 |
| 피드 실패 | `npm run feeds:check` 후 `src/data/catalog.json` 수정 |

비밀값(키, 토큰)은 채팅과 저장소에 넣지 않는다. 위치는 `docs/ARCHITECTURE.md` 참고.

## 온톨로지 엔지니어로서 하는 일
| 하고 싶은 것 | 고칠 곳 | 반영 |
|---|---|---|
| 무엇이 더 중요한지 (유형 배수, 점수 숫자) | `src/ontology/world.ts` | GitHub push → 다음 실행의 메인 순위. `/ontology` 표시는 Vercel 배포 후 |
| 지켜볼 큰 흐름 추가·변경 | `src/ontology/world.ts`의 `FLOWS` | 위와 같음. 새 사건부터 적용 |
| 사건 유형 추가·변경 | `src/ontology/world.ts`의 `EVENT_TYPES` | 위와 같음. 새 사건부터 적용 |
| 매체의 본사 나라 | `src/ontology/outlets.ts` | 위와 같음 |
| 규칙 자체를 바꾸기 (연관, 합치기 등) | `src/lib/ontology/rules.ts` (테스트 먼저) | 위와 같음 |

**공부하는 순서**
1. `/ontology`의 규칙 실험에서 배수를 바꿔 본다. 저장되지 않으니 마음껏 해도 된다.
2. 마음에 드는 값을 `world.ts`에 옮긴다.
3. 관계를 직접 물어본다: `npm run query -- "select dst, count(*) from links where type = 'part_of' group by dst"`
4. 설계 설명은 `docs/ONTOLOGY.md`에서 읽는다.

## 개발자로서 하는 일
```bash
npm run dev                 # 로컬 화면 (.env.local 필요)
npm run lint && npm run build && npm run test   # 올리기 전 확인
git push                    # 파이프라인은 다음 실행부터 반영
npx vercel deploy --prod --yes   # 사이트 반영 (자동 배포 미연결)
```
새 기능은 `intent/`에 먼저 적고 테스트부터 작성한다 (`CLAUDE.md`). DB 변경은 `supabase/migrations/`에 추가한다.

## 다음 단계
진행 상황과 남은 일은 `docs/PROGRESS.md`. 다음은 2단계 분석(어제 대비 변화, 나라 간 관심, 관계 온도)이다.
