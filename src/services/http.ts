import { FeedFetchError } from "@/lib/errors";

/** 'Mozilla/5.0'만 보내면 봇 위장으로 보고 차단하는 매체가 있어 리더임을 밝힌다 */
export const USER_AGENT = "WorldRSSDesk/0.1 (+RSS reader)";
export const MAX_REDIRECTS = 3;

export interface SafeFetchOptions {
  timeoutMs: number;
  maxBytes: number;
  /** true면 Next 데이터 캐시를 건너뛴다 */
  fresh?: boolean;
  /** fresh가 아닐 때 Next 데이터 캐시 유지 시간 */
  revalidateSeconds?: number;
  accept?: string;
  /** 최초 URL과 모든 리다이렉트 대상에 대해 호출. 거부하려면 throw */
  checkUrl?: (url: URL) => Promise<unknown>;
  fetchImpl?: typeof fetch;
}

export interface FetchedText {
  text: string;
  headers: Headers;
  /** 리다이렉트를 따라간 최종 URL */
  url: string;
}

// ---------------------------------------------------------------------------
// 인코딩
// ---------------------------------------------------------------------------

/** Content-Type charset → XML 선언 encoding → HTML meta charset → utf-8 */
export function detectCharset(contentType: string | null, bytes: Uint8Array): string {
  const fromHeader = /charset=["']?([\w-]+)/i.exec(contentType ?? "");
  if (fromHeader) return fromHeader[1].toLowerCase();
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 2048));
  const fromDecl = /<\?xml[^>]*encoding=["']([\w-]+)["']/i.exec(head);
  if (fromDecl) return fromDecl[1].toLowerCase();
  const fromMeta = /<meta[^>]+charset=["']?([\w-]+)/i.exec(head);
  return fromMeta ? fromMeta[1].toLowerCase() : "utf-8";
}

export function decodeBody(bytes: Uint8Array, contentType: string | null): string {
  const charset = detectCharset(contentType, bytes);
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

// ---------------------------------------------------------------------------
// fetch
// ---------------------------------------------------------------------------

async function readLimited(res: Response, maxBytes: number): Promise<Uint8Array> {
  const declared = Number(res.headers.get("content-length"));
  if (declared > maxBytes) throw new FeedFetchError("응답이 너무 큽니다");
  if (!res.body) return new Uint8Array();

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new FeedFetchError("응답이 너무 큽니다");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

/**
 * 외부 URL을 안전하게 받아 문자열로 디코딩한다.
 * 리다이렉트는 직접 따라가며 hop마다 checkUrl, 전체 타임아웃, 응답 크기 제한.
 * 실패는 모두 사용자에게 보여줄 수 있는 FeedFetchError로 바꾼다.
 */
export async function fetchText(url: string, opts: SafeFetchOptions): Promise<FetchedText> {
  const { timeoutMs, maxBytes, fresh = false, revalidateSeconds, accept = "*/*", checkUrl, fetchImpl = fetch } = opts;
  const signal = AbortSignal.timeout(timeoutMs);
  let current = new URL(url);

  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      await checkUrl?.(current);
      const res = await fetchImpl(current.toString(), {
        headers: { "User-Agent": USER_AGENT, Accept: accept },
        redirect: "manual",
        signal,
        ...(fresh ? { cache: "no-store" as const } : revalidateSeconds ? { next: { revalidate: revalidateSeconds } } : {}),
      } as RequestInit);

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) throw new FeedFetchError(`HTTP ${res.status}`);
        current = new URL(location, current);
        continue;
      }
      if (!res.ok) throw new FeedFetchError(`HTTP ${res.status}`);

      const bytes = await readLimited(res, maxBytes);
      return { text: decodeBody(bytes, res.headers.get("content-type")), headers: res.headers, url: current.toString() };
    }
    throw new FeedFetchError("리다이렉트가 너무 많습니다");
  } catch (err) {
    if (err instanceof FeedFetchError) throw err;
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      throw new FeedFetchError(`시간 초과 (${Math.round(timeoutMs / 1000)}초)`);
    }
    throw new FeedFetchError("연결 실패");
  }
}
