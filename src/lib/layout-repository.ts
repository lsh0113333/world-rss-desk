import type { Layout } from "@/types/layout";
import { migrate } from "./layout-store";

/**
 * 사용자 설정 저장소. 컴포넌트와 훅은 이 인터페이스만 사용한다 (ADR-009).
 * MVP는 localStorage 구현체 하나. 계정 동기화 단계에서 원격 구현체로 교체한다.
 */
export interface LayoutRepository {
  /** 저장된 레이아웃. 없거나 손상됐으면 null */
  load(): Promise<Layout | null>;
  save(layout: Layout): Promise<void>;
}

export const LAYOUT_KEY = "world-rss-desk:layout";
export const BACKUP_KEY = "world-rss-desk:layout-backup";

type KeyValueStorage = Pick<Storage, "getItem" | "setItem">;

export class LocalStorageLayoutRepository implements LayoutRepository {
  constructor(private readonly storage?: KeyValueStorage) {}

  private get store(): KeyValueStorage {
    return this.storage ?? window.localStorage;
  }

  async load(): Promise<Layout | null> {
    let raw: string | null;
    try {
      raw = this.store.getItem(LAYOUT_KEY);
    } catch {
      return null;
    }
    if (raw === null) return null;

    let layout: Layout | null = null;
    try {
      layout = migrate(JSON.parse(raw));
    } catch {
      layout = null;
    }
    if (!layout) this.backup(raw);
    return layout;
  }

  async save(layout: Layout): Promise<void> {
    try {
      this.store.setItem(LAYOUT_KEY, JSON.stringify(layout));
    } catch {
      // 사생활 보호 모드·용량 초과: 저장은 못 하지만 화면은 계속 동작해야 한다
    }
  }

  private backup(raw: string) {
    try {
      this.store.setItem(BACKUP_KEY, raw);
    } catch {
      // 백업 실패는 무시
    }
  }
}
