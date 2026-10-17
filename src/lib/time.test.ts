import { describe, expect, it } from "vitest";
import { formatClock, formatRelative } from "./time";

const now = new Date(2026, 9, 17, 12, 0, 0);
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

describe("formatRelative", () => {
  it("shows 방금 전 under a minute (and for slightly future times)", () => {
    expect(formatRelative(ago(30_000), now)).toBe("방금 전");
    expect(formatRelative(ago(-60_000), now)).toBe("방금 전");
  });

  it("shows minutes and hours within 24 hours", () => {
    expect(formatRelative(ago(12 * 60_000), now)).toBe("12분 전");
    expect(formatRelative(ago(3 * 3_600_000 + 59 * 60_000), now)).toBe("3시간 전");
    expect(formatRelative(ago(23 * 3_600_000), now)).toBe("23시간 전");
  });

  it("shows month/day time after 24 hours, in local time", () => {
    expect(formatRelative(new Date(2026, 9, 16, 9, 5).toISOString(), now)).toBe("10/16 09:05");
  });

  it("returns an empty string for null", () => {
    expect(formatRelative(null, now)).toBe("");
  });
});

describe("formatClock", () => {
  it("formats HH:mm in local time", () => {
    expect(formatClock(new Date(2026, 9, 17, 7, 3).toISOString())).toBe("07:03");
  });
});
