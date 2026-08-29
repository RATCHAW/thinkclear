import { describe, expect, it } from "vitest";
import { cn, formatRelativeTime } from "../src/lib/utils";

describe("cn", () => {
  it("combines conditional class names", () => {
    expect(cn("base", undefined, { active: true })).toBe("base active");
  });

  it("merges custom design tokens by their real Tailwind groups", () => {
    expect(cn("text-body-md text-display-sm text-ink text-graphite")).toBe(
      "text-display-sm text-graphite",
    );
    expect(cn("shadow-soft-lift shadow-floating rounded-md rounded-pill")).toBe(
      "shadow-floating rounded-pill",
    );
  });
});

describe("formatRelativeTime", () => {
  const now = new Date("2026-08-29T12:00:00.000Z");
  const ago = (ms: number) =>
    formatRelativeTime(new Date(now.getTime() - ms).toISOString(), now);

  it("shortens each step up to a week", () => {
    expect(ago(20 * 1000)).toBe("now");
    expect(ago(5 * 60_000)).toBe("5m");
    expect(ago(3 * 3_600_000)).toBe("3h");
    expect(ago(2 * 86_400_000)).toBe("2d");
  });

  it("falls back to a date once the age stops meaning anything", () => {
    expect(ago(9 * 86_400_000)).toMatch(/Aug/);
  });

  it("reads a future timestamp as now rather than a negative age", () => {
    // Server and browser clocks drift; a row stamped a few seconds ahead is
    // not "-1m old".
    expect(ago(-5_000)).toBe("now");
  });

  it("returns nothing for an unparseable timestamp", () => {
    expect(formatRelativeTime("not a date", now)).toBe("");
  });
});
