/**
 * 읽은 기사 기록 저장소. LayoutRepository와 같은 이유로 인터페이스 뒤에 둔다 (나중에 기기 간 동기화로 교체).
 */
export interface ReadHistoryRepository {
  load(): Promise<string[]>;
  save(ids: string[]): Promise<void>;
}

export const READ_KEY = "world-rss-desk:read";
/** 오래된 것부터 버린다. 기사 id는 짧아서 3천 개여도 수십 KB */
export const MAX_READ_IDS = 3000;

export function addRead(ids: string[], id: string): string[] {
  const next = ids.filter((x) => x !== id);
  next.push(id);
  return next.length > MAX_READ_IDS ? next.slice(next.length - MAX_READ_IDS) : next;
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
}
