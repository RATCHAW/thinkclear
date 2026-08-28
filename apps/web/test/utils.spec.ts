import { describe, expect, it } from "vitest";
import { cn } from "../src/lib/utils";

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
