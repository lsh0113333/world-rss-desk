/**
 * 응답 헤더 기준으로 다른 사이트(우리 앱)의 iframe 안에 띄울 수 있는지.
 * X-Frame-Options가 있으면 불가. CSP frame-ancestors는 모든 출처(*, https:, http:)를 허용할 때만 가능 —
 * 특정 도메인만 나열한 정책에 우리 도메인이 들어 있을 리 없기 때문.
 */
export function canEmbed(headers: Headers): boolean {
  if (headers.get("x-frame-options")) return false;

  const csp = headers.get("content-security-policy");
  if (!csp) return true;
  // 여러 헤더는 Headers가 ", "로 합친다
  const directives = csp.split(/[;,]/).map((d) => d.trim().toLowerCase());
  const ancestors = directives.find((d) => d.startsWith("frame-ancestors"));
  if (!ancestors) return true;
  const sources = ancestors.split(/\s+/).slice(1);
  return sources.some((s) => s === "*" || s === "https:" || s === "http:");
}
