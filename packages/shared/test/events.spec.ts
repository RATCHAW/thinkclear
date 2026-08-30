import { describe, expect, it } from "vitest";
import { isForeignMindmapChange } from "../src/events";

const cached = [
  { _id: "map-1", updatedAt: "2026-08-28T10:00:00.000Z" },
  { _id: "map-2", updatedAt: "2026-08-28T11:00:00.000Z" },
];

describe("isForeignMindmapChange", () => {
  it("treats a new updatedAt on a known mindmap as foreign", () => {
    expect(
      isForeignMindmapChange(
        { mindmapId: "map-1", updatedAt: "2026-08-28T10:05:00.000Z" },
        cached,
        false,
      ),
    ).toBe(true);
  });

  it("ignores the echo of a write the cache already absorbed", () => {
    expect(
      isForeignMindmapChange(
        { mindmapId: "map-1", updatedAt: "2026-08-28T10:00:00.000Z" },
        cached,
        false,
      ),
    ).toBe(false);
  });

  it("ignores every event for a mindmap whose own save is in flight", () => {
    // The save's response is the authoritative document either way; a refetch
    // here can land before that response and read the client's own write as
    // someone else's, reseeding the canvas mid-edit.
    expect(
      isForeignMindmapChange(
        { mindmapId: "map-1", updatedAt: "2026-08-28T10:05:00.000Z" },
        cached,
        true,
      ),
    ).toBe(false);
  });

  it("treats a mindmap the cache has never seen as foreign", () => {
    expect(
      isForeignMindmapChange(
        { mindmapId: "map-new", updatedAt: "2026-08-28T12:00:00.000Z" },
        cached,
        false,
      ),
    ).toBe(true);
  });

  it("reports a deletion only while the mindmap is still cached", () => {
    expect(
      isForeignMindmapChange(
        { mindmapId: "map-2", updatedAt: null },
        cached,
        false,
      ),
    ).toBe(true);
    expect(
      isForeignMindmapChange(
        { mindmapId: "map-gone", updatedAt: null },
        cached,
        false,
      ),
    ).toBe(false);
  });

  it("treats every change as foreign while nothing is cached yet", () => {
    expect(
      isForeignMindmapChange(
        { mindmapId: "map-1", updatedAt: "2026-08-28T10:00:00.000Z" },
        undefined,
        false,
      ),
    ).toBe(true);
  });
});
