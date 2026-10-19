/**
 * 기사 제목 → 키워드. "같은 소식 묶기"·"오늘의 이슈"·"추천"이 공통으로 쓴다.
 * 형태소 분석 없이 규칙 기반 (무료·브라우저 안). 한국어·영어를 같은 이슈로 묶는 일은 2차(AI)의 몫.
 */

export interface Token {
  /** 비교용 소문자 키 */
  key: string;
  /** 화면 표시용 원래 표기 */
  display: string;
}

// 영어 헤드라인에서 의미 없이 자주 나오는 단어 (불용어 + 뉴스 상투어)
const EN_STOP = new Set(
  `a about above after again against all also amid an and any are as at be because been before being below between both but by
can could did do does doing down during each few for from further had has have having he her here hers him his how i if in into is it
its just me more most my no nor not now of off on once only or other our out over own same she should so some such than that the their
them then there these they this those through to too under until up very was we were what when where which while who whom why will with
would you your new news says said say live update updates latest video watch photos photo first last next year years week weeks day days
today tonight yesterday tomorrow report reports know far amid get gets got make makes made back still may might must one two three
four five six seven eight nine ten man woman people time times us via vs top look inside here's what's it's dont don't won't can't
year's more than less many much former new world's want wants call calls set sets take takes give gives go goes come comes
keep keeps put puts see sees seen tell tells told show shows use used help helps begin begins start starts end ends
monday tuesday wednesday thursday friday saturday sunday roundup podcast opinion analysis explainer editorial newsletter briefing`.split(/\s+/),
);

// 한국어 헤드라인 상투어
const KO_STOP = new Set(
  `속보 단독 종합 사진 영상 기자 뉴스 오늘 내일 어제 이번 지난 올해 작년 내년 관련 대한 위해 통해 따라 이후 이전 현재 최근 가장 모두 있다 없다
  했다 한다 된다 됐다 이다 위한 대해 대한민국의 그리고 하지만 그러나 또는 등의 경우 정도 이상 이하 미만 만에 때문 가운데 포토 인터뷰 칼럼 사설 오피니언`.split(/\s+/),
);

// 한국어 조사·어미 (긴 것부터 확인)
const KO_SUFFIXES = [
  "했다", "한다", "된다", "됐다", "했던", "하는", "하고", "하며", "에서는", "에서", "으로는", "으로", "에게", "까지", "부터", "보다",
  "처럼", "이다", "와의", "과의", "에는", "에도", "로는", "은", "는", "이", "가", "을", "를", "의", "에", "로", "와", "과", "도", "만",
].sort((a, b) => b.length - a.length);

const HANGUL = /[가-힣]/;
const WORD = /[\p{L}\p{N}][\p{L}\p{N}'’.-]*/gu;

function stripKorean(word: string): string {
  if (word.length < 3) return word;
  for (const suffix of KO_SUFFIXES) {
    if (word.endsWith(suffix) && word.length - suffix.length >= 2) return word.slice(0, -suffix.length);
  }
  return word;
}

/** 제목을 키워드 토큰으로 (순서 유지, 중복 포함) */
export function tokenize(title: string): Token[] {
  const tokens: Token[] = [];
  for (const match of title.matchAll(WORD)) {
    let word = match[0].replace(/['’]s$/i, "").replace(/[.'’-]+$/, "");
    if (!word || /^\d/.test(word)) continue;

    if (HANGUL.test(word)) {
      word = stripKorean(word);
      if (word.length < 2 || KO_STOP.has(word)) continue;
      tokens.push({ key: word, display: word });
      continue;
    }

    const key = word.toLowerCase();
    if (EN_STOP.has(key)) continue;
    // 두 글자는 대문자 약어(EU, UN, AI)만
    if (word.length < 3 && !(word.length === 2 && word === word.toUpperCase())) continue;
    tokens.push({ key, display: word });
  }
  return tokens;
}

/** 제목의 키워드 키 (중복 제거, 순서 유지) */
export function extractTerms(title: string): string[] {
  return [...new Set(tokenize(title).map((t) => t.key))];
}
