// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { FeedFetchError } from "./errors";
import { assertSafeUrl, isPrivateAddress } from "./url-guard";

const publicLookup = vi.fn(async () => ["93.184.216.34"]);

describe("isPrivateAddress", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.0.10",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "::1",
    "::",
    "fe80::1",
    "fd00::1",
    "::ffff:127.0.0.1",
    "::ffff:10.0.0.1",
  ])("blocks %s", (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });

  it.each(["93.184.216.34", "8.8.8.8", "172.32.0.1", "2606:4700::1111"])("allows %s", (ip) => {
    expect(isPrivateAddress(ip)).toBe(false);
  });
});

describe("assertSafeUrl", () => {
  it("returns a URL for public http(s) addresses", async () => {
    const url = await assertSafeUrl("https://feeds.example.com/rss.xml", { lookup: publicLookup });
    expect(url).toBeInstanceOf(URL);
    expect(url.hostname).toBe("feeds.example.com");
    expect(publicLookup).toHaveBeenCalledWith("feeds.example.com");
  });

  it("accepts URL objects", async () => {
    await expect(assertSafeUrl(new URL("http://example.com/feed"), { lookup: publicLookup })).resolves.toBeInstanceOf(URL);
  });

  it.each(["not a url", "", "/relative/path"])("rejects invalid url %j", async (input) => {
    await expect(assertSafeUrl(input, { lookup: publicLookup })).rejects.toThrow("올바른 URL이 아닙니다");
  });

  it.each(["ftp://example.com/feed", "file:///etc/passwd", "javascript:alert(1)", "data:text/xml,<rss/>"])(
    "rejects non-http protocol %s",
    async (input) => {
      await expect(assertSafeUrl(input, { lookup: publicLookup })).rejects.toThrow("http/https 주소만");
    },
  );

  it("rejects credentials in the url", async () => {
    await expect(assertSafeUrl("https://user:pass@example.com/rss", { lookup: publicLookup })).rejects.toThrow(FeedFetchError);
  });

  it("rejects unusual ports", async () => {
    await expect(assertSafeUrl("http://example.com:22/rss", { lookup: publicLookup })).rejects.toThrow("허용되지 않는 포트");
    await expect(assertSafeUrl("https://example.com:8443/rss", { lookup: publicLookup })).resolves.toBeInstanceOf(URL);
  });

  it.each(["http://localhost/rss", "http://app.localhost/rss", "http://printer.local/rss", "http://db.internal/rss"])(
    "rejects local hostnames without lookup: %s",
    async (input) => {
      const lookup = vi.fn(publicLookup);
      await expect(assertSafeUrl(input, { lookup })).rejects.toThrow("차단된 주소");
      expect(lookup).not.toHaveBeenCalled();
    },
  );

  it.each(["http://127.0.0.1/rss", "http://169.254.169.254/latest/meta-data", "http://[::1]/rss", "http://10.0.0.5:8080/rss"])(
    "rejects private ip literals without lookup: %s",
    async (input) => {
      const lookup = vi.fn(publicLookup);
      await expect(assertSafeUrl(input, { lookup })).rejects.toThrow("차단된 주소");
      expect(lookup).not.toHaveBeenCalled();
    },
  );

  it("rejects hostnames that resolve to any private address", async () => {
    const lookup = vi.fn(async () => ["93.184.216.34", "10.0.0.1"]);
    await expect(assertSafeUrl("https://sneaky.example.com/rss", { lookup })).rejects.toThrow("차단된 주소");
  });

  it("rejects hostnames that do not resolve", async () => {
    const lookup = vi.fn(async () => {
      throw new Error("ENOTFOUND");
    });
    await expect(assertSafeUrl("https://nope.invalid/rss", { lookup })).rejects.toThrow("주소를 찾을 수 없습니다");
    const empty = vi.fn(async () => []);
    await expect(assertSafeUrl("https://empty.example.com/rss", { lookup: empty })).rejects.toThrow("주소를 찾을 수 없습니다");
  });
});
