import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MUTATING_CHAT_TOOLS, mcpScopeForTool } from "@thinkclear/shared";
import { describe, expect, it } from "vitest";
import { MCP_TOOLS } from "@/lib/content";
import { MCP_MANIFEST } from "@/lib/mcp-manifest";
import { VARY } from "@/proxy";
import { MCP_ENDPOINT } from "@/lib/site";

/**
 * The landing app imports no workspace package, on purpose — a marketing copy
 * change should not be a reason to rebuild the API. That rule is about the
 * *bundle*, and these specs are the other half of it: what this site now
 * publishes to agents restates facts that live elsewhere, so the copies are
 * checked here against the originals rather than trusted.
 */
describe("the MCP tool list this site publishes", () => {
  it("matches the tools the server actually serves", () => {
    const published = MCP_TOOLS.map((tool) => tool.name).sort();
    // Every mutating tool, plus the four read tools. Stated as a list rather
    // than derived, because the read side has no array to derive from — this is
    // the assertion that fails when a read tool is added and this page is not
    // told about it.
    const served = [
      "list_mindmaps",
      "read_mindmap",
      "search_topics",
      "read_topic_note",
      ...MUTATING_CHAT_TOOLS,
    ].sort();
    expect(published).toEqual(served);
  });

  it("gives every tool the scope the server derives for it", () => {
    for (const tool of MCP_TOOLS) {
      expect(tool.scope).toBe(mcpScopeForTool(tool.name));
    }
  });

  it("describes every tool", () => {
    for (const tool of MCP_TOOLS) {
      expect(tool.summary.length).toBeGreaterThan(10);
    }
  });
});

describe("the MCP manifest", () => {
  it("advertises the endpoint over Streamable HTTP", () => {
    expect(MCP_MANIFEST.remotes).toEqual([
      { type: "streamable-http", url: MCP_ENDPOINT },
    ]);
  });

  it("names both OAuth discovery documents, since the endpoint is not open", () => {
    expect(MCP_MANIFEST.auth.resourceMetadata).toContain(
      "/.well-known/oauth-protected-resource/api/mcp",
    );
    expect(MCP_MANIFEST.auth.authorizationServerMetadata).toContain(
      "/.well-known/oauth-authorization-server/api/auth",
    );
    expect(MCP_MANIFEST.auth.dynamicClientRegistration).toBe(true);
  });

  it("lists the scopes the tools need and no others", () => {
    expect([...MCP_MANIFEST.auth.scopes].sort()).toEqual([
      "mindmaps:read",
      "mindmaps:write",
    ]);
  });
});

describe("Vary", () => {
  // Next overwrites `Vary` on a page response with its own list, so the header
  // is set in two places: here for the responses the proxy builds, and in
  // `vercel.json` for the ones the platform serves. They have to say the same
  // thing or the answer depends on which layer replied.
  it("says the same thing in the proxy and in vercel.json", () => {
    const vercelConfig = JSON.parse(
      readFileSync(resolve(import.meta.dirname, "../vercel.json"), "utf8"),
    ) as {
      headers: { headers: { key: string; value: string }[] }[];
    };
    const configured = vercelConfig.headers
      .flatMap((rule) => rule.headers)
      .find((header) => header.key.toLowerCase() === "vary");

    expect(configured?.value).toBe(VARY);
  });

  it("declares Accept, which is what this site negotiates on", () => {
    expect(VARY.split(",").map((part) => part.trim())).toContain("Accept");
  });
});
