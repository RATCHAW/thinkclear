import { describe, expect, it } from "vitest";
import {
  createMindmapSchema,
  MAX_NOTE_LENGTH,
  mindmapNodeSchema,
  signInSchema,
  signUpSchema,
  updateMindmapSchema,
} from "../src";

describe("authentication schemas", () => {
  it("accepts valid sign-up and sign-in credentials", () => {
    expect(
      signUpSchema.parse({
        name: "Ada Lovelace",
        email: "ada@example.com",
        password: "analytical-engine",
      }),
    ).toEqual({
      name: "Ada Lovelace",
      email: "ada@example.com",
      password: "analytical-engine",
    });

    expect(
      signInSchema.parse({ email: "ada@example.com", password: "secret" }),
    ).toEqual({ email: "ada@example.com", password: "secret" });
  });

  it("rejects malformed credentials with useful field errors", () => {
    const result = signUpSchema.safeParse({
      name: "",
      email: "not-an-email",
      password: "short",
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.flatten().fieldErrors).toEqual({
      name: ["Name is required"],
      email: ["Enter a valid email"],
      password: ["Password must be at least 8 characters"],
    });
  });

  it("requires a password when signing in", () => {
    const result = signInSchema.safeParse({
      email: "ada@example.com",
      password: "",
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.message).toBe("Password is required");
  });
});

describe("mindmap schemas", () => {
  it("normalizes titles at the shared boundary", () => {
    expect(createMindmapSchema.parse({ title: "  Compiler design  " })).toEqual(
      {
        title: "Compiler design",
      },
    );
  });

  it("rejects blank, oversized, and non-finite node data", () => {
    expect(createMindmapSchema.safeParse({ title: "   " }).success).toBe(false);
    expect(
      createMindmapSchema.safeParse({ title: "x".repeat(201) }).success,
    ).toBe(false);
    expect(
      mindmapNodeSchema.safeParse({
        id: "node-1",
        title: "Topic",
        x: Number.POSITIVE_INFINITY,
        y: 0,
      }).success,
    ).toBe(false);
  });

  it("carries an optional markdown note on a node, up to the cap", () => {
    const node = { id: "node-1", title: "Topic", x: 0, y: 0 };

    // Absent is the canonical "no note", so it survives a parse untouched
    // rather than coming back as an empty string.
    expect(mindmapNodeSchema.parse(node)).toEqual(node);
    expect(
      mindmapNodeSchema.parse({ ...node, note: "# Ship it\n\n- API first" }),
    ).toEqual({ ...node, note: "# Ship it\n\n- API first" });

    expect(
      mindmapNodeSchema.safeParse({
        ...node,
        note: "x".repeat(MAX_NOTE_LENGTH),
      }).success,
    ).toBe(true);
    expect(
      mindmapNodeSchema.safeParse({
        ...node,
        note: "x".repeat(MAX_NOTE_LENGTH + 1),
      }).success,
    ).toBe(false);
  });

  it("accepts partial updates but rejects an empty patch", () => {
    expect(updateMindmapSchema.parse({ title: "  Renamed  " })).toEqual({
      title: "Renamed",
    });

    const result = updateMindmapSchema.safeParse({});
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.message).toBe(
      "At least one field is required",
    );
  });
});
