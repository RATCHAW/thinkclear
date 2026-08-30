import { Test } from "@nestjs/testing";
import { tool } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { AuthInfo } from "@modelcontextprotocol/server";
import { MindmapToolsService } from "../src/ai/mindmap-tools.service";
import { McpService } from "../src/mcp/mcp.service";

const ownerId = "user-123";

/**
 * Stands in for `MindmapToolsService` with three real AI SDK tools — one read,
 * one write, one that fails — so the adapter is exercised against the shape it
 * actually consumes rather than against a hand-rolled imitation of it.
 */
function toolSet(spy: (name: string) => void) {
  return {
    list_mindmaps: tool({
      description: "List the user's mindmaps.",
      inputSchema: z.object({}),
      execute: () => {
        spy("list_mindmaps");
        return Promise.resolve({ mindmaps: [{ mindmapId: "m1" }] });
      },
    }),
    create_mindmap: tool({
      description: "Create a new mindmap.",
      inputSchema: z.object({ title: z.string() }),
      execute: ({ title }) => {
        spy("create_mindmap");
        return Promise.resolve({ summary: `Created "${title}"` });
      },
    }),
    delete_mindmap: tool({
      description: "Delete a mindmap.",
      inputSchema: z.object({ mindmapId: z.string() }),
      execute: () => {
        spy("delete_mindmap");
        return Promise.resolve({ error: "Mindmap not found" });
      },
    }),
  };
}

describe("MCP server", () => {
  const executed = vi.fn();
  const tools = { forOwner: vi.fn(() => toolSet(executed)) };
  let mcp: McpService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        McpService,
        { provide: MindmapToolsService, useValue: tools },
      ],
    }).compile();
    mcp = moduleRef.get(McpService);
  });

  const call = (method: string, params?: object, scopes = BOTH_SCOPES) =>
    rpc(mcp, authInfo(scopes), method, params);

  it("serves the mindmap tools to a client holding both scopes", async () => {
    const result = await call("tools/list");

    expect(names(result)).toEqual([
      "create_mindmap",
      "delete_mindmap",
      "list_mindmaps",
    ]);
    expect(tools.forOwner).toHaveBeenCalledWith(ownerId);
  });

  it("hides the writing tools from a read-only token", async () => {
    const result = await call("tools/list", undefined, ["mindmaps:read"]);

    // Scope is enforced by omission: a client whose model never sees a delete
    // never plans a call that was only ever going to be refused.
    expect(names(result)).toEqual(["list_mindmaps"]);
  });

  it("advertises the tools a client would want to confirm before running", async () => {
    const result = await call("tools/list");
    const annotations = Object.fromEntries(
      (result.tools as ToolListing[]).map((entry) => [
        entry.name,
        entry.annotations,
      ]),
    );

    expect(annotations.list_mindmaps).toMatchObject({ readOnlyHint: true });
    expect(annotations.delete_mindmap).toMatchObject({
      readOnlyHint: false,
      destructiveHint: true,
    });
    expect(annotations.create_mindmap).toMatchObject({
      destructiveHint: false,
    });
  });

  it("runs a tool and returns what it produced", async () => {
    const result = await call("tools/call", {
      name: "create_mindmap",
      arguments: { title: "Roadmap" },
    });

    expect(executed).toHaveBeenCalledWith("create_mindmap");
    expect(result.isError).toBeFalsy();
    expect(JSON.parse(text(result))).toEqual({ summary: 'Created "Roadmap"' });
  });

  it("hands a failed edit back as a tool error the caller's model can repair from", async () => {
    const result = await call("tools/call", {
      name: "delete_mindmap",
      arguments: { mindmapId: "nope" },
    });

    expect(result.isError).toBe(true);
    expect(text(result)).toContain("Mindmap not found");
  });

  it("has no tool to call for a scope the token was not granted", async () => {
    // Not "permission denied" — the tool is not on this server instance at
    // all, so a read-only client naming it gets the same answer it would get
    // for a tool that never existed.
    await expect(
      call("tools/call", { name: "delete_mindmap", arguments: {} }, [
        "mindmaps:read",
      ]),
    ).rejects.toThrow("delete_mindmap not found");
    expect(executed).not.toHaveBeenCalled();
  });

  it("validates arguments before the tool runs", async () => {
    const result = await call("tools/call", {
      name: "create_mindmap",
      arguments: { title: 42 },
    });

    expect(executed).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
  });

  it("acts for the user the token names, not for whoever asked first", async () => {
    await call("tools/list");
    await rpc(
      mcp,
      { ...authInfo(BOTH_SCOPES), extra: { userId: "user-456" } },
      "tools/list",
    );

    // A fresh server per request is what makes this safe: the owner is read
    // off each request's token rather than captured once at startup.
    expect(tools.forOwner.mock.calls).toEqual([["user-123"], ["user-456"]]);
  });
});

/**
 * The same server over the *real* tool set, so what an agent client actually
 * gets is checked against the tools as written rather than against a fixture
 * that can drift from them.
 *
 * The scope split is derived, not listed — from `MUTATING_CHAT_TOOLS` — which
 * makes this the test that catches a new tool arriving without anyone deciding
 * where it belongs. Notes are the case in point: `read_topic_note` and
 * `set_topic_note` were added for the assistant and reached MCP with no change
 * here, and the only thing worth proving is that they landed on the right
 * sides of the line.
 */
