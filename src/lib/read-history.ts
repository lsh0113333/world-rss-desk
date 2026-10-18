import { CATEGORIES } from "./constants";
import type { ReadEvent } from "./recommend";

/**
 * 읽은 기사 기록 저장소. LayoutRepository와 같은 이유로 인터페이스 뒤에 둔다 (나중에 기기 간 동기화로 교체).
 */
export interface ReadHistoryRepository {
  load(): Promise<string[]>;
  save(ids: string[]): Promise<void>;
  /** 개인화 추천용 기록 (매체·나라·분야·키워드). 브라우저 밖으로 나가지 않는다 */
  loadEvents(): Promise<ReadEvent[]>;
  saveEvents(events: ReadEvent[]): Promise<void>;
}

export const READ_KEY = "world-rss-desk:read";
export const READ_EVENTS_KEY = "world-rss-desk:read-events";
/** 오래된 것부터 버린다. 기사 id는 짧아서 3천 개여도 수십 KB */
export const MAX_READ_IDS = 3000;

export function addRead(ids: string[], id: string): string[] {
  const next = ids.filter((x) => x !== id);
  next.push(id);
  return next.length > MAX_READ_IDS ? next.slice(next.length - MAX_READ_IDS) : next;
}

const categoryIds = new Set<string>(CATEGORIES.map((c) => c.id));

function validEvent(raw: unknown): ReadEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  if (typeof e.id !== "string" || typeof e.at !== "string" || typeof e.source !== "string") return null;
  if (!Array.isArray(e.terms) || !e.terms.every((t) => typeof t === "string")) return null;
  return {
    id: e.id,
    at: e.at,
    source: e.source,
    ...(typeof e.country === "string" ? { country: e.country } : {}),
    ...(typeof e.category === "string" && categoryIds.has(e.category) ? { category: e.category as ReadEvent["category"] } : {}),
    terms: e.terms as string[],
  };
}

type KeyValueStorage = Pick<Storage, "getItem" | "setItem">;

export class LocalStorageReadHistoryRepository implements ReadHistoryRepository {
  constructor(private readonly storage?: KeyValueStorage) {}

  private get store(): KeyValueStorage {
    return this.storage ?? window.localStorage;
  }

  async load(): Promise<string[]> {
    try {
      const raw: unknown = JSON.parse(this.store.getItem(READ_KEY) ?? "[]");
      return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
    } catch {
      return [];
    }
  }

  async save(ids: string[]): Promise<void> {
    try {
      this.store.setItem(READ_KEY, JSON.stringify(ids));
    } catch {
      // 저장 실패는 무시 (사생활 보호 모드 등)
    }
  }

  async loadEvents(): Promise<ReadEvent[]> {
    try {
      const raw: unknown = JSON.parse(this.store.getItem(READ_EVENTS_KEY) ?? "[]");
      return Array.isArray(raw) ? raw.map(validEvent).filter((e): e is ReadEvent => e !== null) : [];
    } catch {
      return [];
    }
  }

  async saveEvents(events: ReadEvent[]): Promise<void> {
    try {
      this.store.setItem(READ_EVENTS_KEY, JSON.stringify(events));
    } catch {
      // 위와 같음
    }
  }
}
