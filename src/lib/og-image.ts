import { decodeEntities } from "./text";

const KEYS = ["og:image:secure_url", "og:image", "og:image:url", "twitter:image", "twitter:image:src"];

/** 기사 HTML의 대표 이미지(og:image → twitter:image). 없거나 http(s)가 아니면 null */
export function extractOgImage(html: string, pageUrl: string): string | null {
  const metas = html.match(/<meta\b[^>]*>/gi) ?? [];
  const found = new Map<string, string>();
  for (const tag of metas) {
    const key = /(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase();
    const content = /content\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1];
    if (key && content && KEYS.includes(key) && !found.has(key)) found.set(key, content);
  }
  for (const key of KEYS) {
    const raw = found.get(key);
    if (!raw) continue;
    try {
      const url = new URL(decodeEntities(raw.trim()), pageUrl);
      if (url.protocol === "http:" || url.protocol === "https:") return url.toString();
    } catch {
      // 다음 후보
    }
  }
  return null;
}