describe("MCP over the real mindmap tools", () => {
  const stored = {
    _id: "507f1f77bcf86cd799439011",
    ownerId,
    title: "Roadmap",
    nodes: [
      { id: "root", title: "Roadmap", x: 0, y: 0 },
      {
        id: "backend",
        title: "Backend",
        x: 0,
        y: 104,
        note: "# Plan\nships Q3",
      },
    ],
    edges: [{ id: "e1", source: "root", target: "backend" }],
  };
  const mindmaps = {
    create: vi.fn(),
    findAllByOwner: vi.fn(),
    findOne: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };
  let mcp: McpService;

  beforeEach(() => {
    vi.clearAllMocks();
    mindmaps.findOne.mockResolvedValue(stored);
    mindmaps.update.mockImplementation((_owner, _id, input) =>
      Promise.resolve({ ...stored, ...input }),
    );
    mcp = new McpService(new MindmapToolsService(mindmaps as never));
  });

  const call = (method: string, params?: object, scopes = BOTH_SCOPES) =>
    rpc(mcp, authInfo(scopes), method, params);

  it("serves the whole tool surface, notes included", async () => {
    expect(names(await call("tools/list"))).toEqual([
      "add_topics",
      "create_mindmap",
      "delete_mindmap",
      "delete_topics",
      "list_mindmaps",
      "move_topics",
      "read_mindmap",
      "read_topic_note",
      "rename_mindmap",
      "rename_topics",
      "search_topics",
      "set_topic_note",
    ]);
  });

  it("lets a read-only token read and search notes but not write them", async () => {
    expect(
      names(await call("tools/list", undefined, ["mindmaps:read"])),
    ).toEqual([
      "list_mindmaps",
      "read_mindmap",
      "read_topic_note",
      "search_topics",
    ]);
  });

  it("warns that writing a note replaces what was there", async () => {
    const annotations = new Map(
      ((await call("tools/list")).tools ?? []).map((entry) => [
        entry.name,
        entry.annotations,
      ]),
    );

    // A note can be paragraphs the user typed; overwriting one unasked is the
    // kind of loss a client should be able to put a confirmation in front of.
    expect(annotations.get("set_topic_note")).toMatchObject({
      readOnlyHint: false,
      destructiveHint: true,
    });
    expect(annotations.get("read_topic_note")).toMatchObject({
      readOnlyHint: true,
    });
    // Adding topics takes nothing away.
    expect(annotations.get("add_topics")).toMatchObject({
      destructiveHint: false,
    });
  });

  it("reads a topic's note through to the document", async () => {
    const result = await call("tools/call", {
      name: "read_topic_note",
      arguments: { mindmapId: stored._id, nodeId: "backend" },
    });

    expect(result.isError).toBeFalsy();
    expect(JSON.parse(text(result))).toMatchObject({
      nodeId: "backend",
      note: "# Plan\nships Q3",
    });
    expect(mindmaps.findOne).toHaveBeenCalledWith(ownerId, stored._id);
  });

  it("writes a note as a graph save that keeps the rest of the map", async () => {
    const result = await call("tools/call", {
      name: "set_topic_note",
      arguments: {
        mindmapId: stored._id,
        nodeId: "backend",
        note: "## Rewritten",
      },
    });

    expect(result.isError).toBeFalsy();
    const [, , written] = mindmaps.update.mock.calls[0] as [
      string,
      string,
      { nodes: { id: string; note?: string }[] },
    ];
    expect(written.nodes).toEqual([
      expect.objectContaining({ id: "root" }),
      expect.objectContaining({ id: "backend", note: "## Rewritten" }),
    ]);
  });

  it("keeps a bad note edit as data the caller's model can act on", async () => {
    const result = await call("tools/call", {
      name: "set_topic_note",
      arguments: { mindmapId: stored._id, nodeId: "ghost", note: "hi" },
    });

    expect(result.isError).toBe(true);
    expect(text(result)).toContain("ghost");
    expect(mindmaps.update).not.toHaveBeenCalled();
  });
});

const BOTH_SCOPES = ["mindmaps:read", "mindmaps:write"];

function authInfo(scopes: string[]): AuthInfo {
  return {
    token: "",
    clientId: "claude-code",
    scopes,
    extra: { userId: ownerId },
  };
}

type ToolListing = { name: string; annotations?: Record<string, unknown> };
type RpcResult = {
  tools?: ToolListing[];
  isError?: boolean;
  content?: { type: string; text?: string }[];
};

function names(result: RpcResult): string[] {
  return (result.tools ?? []).map((entry) => entry.name).sort();
}

function text(result: RpcResult): string {
  return result.content?.[0]?.text ?? "";
}

/**
 * One JSON-RPC exchange against the handler, the way an MCP client makes it.
 * Stateless serving answers over SSE, so the result is dug out of the event
 * frames rather than read as a JSON body.
 */
async function rpc(
  mcp: McpService,
  auth: AuthInfo,
  method: string,
  params?: object,
): Promise<RpcResult> {
  const response = await mcp.fetch(
    new Request("http://localhost/api/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    }),
    auth,
  );

  const body = await response.text();
  const payload = response.headers
    .get("content-type")
    ?.includes("text/event-stream")
    ? JSON.parse(
        body
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trim())
          .join(""),
      )
    : JSON.parse(body);

  if (payload.error) throw new Error(JSON.stringify(payload.error));
  return payload.result as RpcResult;
}
