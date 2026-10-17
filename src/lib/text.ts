const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  laquo: "«",
  raquo: "»",
  middot: "·",
  bull: "•",
  copy: "©",
  reg: "®",
  trade: "™",
};

export function decodeEntities(input: string): string {
  return input.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, body: string) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match;
  });
}

function stripTags(input: string): string {
  return input
    .replace(/<(script|style)[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]*>/g, " ");
}

/** XML 파서 값(문자열·숫자·{#text}) → HTML·엔티티가 제거된 한 줄 텍스트 */
export function cleanText(value: unknown): string {
  let text: string;
  if (value === null || value === undefined) return "";
  if (typeof value === "object") text = String((value as Record<string, unknown>)["#text"] ?? "");
  else text = String(value);

  // 엔티티로 인코딩된 HTML(&lt;p&gt;)도 태그로 인식해 제거하도록 두 번 처리
  text = decodeEntities(stripTags(decodeEntities(stripTags(text))));
  return text.replace(/\s+/g, " ").trim();
}

export function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max - 1) + "…";
}

/** FNV-1a 32bit → base36. 기사 id용 (보안 용도 아님) */
export function hashId(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

const FUTURE_TOLERANCE_MS = 15 * 60 * 1000;

/**
 * 피드 날짜 → ISO 문자열. 실패하면 null.
 * 시간대 없는 'YYYY-MM-DD HH:mm:ss'는 UTC로 간주(서버 시간대에 따라 달라지지 않게).
 * 15분 넘게 미래인 날짜는 시간대 오류로 보고 now로 보정.
 */
export function parseFeedDate(value: unknown, now: Date = new Date()): string | null {
  const raw = cleanText(value);
  if (!raw) return null;
  const normalized = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(raw) ? raw.replace(" ", "T") + "Z" : raw;
  const ms = Date.parse(normalized);
  if (Number.isNaN(ms)) return null;
  if (ms > now.getTime() + FUTURE_TOLERANCE_MS) return now.toISOString();
  return new Date(ms).toISOString();
}
