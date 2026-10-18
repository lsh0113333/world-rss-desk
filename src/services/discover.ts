import { CATALOG } from "@/lib/catalog";
import { getCategory } from "@/lib/constants";
import { FeedFetchError } from "@/lib/errors";
import { commonFeedUrls, extractFeedLinks, normalizeSiteInput } from "@/lib/feed-discovery";
import { fetchText } from "./http";
import { fetchFeedText, parseFeed } from "./rss";

export interface DiscoveredFeed {
  url: string;
  title: string;
  /** 카탈로그에서 찾은 피드는 미리 받아보지 않으므로 없음 */
  articleCount?: number;
  /** 카탈로그에 이미 있는 피드면 그 id (카탈로그 피드로 추가) */
  catalogId?: string;
}

export interface DiscoverResult {
  feeds: DiscoveredFeed[];
  error?: string;
}

export interface DiscoverOptions {
  checkUrl?: (url: URL) => Promise<unknown>;
  fetchImpl?: typeof fetch;
}

const MAX_CANDIDATES = 12;

const bareHost = (url: string) => new URL(url).hostname.replace(/^www\./, "");

/** 같은 사이트(서브도메인 포함)의 카탈로그 피드 — 홈페이지에 RSS 링크가 없는 매체(BBC, 연합뉴스 등)용 */
function catalogMatches(siteUrl: string): DiscoveredFeed[] {
  const host = bareHost(siteUrl);
  const root = host.split(".").slice(-2).join(".");
  return CATALOG.filter((f) => {
    const h = bareHost(f.homepage);
    return h === host || h.endsWith(`.${host}`) || host.endsWith(`.${h}`) || (root.length > 6 && h.endsWith(root));
  }).map((f) => ({ url: f.url, title: `${f.name} · ${getCategory(f.category).label}`, catalogId: f.id }));
}

interface Tried extends DiscoveredFeed {
  fingerprint: string;
}

async function tryFeed(url: string, opts: DiscoverOptions, fallbackTitle?: string): Promise<Tried | null> {
  try {
    const xml = await fetchFeedText(url, { timeoutMs: 6_000, fresh: true, checkUrl: opts.checkUrl, fetchImpl: opts.fetchImpl });
    const { title, articles } = parseFeed(xml);
    if (articles.length === 0) return null;
    // /feed, /feed/, /rss처럼 주소만 다르고 내용이 같은 피드를 걸러내기 위한 지문
    const fingerprint = `${title}|${articles[0].link}`;
    return { url, title: title || fallbackTitle || new URL(url).hostname, articleCount: articles.length, fingerprint };
  } catch {
    return null;
  }
}

/**
 * 사이트 주소 또는 RSS 주소 → 실제로 읽히는 피드 목록.
 * 입력이 피드면 그대로, 아니면 페이지의 <link rel="alternate">·피드 링크·흔한 경로를 시험해 본다.
 */
export async function discoverFeeds(input: string, opts: DiscoverOptions = {}): Promise<DiscoverResult> {
  const url = normalizeSiteInput(input);
  if (!url) return { feeds: [], error: "올바른 주소가 아닙니다" };

  let page;
  try {
    page = await fetchText(url, {
      timeoutMs: 8_000,
      maxBytes: 5 * 1024 * 1024,
      fresh: true,
      accept: "text/html,application/rss+xml,application/atom+xml,application/xml;q=0.9,*/*;q=0.5",
      checkUrl: opts.checkUrl,
      fetchImpl: opts.fetchImpl,
    });
  } catch (err) {
    // 홈페이지가 너무 크거나 막혀 있어도 카탈로그에 있는 매체면 그 피드를 제안한다
    const catalog = catalogMatches(url);
    if (catalog.length > 0) return { feeds: catalog };
    const message = err instanceof FeedFetchError ? err.message : "연결 실패";
    return { feeds: [], error: `사이트를 열 수 없습니다 (${message})` };
  }

  // 1) 입력 자체가 피드인지
  try {
    const { title, articles } = parseFeed(page.text);
    return { feeds: [{ url: page.url, title: title || new URL(page.url).hostname, articleCount: articles.length }] };
  } catch {
    // HTML 페이지 → 후보 탐색
  }

  // 2) 페이지에 걸린 피드 링크 + 흔한 경로
  const linked = extractFeedLinks(page.text, page.url);
  const candidates = [...linked.map((l) => l.url), ...commonFeedUrls(page.url)].filter((u, i, all) => all.indexOf(u) === i).slice(0, MAX_CANDIDATES);
  const titles = new Map(linked.map((l) => [l.url, l.title]));
  const results = await Promise.all(candidates.map((c) => tryFeed(c, opts, titles.get(c))));

  const seen = new Set<string>();
  const found: DiscoveredFeed[] = [];
  for (const r of results) {
    if (!r || seen.has(r.fingerprint)) continue;
    seen.add(r.fingerprint);
    found.push({ url: r.url, title: r.title, articleCount: r.articleCount });
  }

  // 3) 카탈로그에 있는 같은 사이트 매체를 앞에 (중복 URL 제외)
  const catalog = catalogMatches(page.url).filter((c) => !found.some((f) => f.url === c.url));
  return { feeds: [...catalog, ...found] };
}
