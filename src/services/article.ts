import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { FeedFetchError } from "@/lib/errors";
import { canEmbed } from "@/lib/frame-policy";
import type { ArticleView, ReaderBlock, ReaderDoc } from "@/types/article";
import { fetchText } from "./http";

export const ARTICLE_TIMEOUT_MS = 10_000;
export const MAX_ARTICLE_BYTES = 3 * 1024 * 1024;
const MIN_TEXT_LENGTH = 200;
const MAX_BLOCKS = 300;

const TEXT_BLOCKS: Record<string, Exclude<ReaderBlock["type"], "img">> = {
  P: "p",
  PRE: "p",
  H1: "h2",
  H2: "h2",
  H3: "h3",
  H4: "h3",
  H5: "h3",
  H6: "h3",
  BLOCKQUOTE: "blockquote",
  LI: "li",
};

const normalize = (text: string | null | undefined) => (text ?? "").replace(/\s+/g, " ").trim();

function imageBlock(el: Element, pageUrl: string): ReaderBlock | null {
  const raw = el.getAttribute("src") || el.getAttribute("data-src");
  if (!raw) return null;
  try {
    const url = new URL(raw, pageUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    const alt = normalize(el.getAttribute("alt"));
    return { type: "img", src: url.toString(), ...(alt ? { alt } : {}) };
  } catch {
    return null;
  }
}

/** Readability가 정리한 본문 HTML → ReaderBlock[] (텍스트와 이미지 주소만 남긴다) */
function toBlocks(contentHtml: string, pageUrl: string): ReaderBlock[] {
  const { document } = parseHTML(`<!doctype html><html><body>${contentHtml}</body></html>`);
  const blocks: ReaderBlock[] = [];

  const walk = (node: Element) => {
    for (const child of Array.from(node.children)) {
      if (blocks.length >= MAX_BLOCKS) return;
      const type = TEXT_BLOCKS[child.tagName];
      if (type) {
        const text = normalize(child.textContent);
        if (text) blocks.push({ type, text });
        for (const img of Array.from(child.querySelectorAll("img"))) {
          const block = imageBlock(img, pageUrl);
          if (block) blocks.push(block);
        }
      } else if (child.tagName === "IMG") {
        const block = imageBlock(child, pageUrl);
        if (block) blocks.push(block);
      } else if (child.tagName !== "FIGCAPTION") {
        walk(child);
      }
    }
  };
  walk(document.body);
  return blocks;
}

/** 기사 HTML에서 본문을 추출한다. 본문 텍스트가 너무 짧으면(유료벽·목록 페이지) null */
export function extractReader(html: string, pageUrl: string): ReaderDoc | null {
  const { document } = parseHTML(html);
  let parsed: ReturnType<Readability<string>["parse"]>;
  try {
    parsed = new Readability(document as unknown as Document, { keepClasses: false }).parse();
  } catch {
    return null;
  }
  if (!parsed?.content) return null;

  const blocks = toBlocks(parsed.content, pageUrl);
  const textLength = blocks.reduce((n, b) => n + ("text" in b ? b.text.length : 0), 0);
  if (textLength < MIN_TEXT_LENGTH) return null;

  const title = normalize(parsed.title);
  const siteName = normalize(parsed.siteName);
  const byline = normalize(parsed.byline);
  const publishedAt = normalize(parsed.publishedTime);
  return {
    title: title || "제목 없음",
    ...(siteName ? { siteName } : {}),
    ...(byline ? { byline } : {}),
    ...(publishedAt ? { publishedAt } : {}),
    blocks,
  };
}

export interface ViewOptions {
  /** 최초 URL과 리다이렉트 대상 검사. 최초 URL이 거부되면 그대로 throw */
  checkUrl?: (url: URL) => Promise<unknown>;
  fetchImpl?: typeof fetch;
}

function failureReason(message: string): string {
  if (/HTTP (401|403|451)/.test(message)) return `사이트가 접근을 막았습니다 (${message})`;
  return `페이지를 불러오지 못했습니다 (${message})`;
}

/**
 * 원문 보기 모드 판정: iframe 허용 → frame, 아니면 본문 추출 → reader, 실패 → link.
 * 페이지를 못 받아도 예외 대신 link를 돌려준다. 최초 URL의 안전성 검사 실패만 예외.
 */
export async function viewArticle(url: string, opts: ViewOptions = {}): Promise<ArticleView> {
  await opts.checkUrl?.(new URL(url));

  let page;
  try {
    page = await fetchText(url, {
      timeoutMs: ARTICLE_TIMEOUT_MS,
      maxBytes: MAX_ARTICLE_BYTES,
      revalidateSeconds: 3600,
      accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
      checkUrl: opts.checkUrl,
      fetchImpl: opts.fetchImpl,
    });
  } catch (err) {
    const message = err instanceof FeedFetchError ? err.message : "연결 실패";
    return { mode: "link", url, reason: failureReason(message) };
  }

  const contentType = page.headers.get("content-type");
  if (contentType && !/html/i.test(contentType)) return { mode: "link", url: page.url, reason: "웹 페이지가 아닙니다" };
  if (canEmbed(page.headers)) return { mode: "frame", url: page.url };

  const doc = extractReader(page.text, page.url);
  if (!doc) return { mode: "link", url: page.url, reason: "본문을 찾지 못했습니다 (유료 기사이거나 구조가 특이한 페이지)" };
  return { mode: "reader", url: page.url, ...doc };
}
