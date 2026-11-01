import { parseMultipliers, type Multipliers } from "./ontology/rules";

/**
 * 사용자 데이터: 방문 기록("지난 방문 이후 새 사건")과 내 기준(유형 배수).
 * 인터페이스 뒤에 두어 나중에 계정 저장으로 바꿀 수 있게 한다.
 */

export interface VisitState {
  lastVisitAt: string | null;
  /** "새 사건" 비교 기준 */
  previousVisitAt: string | null;
}

export interface BoardPrefsRepository {
  load(): Promise<VisitState>;
  save(state: VisitState): Promise<void>;
  /** 내 기준. 없으면 null (기본 기준) */
  loadRules(): Promise<Multipliers | null>;
  /** null이면 내 기준을 지운다 */
  saveRules(rules: Multipliers | null): Promise<void>;
}

export const BOARD_PREFS_KEY = "world-rss-desk:visits";
export const BOARD_RULES_KEY = "world-rss-desk:rules";
/** 이 시간 안에 다시 열면 같은 방문으로 본다 (새로고침해도 "새" 표시가 사라지지 않게) */
const SAME_VISIT_MS = 30 * 60_000;

const EMPTY: VisitState = { lastVisitAt: null, previousVisitAt: null };

export function advanceVisit(state: VisitState, now: Date): VisitState {
  if (!state.lastVisitAt) return { lastVisitAt: now.toISOString(), previousVisitAt: null };
  if (now.getTime() - Date.parse(state.lastVisitAt) < SAME_VISIT_MS) return state;
  return { lastVisitAt: now.toISOString(), previousVisitAt: state.lastVisitAt };
}

export function isNewSince(firstSeenAt: string, since: string | null): boolean {
  return !!since && Date.parse(firstSeenAt) > Date.parse(since);
}

type KeyValueStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export class LocalStorageBoardPrefsRepository implements BoardPrefsRepository {
  constructor(private readonly storage?: KeyValueStorage) {}

  private get store(): KeyValueStorage {
    return this.storage ?? window.localStorage;
  }

  async load(): Promise<VisitState> {
    try {
      const raw = JSON.parse(this.store.getItem(BOARD_PREFS_KEY) ?? "{}") as Record<string, unknown>;
      return {
        lastVisitAt: typeof raw.lastVisitAt === "string" ? raw.lastVisitAt : null,
        previousVisitAt: typeof raw.previousVisitAt === "string" ? raw.previousVisitAt : null,
      };
    } catch {
      return EMPTY;
    }
  }

  async save(state: VisitState): Promise<void> {
    try {
      this.store.setItem(BOARD_PREFS_KEY, JSON.stringify(state));
    } catch {
      // 저장 실패는 무시 (사생활 보호 모드 등)
    }
  }

  async loadRules(): Promise<Multipliers | null> {
    try {
      return parseMultipliers(JSON.parse(this.store.getItem(BOARD_RULES_KEY) ?? "null"));
    } catch {
      return null;
    }
  }

  async saveRules(rules: Multipliers | null): Promise<void> {
    try {
      if (rules) this.store.setItem(BOARD_RULES_KEY, JSON.stringify(rules));
      else this.store.removeItem(BOARD_RULES_KEY);
    } catch {
      // 저장 실패는 무시 (사생활 보호 모드 등)
    }
  }
}
