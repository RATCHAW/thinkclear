import { describe, expect, it } from "vitest";
import {
  isDestructiveMcpTool,
  isToolGranted,
  MCP_SCOPE_DESCRIPTIONS,
  MCP_SCOPES,
  mcpScopeForTool,
  MUTATING_CHAT_TOOLS,
  parseScopeClaim,
} from "../src";

describe("MCP scopes", () => {
  it("puts every tool that writes behind the write scope", () => {
    for (const tool of MUTATING_CHAT_TOOLS) {
      expect(mcpScopeForTool(tool)).toBe("mindmaps:write");
    }
  });

  it("leaves reading tools on the read scope", () => {
    expect(mcpScopeForTool("list_mindmaps")).toBe("mindmaps:read");
    expect(mcpScopeForTool("read_mindmap")).toBe("mindmaps:read");
    expect(mcpScopeForTool("read_topic_note")).toBe("mindmaps:read");
  });

  it("puts note writing behind the write scope, like every other edit", () => {
    // Notes arrived after MCP did and needed no change here: the split is
    // derived from the list that already says which tools write.
    expect(mcpScopeForTool("set_topic_note")).toBe("mindmaps:write");
  });

  it("describes every scope it offers, so consent can never show a bare name", () => {
    for (const scope of MCP_SCOPES) {
      expect(MCP_SCOPE_DESCRIPTIONS[scope]).toBeTruthy();
    }
    expect(Object.keys(MCP_SCOPE_DESCRIPTIONS).sort()).toEqual(
      [...MCP_SCOPES].sort(),
    );
  });

  it("flags the tools that can destroy work the user wrote by hand", () => {
    expect(isDestructiveMcpTool("delete_mindmap")).toBe(true);
    expect(isDestructiveMcpTool("delete_topics")).toBe(true);
    // Writing a note replaces it wholesale, and a note can be paragraphs.
    expect(isDestructiveMcpTool("set_topic_note")).toBe(true);

    // A title is retyped in seconds; putting a confirmation in front of every
    // update would just train people to click through them.
    expect(isDestructiveMcpTool("rename_mindmap")).toBe(false);
    expect(isDestructiveMcpTool("read_topic_note")).toBe(false);
  });

  it("grants a tool only to a token carrying its scope", () => {
    expect(isToolGranted("list_mindmaps", ["mindmaps:read"])).toBe(true);
    expect(isToolGranted("delete_mindmap", ["mindmaps:read"])).toBe(false);
    expect(isToolGranted("delete_mindmap", MCP_SCOPES)).toBe(true);
    // Write does not imply read, and neither implies the other: the scopes a
    // consent screen listed are exactly the ones that apply.
    expect(isToolGranted("list_mindmaps", ["mindmaps:write"])).toBe(false);
  });

  it("reads the space-delimited scope claim OAuth actually sends", () => {
    expect(parseScopeClaim("openid mindmaps:read")).toEqual([
      "openid",
      "mindmaps:read",
    ]);
    expect(parseScopeClaim("  mindmaps:read   mindmaps:write ")).toEqual([
      "mindmaps:read",
      "mindmaps:write",
    ]);
  });

  it("treats a missing or malformed scope claim as granting nothing", () => {
    // Failing closed matters here: the parse result is what decides which
    // tools get registered.
    for (const claim of [undefined, null, 42, ["mindmaps:read"], {}]) {
      expect(parseScopeClaim(claim)).toEqual([]);
    }
    expect(isToolGranted("list_mindmaps", parseScopeClaim(undefined))).toBe(
      false,
    );
  });
});
