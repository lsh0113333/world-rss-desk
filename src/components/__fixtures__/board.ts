import { buildBoard } from "@/lib/ontology/rules";
import type { BoardActor, BoardArticle, EventFact, WorldBoard } from "@/types/world";

/** 화면 테스트용 상황판: 실제 규칙으로 계산한다 */

const minutesAgo = (m: number, now: Date) => new Date(now.getTime() - m * 60_000).toISOString();
const actor = (id: string, nameKo: string, kind: BoardActor["kind"], role: BoardActor["role"]): BoardActor => ({ id, name: nameKo, nameKo, kind, role });

export function boardFixture(now = new Date()): WorldBoard {
  let seq = 0;
  const art = (country: string, source: string, minutes = 400): BoardArticle => {
    seq++;
    return { id: `a${seq}`, title: `원문 제목 ${seq}`, link: `https://news.example/${seq}`, source, country, publishedAt: minutesAgo(minutes, now) };
  };
  const fact = (id: string, over: Partial<EventFact> & Pick<EventFact, "type" | "title" | "articles">): EventFact => ({
    id,
    summary: `${over.title} 요약 문장.`,
    flow: null,
    actors: [],
    occurs: [],
    firstSeenAt: minutesAgo(600, now),
    ...over,
  });

  return buildBoard(
    [
      fact("event:war", {
        type: "armed-conflict",
        title: "흑해에서 화물선 침몰",
        flow: "ukraine",
        occurs: ["UA"],
        actors: [actor("country:RU", "러시아", "country", "subject"), actor("country:UA", "우크라이나", "country", "target")],
        articles: [art("GB", "BBC"), art("US", "CNN"), art("KR", "연합뉴스"), art("JP", "NHK")],
        firstSeenAt: minutesAgo(30, now),
      }),
      fact("event:talks", {
        type: "diplomacy",
        title: "올레슈키 국지 휴전 합의",
        flow: "ukraine",
        occurs: ["RU"],
        articles: [art("GB", "Guardian"), art("US", "NYT")],
      }),
      fact("event:ai", {
        type: "tech",
        title: "중국 첫 AI 영화 개봉",
        flow: "ai-race",
        occurs: ["CN"],
        actors: [actor("actor:org:moonshot", "문샷", "org", "subject")],
        articles: [art("CN", "SCMP", 30), art("SG", "CNA", 40), art("US", "WIRED", 50)],
      }),
      fact("event:hack", {
        type: "tech",
        title: "대한항공 예약시스템 해킹",
        flow: "cyber",
        occurs: ["KR"],
        articles: [art("KR", "전자신문"), art("KR", "한국경제")],
      }),
      fact("event:kr", {
        type: "politics",
        title: "국회 예산안 통과",
        occurs: ["KR"],
        articles: [art("KR", "연합뉴스"), art("KR", "조선일보")],
      }),
      fact("event:sports", {
        type: "sports",
        title: "뮌헨 감독 병원 이송",
        occurs: ["DE"],
        articles: [art("DE", "DW"), art("GB", "BBC"), art("FR", "France24"), art("US", "ESPN"), art("KR", "연합뉴스"), art("JP", "NHK")],
      }),
    ],
    now,
    { articles: 6700, clusters: 109, feedsOk: 260, feedsFailed: 4, extracted: 12, ontology: { objects: { event: 78, actor: 120, country: 190 }, links: { reports: 900, subject: 80 }, madeBy: { ai: 700, rule: 300, config: 400 } } },
  );
}
