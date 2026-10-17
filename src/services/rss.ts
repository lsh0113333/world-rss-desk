import { XMLParser } from "fast-xml-parser";
import { FeedFetchError } from "@/lib/errors";
import { cleanText, hashId, parseFeedDate, truncate } from "@/lib/text";
import type { Article } from "@/types/article";

/** 'Mozilla/5.0'만 보내면 봇 위장으로 보고 차단하는 매체가 있어 리더임을 밝힌다 */
export const USER_AGENT = "WorldRSSDesk/0.1 (+RSS reader)";
export const FETCH_TIMEOUT_MS = 8_000;
export const MAX_FEED_BYTES = 2 * 1024 * 1024;
export const MAX_REDIRECTS = 3;
export const REVALIDATE_SECONDS = 600;
const SUMMARY_MAX = 300;

export { FeedFetchError };

export interface ParsedFeed {
  title: string | null;
  articles: Article[];
}

export interface ParseOptions {
  /** 기사 source에 넣을 매체명. 없으면 채널 제목 */
  source?: string;
  now?: Date;
}

export interface FetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
  /** true면 Next 데이터 캐시를 건너뛴다 (수동 새로고침) */
  fresh?: boolean;
  /** 최초 URL과 모든 리다이렉트 대상에 대해 호출. 거부하려면 throw */
  checkUrl?: (url: URL) => Promise<unknown>;
  fetchImpl?: typeof fetch;
}

// ---------------------------------------------------------------------------
// 인코딩
// ---------------------------------------------------------------------------

export function detectCharset(contentType: string | null, bytes: Uint8Array): string {
  const fromHeader = /charset=["']?([\w-]+)/i.exec(contentType ?? "");
  if (fromHeader) return fromHeader[1].toLowerCase();
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 200));
  const fromDecl = /<\?xml[^>]*encoding=["']([\w-]+)["']/i.exec(head);
  return fromDecl ? fromDecl[1].toLowerCase() : "utf-8";
}

export function decodeFeedBody(bytes: Uint8Array, contentType: string | null): string {
  const charset = detectCharset(contentType, bytes);
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

// ---------------------------------------------------------------------------
// 파싱
// ---------------------------------------------------------------------------

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  processEntities: true,
  htmlEntities: true,
  isArray: (name) => ["item", "entry", "link"].includes(name),
});

type Node = Record<string, unknown>;

const asArray = (value: unknown): unknown[] => (value === undefined || value === null ? [] : Array.isArray(value) ? value : [value]);
const asNode = (value: unknown): Node => (value && typeof value === "object" ? (value as Node) : {});

function httpUrl(value: unknown): string | null {
  const text = cleanText(value);
  if (!text) return null;
  try {
    const url = new URL(text);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function rssLink(item: Node): string | null {
  for (const link of asArray(item.link)) {
    const url = httpUrl(link);
    if (url) return url;
  }
  const guid = item.guid;
  const isPermaLink = asNode(guid)["@_isPermaLink"];
  return isPermaLink === "false" ? null : httpUrl(guid) ?? httpUrl(item["@_rdf:about"]);
}

function atomLink(entry: Node): string | null {
  const links = asArray(entry.link).map(asNode);
  const alternate = links.find((l) => !l["@_rel"] || l["@_rel"] === "alternate");
  return httpUrl(alternate?.["@_href"]);
}

function toArticle(fields: { title: unknown; link: string | null; date: unknown; summary: unknown; guid: unknown }, source: string, now: Date): Article | null {
  const title = cleanText(fields.title);
  if (!title || !fields.link) return null;
  const summary = truncate(cleanText(fields.summary), SUMMARY_MAX);
  return {
    id: hashId(cleanText(fields.guid) || fields.link),
    title,
    link: fields.link,
    publishedAt: parseFeedDate(fields.date, now),
    source,
    ...(summary ? { summary } : {}),
  };
}

/** RSS 2.0 / Atom / RSS 1.0(RDF) → Article[]. 피드가 아니면 FeedFetchError */
export function parseFeed(xml: string, opts: ParseOptions = {}): ParsedFeed {
  const now = opts.now ?? new Date();
  let doc: Node;
  try {
    doc = asNode(parser.parse(xml));
  } catch {
    throw new FeedFetchError("RSS 형식이 아닙니다");
  }

  const rss = asNode(doc.rss);
  const atom = asNode(doc.feed);
  const rdf = asNode(doc["rdf:RDF"]);

  let title: string;
  let entries: { title: unknown; link: string | null; date: unknown; summary: unknown; guid: unknown }[];

  if (doc.rss !== undefined) {
    const channel = asNode(asArray(rss.channel)[0]);
    title = cleanText(channel.title);
    entries = asArray(channel.item).map(asNode).map((item) => ({
      title: item.title,
      link: rssLink(item),
      date: item.pubDate ?? item["dc:date"] ?? item.published ?? item.updated,
      summary: item.description ?? item["content:encoded"],
      guid: item.guid,
    }));
  } else if (doc.feed !== undefined) {
    title = cleanText(atom.title);
    entries = asArray(atom.entry).map(asNode).map((entry) => ({
      title: entry.title,
      link: atomLink(entry),
      date: entry.published ?? entry.updated,
      summary: entry.summary ?? entry.content,
      guid: entry.id,
    }));
  } else if (doc["rdf:RDF"] !== undefined) {
    title = cleanText(asNode(rdf.channel).title);
    entries = asArray(rdf.item).map(asNode).map((item) => ({
      title: item.title,
      link: rssLink(item),
      date: item["dc:date"] ?? item.pubDate,
      summary: item.description,
      guid: item["@_rdf:about"],
    }));
  } else {
    throw new FeedFetchError("RSS 형식이 아닙니다");
  }

  const source = opts.source ?? (title || "알 수 없는 매체");
  const articles = entries.map((e) => toArticle(e, source, now)).filter((a): a is Article => a !== null);
  return { title: title || null, articles };
}

// ---------------------------------------------------------------------------
// 네트워크
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

/** 피드 본문을 받아 문자열로 디코딩. 리다이렉트는 직접 따라가며 매 hop마다 checkUrl */
export async function fetchFeedText(url: string, opts: FetchOptions = {}): Promise<string> {
  const { timeoutMs = FETCH_TIMEOUT_MS, maxBytes = MAX_FEED_BYTES, fresh = false, checkUrl, fetchImpl = fetch } = opts;
  const signal = AbortSignal.timeout(timeoutMs);
  let current = new URL(url);

  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      await checkUrl?.(current);
      const res = await fetchImpl(current.toString(), {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.9, */*;q=0.5",
        },
        redirect: "manual",
        signal,
        ...(fresh ? { cache: "no-store" as const } : { next: { revalidate: REVALIDATE_SECONDS } }),
      } as RequestInit);

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) throw new FeedFetchError(`HTTP ${res.status}`);
        current = new URL(location, current);
        continue;
      }
      if (!res.ok) throw new FeedFetchError(`HTTP ${res.status}`);

      const bytes = await readLimited(res, maxBytes);
      return decodeFeedBody(bytes, res.headers.get("content-type"));
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

export async function loadFeed(url: string, opts: FetchOptions & ParseOptions = {}): Promise<ParsedFeed> {
  const xml = await fetchFeedText(url, opts);
  return parseFeed(xml, { source: opts.source, now: opts.now });
}
