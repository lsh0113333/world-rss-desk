import type { Continent } from "@/types/catalog";
import { NEWSSTAND_CONTINENTS } from "./newsstand";

/**
 * 가판대 화면 설정 저장소 (접은 대륙). LayoutRepository와 같은 이유로 인터페이스 뒤에 둔다.
 */
export interface NewsstandPrefs {
  folded: Continent[];
}

export interface NewsstandPrefsRepository {
  load(): Promise<NewsstandPrefs>;
  save(prefs: NewsstandPrefs): Promise<void>;
}

export const NEWSSTAND_PREFS_KEY = "world-rss-desk:newsstand";

const continentIds = new Set<string>(NEWSSTAND_CONTINENTS.map((c) => c.id));

type KeyValueStorage = Pick<Storage, "getItem" | "setItem">;

export class LocalStorageNewsstandPrefsRepository implements NewsstandPrefsRepository {
  constructor(private readonly storage?: KeyValueStorage) {}

  private get store(): KeyValueStorage {
    return this.storage ?? window.localStorage;
  }

  async load(): Promise<NewsstandPrefs> {
    try {
      const raw = JSON.parse(this.store.getItem(NEWSSTAND_PREFS_KEY) ?? "{}") as { folded?: unknown };
      const folded = Array.isArray(raw.folded) ? raw.folded.filter((x): x is Continent => typeof x === "string" && continentIds.has(x)) : [];
      return { folded };
    } catch {
      return { folded: [] };
    }
  }

  async save(prefs: NewsstandPrefs): Promise<void> {
    try {
      this.store.setItem(NEWSSTAND_PREFS_KEY, JSON.stringify(prefs));
    } catch {
      // 저장 실패는 무시 (사생활 보호 모드 등)
    }
  }
}
