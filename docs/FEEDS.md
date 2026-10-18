# RSS 수집 기준과 현황

어떤 기준으로 매체를 골랐는지, 지금 어디까지 넣었는지, 무엇을 왜 뺐는지, 더 넣으려면 어떻게 하는지 정리한다.
(2026-10-18 기준. 카탈로그 원본: `src/data/catalog.json`)

## 1. 용어

| 용어 | 뜻 | 예 |
|------|----|----|
| **매체** | 언론사 하나 | BBC News |
| **피드** | 그 매체가 공개한 RSS 주소 하나. 보통 **섹션마다 따로** 있다 | BBC의 `world/rss.xml`, `business/rss.xml` … |
| **분야** | 이 앱의 분류 11개 | 종합·국제·정치·경제·사회·IT·과학·건강·환경/기후·문화/연예·스포츠 |

패널의 매체 칩은 **그 패널의 나라·분야에 맞는 피드만** 보여준다.

## 2. 현재 수록 현황 — 나라·지역 55개, 매체 144개, 피드 270개

| 지역 | 매체 (피드 수: 수록 분야) |
|------|--------------------------|
| 🇰🇷 한국 | 연합뉴스 (7: 종합·정치·경제·국제·사회·문화·스포츠), 한국경제 (7: 종합·정치·경제·IT·국제·사회·스포츠), 매일경제 (3: 종합·경제·국제), 전자신문 (1: IT), 조선일보 (5: 종합·정치·경제·사회·국제), 동아일보 (7: 종합·정치·경제·국제·문화·스포츠·과학), 경향신문 (4: 종합·정치·경제·사회), SBS 뉴스 (6: 정치·경제·사회·국제·문화·스포츠) |
| 🇯🇵 일본 | The Japan Times (1: 종합), The Mainichi (1: 종합), Nikkei Asia (1: 경제) |
| 🇨🇳 중국 | South China Morning Post (3: 종합·경제·IT), CGTN (3: 종합·경제·과학) |
| 🇮🇳 인도 | The Times of India (2: 종합·경제), The Hindu (3: 종합·경제·IT), The Economic Times (2: 경제·IT) |
| 🇻🇳 베트남 | VnExpress International (2: 종합·경제) |
| 🇸🇬 싱가포르 | CNA (2: 종합·경제), The Straits Times (2: 종합·경제) |
| 🇹🇼 대만 | Taipei Times (1: 종합) |
| 🇵🇭 필리핀 | Inquirer (1: 종합), Rappler (1: 종합) |
| 🇹🇭 태국 | Bangkok Post (1: 종합) |
| 🌏 아시아 | CNA (1: 종합), The Straits Times (1: 종합), BBC News (1: 종합) |
| 🇺🇸 미국 | The New York Times (8: 종합·정치·경제·IT·과학·건강·문화·환경), NPR (7: 종합·정치·경제·IT·과학·문화·건강), CNBC (3: 종합·경제·IT), TechCrunch (1: IT), The Verge (1: IT), ESPN (1: 스포츠), Engadget (1: IT), ZDNET (1: IT), BleepingComputer (1: IT), TechSpot (1: IT), 9to5Mac (1: IT), Android Authority (1: IT) |
| 🇨🇦 캐나다 | CBC News (7: 종합·정치·경제·IT·건강·문화·스포츠), Global News (1: 종합) |
| 🇬🇧 영국 | BBC News (7: 종합·정치·경제·IT·과학·건강·문화), The Guardian (10: 종합·정치·경제·IT·과학·사회·건강·환경·문화·스포츠), BBC Sport (1: 스포츠), The Register (1: IT), Computer Weekly (1: IT), TechRadar (1: IT) |
| 🇩🇪 독일 | DW (2: 종합·경제), DER SPIEGEL International (1: 종합), The Local Germany (1: 종합) |
| 🇫🇷 프랑스 | Le Monde (1: 종합), France 24 (2: 국제·경제), RFI (1: 종합), The Local France (1: 종합) |
| 🇪🇸 스페인 | EL PAÍS English (1: 종합), The Local Spain (1: 종합) |
| 🇮🇹 이탈리아 | ANSA English (1: 종합), The Local Italy (1: 종합) |
| 🇺🇦 우크라이나 | The Kyiv Independent (1: 종합), Ukrainska Pravda (1: 종합) |
| 🇷🇺 러시아 | The Moscow Times (1: 종합), Meduza (1: 종합), TASS (1: 종합) |
| 🇹🇷 튀르키예 | Turkish Minute (1: 종합) |
| 🇮🇪 아일랜드 | RTÉ News (6: 종합·정치·경제·국제·IT·건강), RTÉ (1: 문화), RTÉ Sport (1: 스포츠), The Irish Times (9: 종합·사회·정치·경제·국제·IT·건강·문화·스포츠), Irish Independent (5: 종합·사회·경제·IT·스포츠), TheJournal.ie (1: 종합), Irish Examiner (1: 종합), Silicon Republic (1: IT), TechCentral.ie (1: IT) |
| 🇳🇱 네덜란드 | DutchNews.nl (2: 종합·경제) |
| 🇨🇭 스위스 | The Local Switzerland (1: 종합) |
| 🇦🇹 오스트리아 | The Local Austria (1: 종합) |
| 🇵🇹 포르투갈 | The Portugal News (1: 종합), Portugal Resident (1: 종합) |
| 🇬🇷 그리스 | Kathimerini English (1: 종합) |
| 🇳🇴 노르웨이 | The Local Norway (1: 종합), News in English (2: 종합·경제), Life in Norway (1: 문화) |
| 🇸🇪 스웨덴 | The Local Sweden (1: 종합), Radio Sweden (1: 종합) |
| 🇩🇰 덴마크 | The Local Denmark (1: 종합), The Copenhagen Post (1: 종합) |
| 🇫🇮 핀란드 | Yle News (1: 종합), Helsinki Times (1: 종합) |
| 🇮🇸 아이슬란드 | RÚV English (1: 종합), Reykjavik Grapevine (1: 문화) |
| 🇵🇱 폴란드 | Notes from Poland (1: 종합) |
| 🇨🇿 체코 | Prague Morning (1: 종합) |
| 🇭🇺 헝가리 | Hungary Today (1: 종합) |
| 🇪🇪 에스토니아 | ERR News (2: 종합·경제) |
| 🇱🇹 리투아니아 | LRT English (1: 종합) |
| 🇪🇺 유럽 | Euronews (1: 종합), DW (1: 종합), The Guardian (1: 종합), France 24 (1: 종합), Politico Europe (1: 정치), POLITICO Europe (2: IT·환경), EUobserver (1: 정치), Balkan Insight (1: 국제), Sifted (1: IT), Tech.eu (1: IT), EU-Startups (1: IT), The Next Web (1: IT) |
| 🌍 중동 | Al Jazeera (1: 종합), Middle East Eye (1: 종합), Arab News (1: 종합), Al-Monitor (1: 종합) |
| 🇮🇱 이스라엘 | The Jerusalem Post (1: 종합), Haaretz (1: 종합) |
| 🇮🇷 이란 | Iran International (1: 종합), Tehran Times (1: 종합) |
| 🇦🇪 아랍에미리트 | The National (7: 종합·사회·국제·경제·IT·문화·스포츠), Khaleej Times (5: 종합·사회·경제·국제·스포츠), Gulf News (1: 종합) |
| 🇸🇦 사우디아라비아 | Saudi Gazette (1: 종합), Asharq Al-Awsat (1: 종합) |
| 🇶🇦 카타르 | Doha News (1: 종합) |
| 🇧🇷 브라질 | Agência Brasil (1: 종합), The Rio Times (1: 종합) |
| 🇲🇽 멕시코 | Mexico News Daily (1: 종합) |
| 🇦🇷 아르헨티나 | Buenos Aires Times (1: 종합) |
| 🌎 중남미 | MercoPress (1: 종합), BBC News (1: 종합) |
| 🇿🇦 남아공 | Daily Maverick (1: 종합) |
| 🇳🇬 나이지리아 | Premium Times (1: 종합), Punch (1: 종합), Vanguard (1: 종합) |
| 🇰🇪 케냐 | Nation (1: 종합), The Standard (1: 종합) |
| 🇪🇬 이집트 | Egypt Independent (1: 종합) |
| 🌍 아프리카 | BBC News (1: 종합), AllAfrica (1: 종합) |
| 🇦🇺 호주 | ABC News (2: 종합·경제), The Sydney Morning Herald (1: 종합), The Guardian Australia (1: 종합) |
| 🇳🇿 뉴질랜드 | RNZ (1: 종합), NZ Herald (1: 종합) |
| 🌐 국제 | BBC News (1: 국제), The Guardian (1: 국제), The New York Times (1: 국제), South China Morning Post (1: 국제), UN News (1: 국제), DW (1: 국제), WIRED (1: IT), Ars Technica (1: IT), MIT Technology Review (1: IT), Phys.org (1: 과학), Science News (1: 과학), ScienceDaily (1: 과학), Hacker News (1: IT), The Hacker News (1: IT), InfoQ (1: IT), Rest of World (1: IT), IEEE Spectrum (1: IT) |

