import { lookup as dnsLookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { FeedFetchError } from "./errors";

const ALLOWED_PORTS = new Set(["", "80", "443", "8080", "8443"]);
const BLOCKED_HOST_SUFFIXES = [".localhost", ".local", ".internal", ".home.arpa"];

const blockList = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 3],
] as const) {
  blockList.addSubnet(net, prefix, "ipv4");
}
for (const [net, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blockList.addSubnet(net, prefix, "ipv6");
}

/** 사설·루프백·링크로컬·멀티캐스트 등 외부에서 접근하면 안 되는 주소인가 */
export function isPrivateAddress(ip: string): boolean {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mapped) return blockList.check(mapped[1], "ipv4");
  const family = isIP(ip);
  if (family === 4) return blockList.check(ip, "ipv4");
  if (family === 6) return blockList.check(ip, "ipv6");
  return true;
}

export interface GuardOptions {
  /** 호스트명 → IP 목록. 테스트에서 주입 */
  lookup?: (hostname: string) => Promise<string[]>;
}

async function defaultLookup(hostname: string): Promise<string[]> {
  const results = await dnsLookup(hostname, { all: true, verbatim: true });
  return results.map((r) => r.address);
}

/**
 * 서버가 대신 요청해도 안전한 URL인지 검사한다 (SSRF 방지).
 * http/https, 인증정보 없음, 허용 포트, 로컬 호스트명 아님, 해석된 모든 IP가 공인 주소.
 * 리다이렉트 대상마다 다시 호출해야 한다 (services/rss의 checkUrl).
 */
export async function assertSafeUrl(input: string | URL, opts: GuardOptions = {}): Promise<URL> {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new FeedFetchError("올바른 URL이 아닙니다");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new FeedFetchError("http/https 주소만 사용할 수 있습니다");
  }
  if (url.username || url.password) throw new FeedFetchError("인증 정보가 포함된 주소는 사용할 수 없습니다");
  if (!ALLOWED_PORTS.has(url.port)) throw new FeedFetchError("허용되지 않는 포트입니다");

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (hostname === "localhost" || BLOCKED_HOST_SUFFIXES.some((s) => hostname.endsWith(s))) {
    throw new FeedFetchError("차단된 주소입니다");
  }

  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) throw new FeedFetchError("차단된 주소입니다");
    return url;
  }

  let addresses: string[];
  try {
    addresses = await (opts.lookup ?? defaultLookup)(hostname);
  } catch {
    throw new FeedFetchError("주소를 찾을 수 없습니다");
  }
  if (addresses.length === 0) throw new FeedFetchError("주소를 찾을 수 없습니다");
  if (addresses.some(isPrivateAddress)) throw new FeedFetchError("차단된 주소입니다");
  return url;
}
