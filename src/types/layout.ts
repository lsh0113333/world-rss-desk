import type { Category, CountryCode } from "./catalog";

/** 패널 보기 방식: 카드(톱 기사 큰 사진) / 목록(작은 썸네일, 기본) / 텍스트 */
export type PanelView = "card" | "list" | "text";

export interface Panel {
  id: string;
  /** 없으면 panelTitle(country, category)로 자동 생성 */
  title?: string;
  country?: CountryCode;
  category?: Category;
  feedIds: string[];
  customUrls: string[];
  /** 키워드 패널: 구글 뉴스 검색어 (피드 수 제한에 1개로 계산) */
  query?: string;
  /** 5~30, 기본 10 */
  limit: number;
  /** ISO. 이 시각 이후 발행된 기사를 '새 기사'로 강조 */
  lastSeenAt?: string;
  /** 없으면 "list" */
  view?: PanelView;
  /** 그리드에서 2칸 차지 */
  wide?: boolean;
  /** 소속 보드. 없으면 첫 번째 보드 */
  boardId?: string;
}

/** 보드 보기: 패널 그리드(기본) / 헤드라인 벽(국기+제목만 여러 열) / 세계 흐름(사건 카드+지도, 파이프라인 결과) */
export type BoardView = "panels" | "wall" | "world";

/** 보드(탭): 패널 묶음. 예: 아침 브리핑, 경제, 테크 */
export interface Board {
  id: string;
  name: string;
  /** 없으면 "panels" */
  view?: BoardView;
}

export interface Layout {
  version: 1;
  panels: Panel[];
  /** 없으면 보드 하나("내 화면")만 있는 것으로 본다 */
  boards?: Board[];
  activeBoardId?: string;
  /** 키워드 워치: 모든 패널에서 강조할 관심 키워드 */
  watchKeywords?: string[];
}