- 2026-10-17: 78 → 177개 (분야 6→11개, 나라 13→36개)
- 2026-10-18: 177 → 270개 — 노르웨이·북유럽·아일랜드·유럽 각국, 유럽·국제 IT, UAE·사우디·카타르 (**영어판만**, `intent/2026-10-18-rss-expansion-2.md`)

## 3. 수록 기준

카탈로그에 넣으려면 **모두** 만족해야 한다.

1. **언론사가 공식으로 공개한 RSS/Atom** 주소일 것 (사이트를 긁어서 만든 피드는 쓰지 않음)
2. **무료, 로그인 불필요**
3. **실제 접속 성공**: 내 PC(`npm run feeds:check`)와 **Vercel 서버**(배포 후 `/api/feeds?fresh=1&ids=…`) 양쪽에서
4. **살아 있는 피드**: 최신 기사가 72시간 이내
5. **기사에 발행 시각이 있을 것** (정렬·72시간 필터에 필요. 예외: Nikkei Asia — 대체 매체가 없어 수록)
6. 11개 분야 중 하나에 **명확히 대응**할 것
7. 해외 매체는 **영어판만** (현지어 + 제목 번역은 2차 AI 때 검토). 북유럽처럼 영어판이 적은 곳은 The Local·News in English·Yle News 같은 영어 매체로 채운다
8. 국영·관영 매체는 넣되 `note`로 표시 (CGTN "중국 정부 시각", TASS "러시아 정부 시각", Tehran Times "이란 정부 시각")

