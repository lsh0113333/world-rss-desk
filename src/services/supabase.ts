/**
 * Supabase(PostgREST) 최소 클라이언트. 의존성 없이 fetch만 쓴다.
 * 쓰기 키(secret)는 GitHub Actions 파이프라인에서만, 화면 API는 읽기 전용 publishable 키를 쓴다.
 */

const PAGE = 1000;
const UPSERT_BATCH = 500;
const TIMEOUT_MS = 15_000;

export interface Db {
  select<T>(table: string, query: string, opts?: { all?: boolean }): Promise<T[]>;
  upsert(table: string, rows: object[], opts?: { onConflict?: string; ignoreDuplicates?: boolean }): Promise<void>;
  insert<T>(table: string, row: object): Promise<T>;
  update(table: string, filter: string, patch: object): Promise<void>;
  remove(table: string, filter: string): Promise<void>;
}

export interface DbConfig {
  url: string;
  key: string;
  fetch?: typeof fetch;
}

export function createDb({ url, key, fetch: fetchImpl = fetch }: DbConfig): Db {
  const base = `${url.replace(/\/+$/, "")}/rest/v1`;

  async function request(table: string, path: string, init: RequestInit & { headers?: Record<string, string> }) {
    const res = await fetchImpl(`${base}/${path}`, {
      ...init,
      headers: { apikey: key, "Content-Type": "application/json", ...init.headers },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Supabase ${table} ${res.status}: ${text.slice(0, 300)}`);
    }
    return res;
  }

  const withQuery = (table: string, query: string) => (query ? `${table}?${query}` : table);

  return {
    async select<T>(table: string, query: string, opts: { all?: boolean } = {}) {
      if (!opts.all) return (await (await request(table, withQuery(table, query), {})).json()) as T[];
      const rows: T[] = [];
      for (let from = 0; ; from += PAGE) {
        const res = await request(table, withQuery(table, query), {
          headers: { "Range-Unit": "items", Range: `${from}-${from + PAGE - 1}` },
        });
        const page = (await res.json()) as T[];
        rows.push(...page);
        if (page.length < PAGE) return rows;
      }
    },

    async upsert(table, rows, opts = {}) {
      const path = opts.onConflict ? `${table}?on_conflict=${opts.onConflict}` : table;
      const resolution = opts.ignoreDuplicates ? "ignore-duplicates" : "merge-duplicates";
      for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
        await request(table, path, {
          method: "POST",
          headers: { Prefer: `resolution=${resolution},return=minimal` },
          body: JSON.stringify(rows.slice(i, i + UPSERT_BATCH)),
        });
      }
    },

    async insert<T>(table: string, row: object) {
      const res = await request(table, table, {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(row),
      });
      const [inserted] = (await res.json()) as T[];
      return inserted;
    },

    async update(table, filter, patch) {
      await request(table, withQuery(table, filter), {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(patch),
      });
    },

    async remove(table, filter) {
      await request(table, withQuery(table, filter), { method: "DELETE" });
    },
  };
}
