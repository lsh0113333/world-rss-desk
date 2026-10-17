import { decodeEntities } from "./text";

export interface FeedLink {
  url: string;
  title?: string;
}

const FEED_TYPES = /application\/(rss|atom|rdf)\+xml|application\/xml|text\/xml/i;
const FEED_HREF = /(rss|atom|feed)(\.xml|\/|$|\?|\.rss)|\.rss$|\/rss\.xml$/i;
const MAX_LINKS = 20;
const COMMON_PATHS = ["/feed", "/rss", "/rss.xml", "/feed.xml", "/atom.xml", "/index.xml", "/rss/", "/feeds/posts/default"];

const attr = (tag: string, name: string) => new RegExp(`${name}\s*=\s*["']([^"']*)["']`, "i").exec(tag)?.[1];

function resolve(href: string | undefined, base: string): string | null {
  if (!href) return null;
  try {
    const url = new URL(decodeEntities(href.trim()), base);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** 페이지 HTML에서 RSS/Atom 후보: <link rel="alternate" type="...+xml"> → 같은 사이트의 피드처럼 보이는 <a> */
export function extractFeedLinks(html: string, pageUrl: string): FeedLink[] {
  const out: FeedLink[] = [];
  const seen = new Set<string>();
  const push = (url: string | null, title?: string) => {
    if (!url || seen.has(url) || out.length >= MAX_LINKS) return;
    seen.add(url);
    const clean = title ? decodeEntities(title).replace(/\s+/g, " ").trim() : "";
    out.push(clean ? { url, title: clean } : { url });
  };

  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    if (!/rel\s*=\s*["'][^"']*alternate/i.test(tag) || !FEED_TYPES.test(attr(tag, "type") ?? "")) continue;
    push(resolve(attr(tag, "href"), pageUrl), attr(tag, "title"));
  }

  const host = new URL(pageUrl).hostname;
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const url = resolve(attr(m[1], "href"), pageUrl);
    if (!url || new URL(url).hostname !== host || !FEED_HREF.test(new URL(url).pathname + new URL(url).search)) continue;
    push(url, m[2].replace(/<[^>]*>/g, ""));
  }
  return out;
}

/** "bbc.com" → "https://bbc.com/". URL로 볼 수 없으면 null */
export function normalizeSiteInput(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** 사이트에서 흔히 쓰는 피드 경로 */
export function commonFeedUrls(siteUrl: string): string[] {
  const origin = new URL(siteUrl).origin;
  return COMMON_PATHS.map((p) => origin + p);
}