## 4. 확인했지만 뺀 것

| 후보 | 이유 |
|------|------|
| NHK World (영어) | RSS 폐지 (404). 일본어 NHK RSS는 갱신 안 됨 |
| Japan Today | 집에서는 되지만 **Vercel 서버 IP를 차단** (403) |
| The Japan Times 섹션 피드 | 403 / 404 (메인 피드만 수록) |
| Yomiuri (Japan News) | 봇 확인 페이지(202) |
| Kyodo News | RSS 없음 (404) |
| Global Times | 최신 기사가 8일 전 — 사실상 중단 |
| China Daily, Caixin | 404 / 403 |
| Times of Israel | 403 |
| 매일경제 정치 | 54시간째 갱신 없음 |
| France 24 프랑스 섹션 | 5일째 갱신 없음 |
| DW 과학 | 기사 0개 |
| NYT 스포츠 | 기사 0개 (폐지된 듯) |
| Reuters, AP | 공개 RSS 없음 |
| 한겨레 | 기사에 날짜 없음 + 재배포 금지 명시 |
| Nature | 쿠키·로그인 리다이렉트 |
| JTBC | 갱신 중단 |
| Washington Post | 502 |
| 동아일보 사회 | 기사 0개 |
| Tuoi Tre, Jakarta Post, Focus Taiwan, Mail & Guardian | 404 |
| Tempo, Ahram Online | 403 |
| Taiwan News, Hürriyet Daily News, Daily Sabah | 기사 0개 |
| News24 | 연결 실패 |
| New Scientist | 406 |
| Antara | 시간 초과 |
| **2차 확대(2026-10-18)에서 뺀 것** | |
| NRK, VG, SVT, heise 등 | 현지어(노르웨이어·스웨덴어·독일어) — 영어판만 수록 원칙 |
| News of Bahrain, The New Arab | 집에서는 되지만 Vercel 서버 IP 차단 (403) |
| Arabian Business, AGBI | 이 앱의 요청을 차단 (403 / 405) |
| Al Arabiya English, Jordan Times, L'Orient Today, Gulf Business, Gulf Today, Iceland Review, Euractiv | 403 |
| Swissinfo | RSS 폐지 (410) |
| Brussels Times, The Peninsula, Qatar Tribune, WAM, SPA | 피드에 기사 0개 |
| NL Times, Wamda | 기사에 날짜 없음 |
| MENAbytes | 1년 넘게 갱신 없음 |
| Saudi Gazette 섹션 피드 | 대부분 0개이거나 수주~수년 전 기사 (메인 피드만 수록) |
| Gulf News 섹션, Khaleej Times IT | 404 (메인·다른 섹션만 수록) |
| Breaking News.ie | 410, Business Post 0개 |
| The Barents Observer, High North News, Science Norway, TVP World, Radio Prague | 404 |
| Romania Insider, VentureBeat | 429 (요청 제한) |
| Hacker News 공식 RSS | 차단(419) → hnrss.org 미러 사용 |

