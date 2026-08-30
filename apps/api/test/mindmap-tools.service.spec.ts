import { BadRequestException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { findMindmapGraphIssues } from "@thinkclear/shared";
import { MindmapToolsService } from "../src/ai/mindmap-tools.service";

const ownerId = "owner-1";
const mindmapId = "507f1f77bcf86cd799439011";

const storedMindmap = () => ({
  _id: mindmapId,
  ownerId,
  title: "Roadmap",
  nodes: [
    { id: "root", title: "Roadmap", x: 0, y: 0 },
    { id: "backend", title: "Backend", x: 0, y: 104 },
    { id: "db", title: "Databases", x: 0, y: 208 },
  ],
  edges: [
    { id: "e1", source: "root", target: "backend" },
    { id: "e2", source: "backend", target: "db" },
  ],
});

/** The same document with a note hanging off the "backend" topic. */
const withNote = (note: string) => {
  const doc = storedMindmap();
  return {
    ...doc,
    nodes: doc.nodes.map((node) =>
      node.id === "backend" ? { ...node, note } : node,
    ),
  };
};

/** The same document with two topics hanging off "db". */
const withChildrenOfDb = () => {
  const doc = storedMindmap();
  return {
    ...doc,
    nodes: [
      ...doc.nodes,
      { id: "sql", title: "SQL", x: 0, y: 312 },
      { id: "nosql", title: "NoSQL", x: 200, y: 312 },
    ],
    edges: [
      ...doc.edges,
      { id: "e3", source: "db", target: "sql" },
      { id: "e4", source: "db", target: "nosql" },
    ],
  };
};

/**
 * Two mindmaps: one holding a word only in a note, the other holding it only
 * in a title — the two halves of what a search has to reach.
 */
const searchable = () => [
  {
    ...storedMindmap(),
    nodes: storedMindmap().nodes.map((node) =>
      node.id === "db"
        ? {
            ...node,
            note: "The Postgres migration lands in Q2, after the\nindex rewrite.",
          }
        : node,
    ),
  },
  {
    _id: "507f1f77bcf86cd799439012",
    ownerId,
    title: "Trip",
    nodes: [
      { id: "root", title: "Trip", x: 0, y: 0 },
      { id: "gear", title: "Postgres sticker", x: 0, y: 104 },
    ],
    edges: [{ id: "e5", source: "root", target: "gear" }],
  },
];

/** Bare-bones ToolCallOptions; the tools never read it. */
const callOptions = { toolCallId: "call-1", messages: [] } as never;

describe("MindmapToolsService", () => {
  const mindmaps = {
    create: vi.fn(),
    findAllByOwner: vi.fn(),
    findOne: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };
  let tools: ReturnType<MindmapToolsService["forOwner"]>;

  beforeEach(() => {
    vi.clearAllMocks();
    mindmaps.findOne.mockResolvedValue(storedMindmap());
    // Echo the write back as the saved document, like Mongo would.
    mindmaps.update.mockImplementation((_owner, _id, input) =>
      Promise.resolve({ ...storedMindmap(), ...input }),
    );
    tools = new MindmapToolsService(mindmaps as never).forOwner(ownerId);
  });

  it("appends a nested topic tree under the parent as one valid write", async () => {
    const result = (await tools.add_topics!.execute!(
      {
        mindmapId,
        parentId: "backend",
        topics: [{ title: "APIs", children: [{ title: "REST" }] }],
      },
      callOptions,
    )) as { summary: string; outline: string };

    expect(result.summary).toBe("Added 2 topics");
    expect(result.outline).toContain("- APIs");
    expect(result.outline).toContain("  - REST");

    const [, , written] = mindmaps.update.mock.calls[0];
    expect(written.nodes).toHaveLength(5);
    expect(written.edges).toHaveLength(4);
    // What the AI writes has to satisfy the same tree rules as the editor.
    expect(findMindmapGraphIssues(written.nodes, written.edges)).toEqual([]);
  });

  it("rejects an unknown parent without writing", async () => {
    const result = await tools.add_topics!.execute!(
      { mindmapId, parentId: "ghost", topics: [{ title: "Lost" }] },
      callOptions,
    );

    expect(result).toMatchObject({ error: expect.stringContaining("ghost") });
    expect(mindmaps.update).not.toHaveBeenCalled();
  });

  it("deletes a topic together with its whole branch", async () => {
    await tools.delete_topics!.execute!(
      { mindmapId, nodeIds: ["backend"] },
      callOptions,
    );

    const [, , written] = mindmaps.update.mock.calls[0];
    expect(written.nodes.map((node: { id: string }) => node.id)).toEqual([
      "root",
    ]);
    expect(written.edges).toEqual([]);
  });

  it("refuses to delete the root topic", async () => {
    const result = await tools.delete_topics!.execute!(
      { mindmapId, nodeIds: ["root"] },
      callOptions,
    );

    expect(result).toMatchObject({
      error: expect.stringContaining("root topic cannot be deleted"),
    });
    expect(mindmaps.update).not.toHaveBeenCalled();
  });

  it("moves a topic under a new parent by re-pointing its parent edge", async () => {
    await tools.move_topics!.execute!(
      { mindmapId, nodeIds: ["db"], newParentId: "root" },
      callOptions,
    );

    const [, , written] = mindmaps.update.mock.calls[0];
    expect(written.edges).toHaveLength(2);
    expect(written.edges).toContainEqual(
      expect.objectContaining({ source: "root", target: "db" }),
    );
    expect(findMindmapGraphIssues(written.nodes, written.edges)).toEqual([]);
  });

  it("re-parents a set of siblings in one write, a repeated id counting once", async () => {
    // The shape the batch exists for: emptying a topic of its children
    // before deleting it, which used to be one call per child.
    mindmaps.findOne.mockResolvedValue(withChildrenOfDb());

    const result = (await tools.move_topics!.execute!(
      { mindmapId, nodeIds: ["sql", "nosql", "sql"], newParentId: "backend" },
      callOptions,
    )) as { summary: string };

    expect(result.summary).toBe("Moved 2 topics");
    expect(mindmaps.update).toHaveBeenCalledTimes(1);
    const [, , written] = mindmaps.update.mock.calls[0];
    expect(
      written.edges.map(
        (edge: { source: string; target: string }) =>
          `${edge.source}>${edge.target}`,
      ),
    ).toEqual(["root>backend", "backend>db", "backend>sql", "backend>nosql"]);
    expect(findMindmapGraphIssues(written.nodes, written.edges)).toEqual([]);
  });

  it("refuses the whole batch when one topic would move into its own branch", async () => {
    const result = await tools.move_topics!.execute!(
      { mindmapId, nodeIds: ["root", "backend"], newParentId: "db" },
      callOptions,
    );
    expect(result).toMatchObject({
      error: expect.stringContaining("root topic cannot be moved"),
    });

    const looped = await tools.move_topics!.execute!(
      { mindmapId, nodeIds: ["db", "backend"], newParentId: "db" },
      callOptions,
    );
    expect(looped).toMatchObject({ error: expect.stringContaining("loop") });
    expect(mindmaps.update).not.toHaveBeenCalled();
  });

  it("renaming the root topic renames the mindmap with it", async () => {
    await tools.rename_topics!.execute!(
      { mindmapId, renames: [{ nodeId: "root", title: "Master plan" }] },
      callOptions,
    );

    const [, , written] = mindmaps.update.mock.calls[0];
    expect(written.title).toBe("Master plan");
    expect(written.nodes).toContainEqual(
      expect.objectContaining({ id: "root", title: "Master plan" }),
    );
  });

  it("retitles a batch of topics in one write, and leaves the map's title alone", async () => {
    const result = (await tools.rename_topics!.execute!(
      {
        mindmapId,
        renames: [
          { nodeId: "backend", title: "Q1: Backend" },
          { nodeId: "db", title: "Q1: Databases" },
        ],
      },
      callOptions,
    )) as { summary: string };

    expect(result.summary).toBe("Renamed 2 topics");
    expect(mindmaps.update).toHaveBeenCalledTimes(1);
    const [, , written] = mindmaps.update.mock.calls[0];
    expect(written.title).toBeUndefined();
    expect(written.nodes.map((node: { title: string }) => node.title)).toEqual([
      "Roadmap",
      "Q1: Backend",
      "Q1: Databases",
    ]);
  });

  it("refuses a batch that renames one topic twice, or names a topic that is gone", async () => {
    const twice = await tools.rename_topics!.execute!(
      {
        mindmapId,
        renames: [
          { nodeId: "db", title: "Storage" },
          { nodeId: "db", title: "Persistence" },
        ],
      },
      callOptions,
    );
    expect(twice).toMatchObject({ error: expect.stringContaining("twice") });

    const ghost = await tools.rename_topics!.execute!(
      {
        mindmapId,
        renames: [
          { nodeId: "db", title: "Storage" },
          { nodeId: "ghost", title: "Lost" },
        ],
      },
      callOptions,
    );
    expect(ghost).toMatchObject({ error: expect.stringContaining("ghost") });
    expect(mindmaps.update).not.toHaveBeenCalled();
  });

  it("carries topic notes through an edit that has nothing to do with them", async () => {
    // Every tool here reads the document and writes the whole node array
    // back, so any field the read forgets is a field the next edit erases.
    mindmaps.findOne.mockResolvedValue(withNote("Ship the **API** first."));

    await tools.rename_topics!.execute!(
      { mindmapId, renames: [{ nodeId: "root", title: "Master plan" }] },
      callOptions,
    );

    const [, , written] = mindmaps.update.mock.calls[0];
    expect(written.nodes).toContainEqual(
      expect.objectContaining({
        id: "backend",
        note: "Ship the **API** first.",
      }),
    );
  });

  it("writes a topic's note, and clears it back to absent", async () => {
    const result = (await tools.set_topic_note!.execute!(
      { mindmapId, nodeId: "backend", note: "  # Plan\n\n- REST  " },
      callOptions,
    )) as { summary: string; outline: string };

    expect(result.summary).toBe('Wrote a note on "Backend"');
    const [, , written] = mindmaps.update.mock.calls[0];
    expect(written.nodes).toContainEqual(
      expect.objectContaining({ id: "backend", note: "# Plan\n\n- REST" }),
    );
    // The outline flags which topics carry one without spending context on
    // the prose itself.
    expect(result.outline).toContain("- Backend [backend] (note)");
    expect(result.outline).toContain("- Roadmap [root]\n");

    mindmaps.findOne.mockResolvedValue(withNote("# Plan"));
    await tools.set_topic_note!.execute!(
      { mindmapId, nodeId: "backend", note: "" },
      callOptions,
    );

    const [, , cleared] = mindmaps.update.mock.calls[1];
    expect(cleared.nodes).toContainEqual({
      id: "backend",
      title: "Backend",
      x: 0,
      y: 104,
    });
  });

  it("reads a topic's note back, and reports an unknown topic without writing", async () => {
    mindmaps.findOne.mockResolvedValue(withNote("# Plan"));

    await expect(
      tools.read_topic_note!.execute!(
        { mindmapId, nodeId: "backend" },
        callOptions,
      ),
    ).resolves.toMatchObject({ nodeId: "backend", note: "# Plan" });

    // A topic with no note reads as empty rather than as an error.
    await expect(
      tools.read_topic_note!.execute!({ mindmapId, nodeId: "db" }, callOptions),
    ).resolves.toMatchObject({ note: "" });

    await expect(
      tools.set_topic_note!.execute!(
        { mindmapId, nodeId: "ghost", note: "Lost" },
        callOptions,
      ),
    ).resolves.toMatchObject({ error: expect.stringContaining("ghost") });
    expect(mindmaps.update).not.toHaveBeenCalled();
  });

  it("searches prose that no outline contains, and says where it sits", async () => {
    mindmaps.findAllByOwner.mockResolvedValue(searchable());

    const result = (await tools.search_topics!.execute!(
      { query: "Postgres migration" },
      callOptions,
    )) as { summary: string; results: Record<string, string>[] };

    // "Postgres sticker" in the other map has the first word and not the
    // second, so every word has to land in the same topic.
    expect(result.summary).toBe("Found 1 topic in 1 mindmap");
    expect(result.results).toEqual([
      {
        mindmapId,
        mindmapTitle: "Roadmap",
        nodeId: "db",
        title: "Databases",
        matchedIn: "note",
        path: "Roadmap › Backend",
        noteSnippet:
          "The Postgres migration lands in Q2, after the index rewrite.",
      },
    ]);
  });

  it("searches every mindmap at once, by title and by note", async () => {
    mindmaps.findAllByOwner.mockResolvedValue(searchable());

    const result = (await tools.search_topics!.execute!(
      { query: "postgres" },
      callOptions,
    )) as { summary: string; results: { nodeId: string; matchedIn: string }[] };

    expect(result.summary).toBe("Found 2 topics in 2 mindmaps");
    expect(
      result.results.map((match) => [match.nodeId, match.matchedIn]),
    ).toEqual([
      ["db", "note"],
      ["gear", "title"],
    ]);
  });

  it("narrows to one mindmap, and can be told to leave notes out", async () => {
    mindmaps.findOne.mockResolvedValue(searchable()[0]);

    const scoped = (await tools.search_topics!.execute!(
      { query: "postgres", mindmapId },
      callOptions,
    )) as { results: unknown[] };

    expect(mindmaps.findAllByOwner).not.toHaveBeenCalled();
    expect(scoped.results).toHaveLength(1);

    const titlesOnly = (await tools.search_topics!.execute!(
      { query: "postgres", mindmapId, includeNotes: false },
      callOptions,
    )) as { summary: string; results: unknown[] };

    expect(titlesOnly.results).toEqual([]);
    expect(titlesOnly.summary).toBe('Nothing matches "postgres"');
  });

  it("creates a mindmap with a whole topic tree in one call", async () => {
    const created = {
      ...storedMindmap(),
      nodes: [{ id: "root", title: "Trip", x: 0, y: 0 }],
      edges: [],
      title: "Trip",
    };
    mindmaps.create.mockResolvedValue(created);
    mindmaps.findOne.mockResolvedValue(created);

    const result = (await tools.create_mindmap!.execute!(
      { title: "Trip", topics: [{ title: "Packing" }, { title: "Route" }] },
      callOptions,
    )) as { summary: string };

    expect(mindmaps.create).toHaveBeenCalledWith(ownerId, "Trip");
    expect(result.summary).toBe('Created "Trip" with 2 topics');
    const [, , written] = mindmaps.update.mock.calls[0];
    expect(findMindmapGraphIssues(written.nodes, written.edges)).toEqual([]);
  });

  it("returns service errors to the model as data instead of throwing", async () => {
    mindmaps.findOne.mockRejectedValue(
      new NotFoundException("Mindmap not found"),
    );

    await expect(
      tools.read_mindmap!.execute!({ mindmapId }, callOptions),
    ).resolves.toMatchObject({ error: "Mindmap not found" });

    mindmaps.findOne.mockResolvedValue(storedMindmap());
    mindmaps.update.mockRejectedValue(
      new BadRequestException({
        message: "Invalid mindmap graph",
        issues: [{ code: "cycle", message: "loop" }],
      }),
    );
    await expect(
      tools.add_topics!.execute!(
        { mindmapId, parentId: "root", topics: [{ title: "X" }] },
        callOptions,
      ),
    ).resolves.toMatchObject({
      error: "Invalid mindmap graph",
      issues: [{ code: "cycle", message: "loop" }],
    });
  });

  it("asks the user to confirm before deleting a mindmap, then deletes", async () => {
    const result = await tools.delete_mindmap!.execute!(
      { mindmapId },
      callOptions,
    );

    // The confirmation lives in the tool description + system prompt; the
    // execution itself is scoped through the service like everything else.
    expect(mindmaps.remove).toHaveBeenCalledWith(ownerId, mindmapId);
    expect(result).toMatchObject({ deleted: true, mindmapId });
    expect(tools.delete_mindmap!.description).toContain("confirmed");
  });
});
