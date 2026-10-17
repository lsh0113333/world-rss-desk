import { describe, expect, it } from "vitest";
import { canEmbed } from "./frame-policy";

const h = (init: Record<string, string>) => new Headers(init);

describe("canEmbed", () => {
  it("allows pages without framing restrictions", () => {
    expect(canEmbed(h({}))).toBe(true);
    expect(canEmbed(h({ "content-security-policy": "default-src 'self'; img-src *" }))).toBe(true);
  });

  it.each(["DENY", "SAMEORIGIN", "sameorigin", "ALLOW-FROM https://x.com"])("blocks X-Frame-Options %s", (value) => {
    expect(canEmbed(h({ "x-frame-options": value }))).toBe(false);
  });

  it.each(["frame-ancestors 'none'", "frame-ancestors 'self'", "default-src *; frame-ancestors 'self' https://*.cnbc.com"])(
    "blocks restrictive CSP: %s",
    (csp) => {
      expect(canEmbed(h({ "content-security-policy": csp }))).toBe(false);
    },
  );

  it("allows a wildcard frame-ancestors", () => {
    expect(canEmbed(h({ "content-security-policy": "frame-ancestors *" }))).toBe(true);
    expect(canEmbed(h({ "content-security-policy": "frame-ancestors https: http:" }))).toBe(true);
  });

  it("ignores report-only CSP", () => {
    expect(canEmbed(h({ "content-security-policy-report-only": "frame-ancestors 'none'" }))).toBe(true);
  });

  it("considers every CSP header value", () => {
    expect(canEmbed(h({ "content-security-policy": "default-src *, frame-ancestors 'none'" }))).toBe(false);
  });
});