## 5. RSS를 더 가져오는 방법 (모두 구현됨)

| 방법 | 쓰는 곳 | 비고 |
|------|---------|------|
| **카탈로그** (이 문서) | 빠른 추가·편집기·명령창 | 직접 검증한 피드 |
| **사이트 주소로 RSS 찾기** | 패널 편집 → "RSS 또는 사이트 주소" | 홈페이지의 `<link rel="alternate">`·흔한 경로를 찾아 목록으로. 카탈로그 매체면 카탈로그 피드로 추가 (홈페이지가 너무 크거나 막혀도 카탈로그 매체는 제안) |
| **키워드 패널 (구글 뉴스)** | 빠른 추가의 키워드 칸, 명령창 마지막 줄, 편집기 "키워드" | 최근 2일 기사. 한글이 있으면 한국어판, 없으면 미국 영어판. 링크가 구글 경유라 원문 보기는 대부분 "새 탭에서 열기". 구글 뉴스 RSS 약관상 개인 리더 용도만 |
| **RSS 주소 직접** | 같은 "RSS 또는 사이트 주소" 칸에 RSS 주소를 넣으면 그대로 | |

## 6. 점검과 유지보수

```bash
npm run feeds:check          # 카탈로그 전체를 내 PC에서 받아 OK / STALE / FAIL 표시
```
- **자동 점검**: 매일 06:00(KST) Vercel cron이 `/api/feed-health`를 호출해 전체를 다시 점검한다(결과 24시간 캐시). 앱의 설정(⋯) → **피드 상태**에서 실패·오래된 피드를 본다.
- 배포 서버에서 하나만 확인: `https://world-rss-desk.vercel.app/api/feeds?fresh=1&ids=<피드 id>` → `errors`가 비어야 정상
- 피드 id는 `{나라}-{매체}-{분야}` 형식이며, **사용자 설정이 참조하므로 한번 정하면 바꾸지 않는다.** 피드를 빼면 해당 패널에 "더 이상 제공되지 않는 매체"로 표시된다.
