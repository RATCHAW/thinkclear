import { BadRequestException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { findMindmapGraphIssues } from "@mindmap/shared";
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
    await tools.move_topic!.execute!(
      { mindmapId, nodeId: "db", newParentId: "root" },
      callOptions,
    );

    const [, , written] = mindmaps.update.mock.calls[0];
    expect(written.edges).toHaveLength(2);
    expect(written.edges).toContainEqual(
      expect.objectContaining({ source: "root", target: "db" }),
    );
    expect(findMindmapGraphIssues(written.nodes, written.edges)).toEqual([]);
  });

  it("refuses to move a topic into its own branch", async () => {
    const result = await tools.move_topic!.execute!(
      { mindmapId, nodeId: "backend", newParentId: "db" },
      callOptions,
    );

    expect(result).toMatchObject({
      error: expect.stringContaining("loop"),
    });
    expect(mindmaps.update).not.toHaveBeenCalled();
  });

  it("renaming the root topic renames the mindmap with it", async () => {
    await tools.rename_topic!.execute!(
      { mindmapId, nodeId: "root", title: "Master plan" },
      callOptions,
    );

    const [, , written] = mindmaps.update.mock.calls[0];
    expect(written.title).toBe("Master plan");
    expect(written.nodes).toContainEqual(
      expect.objectContaining({ id: "root", title: "Master plan" }),
    );
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
