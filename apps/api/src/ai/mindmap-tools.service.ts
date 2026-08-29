import { HttpException, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { tool, type ToolSet } from "ai";
import { z } from "zod";
import {
  buildTree,
  descendantsOf,
  MAX_NOTE_LENGTH,
  ROOT_NODE_ID,
  updateMindmapSchema,
  type MindmapEdge,
  type MindmapNode,
} from "@thinkclear/shared";
import { MindmapsService } from "../mindmaps/mindmaps.service";
import type { MindmapDocument } from "../mindmaps/mindmap.schema";

/**
 * The write path for AI-driven mindmap editing. Everything here goes through
 * `MindmapsService`, so the same guarantees hold as for the HTTP routes: every
 * query is scoped to the owner, and every write is re-validated against the
 * tree rules — a model cannot save a graph the editor could never have drawn.
 *
 * This service is deliberately independent of the chat transport: a future MCP
 * server exposing the same operations to external agents can call
 * `forOwner(userId)` (or the underlying methods) without touching HTTP.
 */
@Injectable()
export class MindmapToolsService {
  constructor(private readonly mindmaps: MindmapsService) {}

  forOwner(ownerId: string): ToolSet {
    return {
      list_mindmaps: tool({
        description:
          "List the user's mindmaps with their ids, titles, and topic counts.",
        inputSchema: z.object({}),
        execute: () =>
          this.run(async () => {
            const docs = await this.mindmaps.findAllByOwner(ownerId);
            return {
              mindmaps: docs.map((doc) => ({
                mindmapId: String(doc._id),
                title: doc.title,
                topics: doc.nodes.length,
              })),
            };
          }),
      }),

      read_mindmap: tool({
        description:
          "Read one mindmap as an indented outline. Every line carries the topic's id in [brackets]; use those ids with the editing tools. A trailing (note) marks a topic that has a note — read it with read_topic_note.",
        inputSchema: z.object({
          mindmapId: z.string().describe("The mindmap's id"),
        }),
        execute: ({ mindmapId }) =>
          this.run(async () => {
            const doc = await this.mindmaps.findOne(ownerId, mindmapId);
            return this.describe(doc);
          }),
      }),

      create_mindmap: tool({
        description:
          "Create a new mindmap. The root topic takes the mindmap's title. Optionally pass `topics` to create a whole tree under the root in one call.",
        inputSchema: z.object({
          title: titleSchema.describe("Mindmap title, becomes the root topic"),
          topics: z
            .array(topicSchema(4))
            .max(50)
            .optional()
            .describe(
              "Top-level topics under the root, each with optional nested children",
            ),
        }),
        execute: ({ title, topics }) =>
          this.run(async () => {
            const doc = await this.mindmaps.create(ownerId, title);
            if (!topics?.length) {
              return { summary: `Created "${title}"`, ...this.describe(doc) };
            }
            const updated = await this.appendTopics(
              ownerId,
              doc,
              ROOT_NODE_ID,
              topics,
            );
            return {
              summary: `Created "${title}" with ${updated.doc.nodes.length - 1} topics`,
              ...this.describe(updated.doc),
            };
          }),
      }),

      rename_mindmap: tool({
        description:
          "Rename a mindmap. Also renames its root topic, which always mirrors the mindmap's title.",
        inputSchema: z.object({
          mindmapId: z.string(),
          title: titleSchema,
        }),
        execute: ({ mindmapId, title }) =>
          this.run(async () => {
            const doc = await this.mindmaps.findOne(ownerId, mindmapId);
            const nodes = plainNodes(doc).map((node) =>
              node.id === ROOT_NODE_ID ? { ...node, title } : node,
            );
            const updated = await this.save(ownerId, mindmapId, {
              title,
              nodes,
              edges: plainEdges(doc),
            });
            return {
              summary: `Renamed to "${title}"`,
              ...this.describe(updated),
            };
          }),
      }),

      delete_mindmap: tool({
        description:
          "Permanently delete a mindmap and everything in it. Destructive and irreversible — only call after the user has explicitly confirmed the deletion in this conversation.",
        inputSchema: z.object({
          mindmapId: z.string(),
        }),
        execute: ({ mindmapId }) =>
          this.run(async () => {
            const doc = await this.mindmaps.findOne(ownerId, mindmapId);
            await this.mindmaps.remove(ownerId, mindmapId);
            return {
              summary: `Deleted "${doc.title}"`,
              deleted: true,
              mindmapId,
            };
          }),
      }),

      add_topics: tool({
        description:
          "Add topics (optionally with nested children) under an existing topic of a mindmap. Use parentId 'root' for top-level topics.",
        inputSchema: z.object({
          mindmapId: z.string(),
          parentId: z
            .string()
            .describe("Id of the topic to attach the new topics under"),
          topics: z.array(topicSchema(4)).min(1).max(50),
        }),
        execute: ({ mindmapId, parentId, topics }) =>
          this.run(async () => {
            const doc = await this.mindmaps.findOne(ownerId, mindmapId);
            if (!doc.nodes.some((node) => node.id === parentId)) {
              return {
                error: `No topic with id "${parentId}" in this mindmap. Call read_mindmap to see the current topics and their ids.`,
              };
            }
            const updated = await this.appendTopics(
              ownerId,
              doc,
              parentId,
              topics,
            );
            return {
              summary: `Added ${updated.created} topic${updated.created === 1 ? "" : "s"}`,
              ...this.describe(updated.doc),
            };
          }),
      }),

      rename_topic: tool({
        description:
          "Rename one topic. Renaming the root topic also renames the mindmap itself.",
        inputSchema: z.object({
          mindmapId: z.string(),
          nodeId: z.string(),
          title: titleSchema,
        }),
        execute: ({ mindmapId, nodeId, title }) =>
          this.run(async () => {
            const doc = await this.mindmaps.findOne(ownerId, mindmapId);
            if (!doc.nodes.some((node) => node.id === nodeId)) {
              return { error: `No topic with id "${nodeId}" in this mindmap.` };
            }
            const nodes = plainNodes(doc).map((node) =>
              node.id === nodeId ? { ...node, title } : node,
            );
            const updated = await this.save(ownerId, mindmapId, {
              nodes,
              edges: plainEdges(doc),
              // The canvas keeps the map's title mirrored on the root topic;
              // an AI rename must go through the same coupling or they drift.
              ...(nodeId === ROOT_NODE_ID ? { title } : {}),
            });
            return {
              summary: `Renamed topic to "${title}"`,
              ...this.describe(updated),
            };
          }),
      }),

      read_topic_note: tool({
        description:
          "Read one topic's note. Topics that have a note are marked (note) in a read_mindmap outline; this returns its markdown.",
        inputSchema: z.object({
          mindmapId: z.string(),
          nodeId: z.string(),
        }),
        execute: ({ mindmapId, nodeId }) =>
          this.run(async () => {
            const doc = await this.mindmaps.findOne(ownerId, mindmapId);
            const node = doc.nodes.find((node) => node.id === nodeId);
            if (!node) {
              return { error: `No topic with id "${nodeId}" in this mindmap.` };
            }
            return {
              mindmapId,
              nodeId,
              title: node.title,
              note: node.note ?? "",
            };
          }),
      }),

      set_topic_note: tool({
        description:
          "Write a topic's note, replacing whatever it held. A note is markdown prose hanging off the topic — the paragraph, checklist, or snippet a title is too short to carry. Pass an empty string to clear it. Replacing is the whole operation: to extend an existing note, call read_topic_note first and send back the combined markdown.",
        inputSchema: z.object({
          mindmapId: z.string(),
          nodeId: z.string(),
          note: z
            .string()
            .max(MAX_NOTE_LENGTH)
            .describe("Markdown for the note, or an empty string to clear it"),
        }),
        execute: ({ mindmapId, nodeId, note }) =>
          this.run(async () => {
            const doc = await this.mindmaps.findOne(ownerId, mindmapId);
            const target = doc.nodes.find((node) => node.id === nodeId);
            if (!target) {
              return { error: `No topic with id "${nodeId}" in this mindmap.` };
            }
            const text = note.trim();
            const nodes = plainNodes(doc).map((node) => {
              if (node.id !== nodeId) return node;
              // Cleared means gone, not empty — same rule the canvas follows,
              // so "has a note" stays a plain truthy check everywhere.
              const { note: _cleared, ...rest } = node;
              return text ? { ...rest, note: text } : rest;
            });
            const updated = await this.save(ownerId, mindmapId, {
              nodes,
              edges: plainEdges(doc),
            });
            return {
              summary: text
                ? `Wrote a note on "${target.title}"`
                : `Cleared the note on "${target.title}"`,
              ...this.describe(updated),
            };
          }),
      }),

      move_topic: tool({
        description:
          "Move a topic (with its whole branch) under a different parent topic.",
        inputSchema: z.object({
          mindmapId: z.string(),
          nodeId: z.string().describe("The topic to move"),
          newParentId: z.string().describe("The topic to move it under"),
        }),
        execute: ({ mindmapId, nodeId, newParentId }) =>
          this.run(async () => {
            const doc = await this.mindmaps.findOne(ownerId, mindmapId);
            const nodes = plainNodes(doc);
            const edges = plainEdges(doc);
            for (const id of [nodeId, newParentId]) {
              if (!nodes.some((node) => node.id === id)) {
                return { error: `No topic with id "${id}" in this mindmap.` };
              }
            }
            if (nodeId === ROOT_NODE_ID) {
              return { error: "The root topic cannot be moved." };
            }
            const tree = buildTree(nodes, edges, byX);
            if (
              nodeId === newParentId ||
              descendantsOf(tree, nodeId).includes(newParentId)
            ) {
              return {
                error: `Cannot move "${nodeId}" under its own branch — that would create a loop.`,
              };
            }
            const parent = tree.parent.get(nodeId);
            const nextEdges = edges.filter(
              (edge) =>
                !(
                  (edge.source === nodeId && edge.target === parent) ||
                  (edge.source === parent && edge.target === nodeId)
                ),
            );
            nextEdges.push({
              id: randomUUID(),
              source: newParentId,
              target: nodeId,
            });
            const updated = await this.save(ownerId, mindmapId, {
              nodes,
              edges: nextEdges,
            });
            return { summary: "Moved topic", ...this.describe(updated) };
          }),
      }),

      delete_topics: tool({
        description:
          "Delete topics from a mindmap. Each deleted topic takes its whole branch (all nested children) with it. The root topic cannot be deleted.",
        inputSchema: z.object({
          mindmapId: z.string(),
          nodeIds: z.array(z.string()).min(1).max(100),
        }),
        execute: ({ mindmapId, nodeIds }) =>
          this.run(async () => {
            const doc = await this.mindmaps.findOne(ownerId, mindmapId);
            const nodes = plainNodes(doc);
            const edges = plainEdges(doc);
            if (nodeIds.includes(ROOT_NODE_ID)) {
              return {
                error:
                  "The root topic cannot be deleted. To remove the whole mindmap, use delete_mindmap instead.",
              };
            }
            const missing = nodeIds.filter(
              (id) => !nodes.some((node) => node.id === id),
            );
            if (missing.length) {
              return {
                error: `No topic with id ${missing.map((id) => `"${id}"`).join(", ")} in this mindmap.`,
              };
            }
            const tree = buildTree(nodes, edges, byX);
            const doomed = new Set<string>();
            for (const id of nodeIds) {
              doomed.add(id);
              for (const kid of descendantsOf(tree, id)) doomed.add(kid);
            }
            const updated = await this.save(ownerId, mindmapId, {
              nodes: nodes.filter((node) => !doomed.has(node.id)),
              edges: edges.filter(
                (edge) => !doomed.has(edge.source) && !doomed.has(edge.target),
              ),
            });
            return {
              summary: `Deleted ${doomed.size} topic${doomed.size === 1 ? "" : "s"}`,
              ...this.describe(updated),
            };
          }),
      }),
    };
  }

  /**
   * Appends a (possibly nested) batch of topics under `parentId` and persists
   * the merged graph in one write. Positions are only sibling-order hints —
   * the canvas lays the tree out from scratch — so new topics just need to
   * land to the right of their siblings on the right row.
   */
  private async appendTopics(
    ownerId: string,
    doc: MindmapDocument,
    parentId: string,
    topics: NewTopic[],
  ): Promise<{ doc: MindmapDocument; created: number }> {
    const nodes = plainNodes(doc);
    const edges = plainEdges(doc);
    const tree = buildTree(nodes, edges, byX);
    const depthOf = new Map(tree.depthOf);
    const insert = (parent: string, children: NewTopic[]) => {
      const depth = (depthOf.get(parent) ?? 0) + 1;
      let cursor = Math.max(
        nodes.find((node) => node.id === parent)?.x ?? 0,
        ...(tree.children.get(parent) ?? []).map(
          (id) => nodes.find((node) => node.id === id)?.x ?? 0,
        ),
      );
      for (const child of children) {
        cursor += 200;
        const id = randomUUID();
        nodes.push({
          id,
          title: child.title,
          x: cursor,
          y: depth * 104,
        });
        edges.push({ id: randomUUID(), source: parent, target: id });
        depthOf.set(id, depth);
        if (child.children?.length) insert(id, child.children);
      }
    };
    const before = nodes.length;
    insert(parentId, topics);
    const updated = await this.save(ownerId, String(doc._id), {
      nodes,
      edges,
    });
    return { doc: updated, created: nodes.length - before };
  }

  /**
   * Persists through the same schema the HTTP route validates with, so the
   * caps (500 nodes / 1000 edges) and shape rules apply to AI writes too;
   * `MindmapsService.update` then re-checks the tree invariants.
   */
  private save(
    ownerId: string,
    mindmapId: string,
    input: { title?: string; nodes: MindmapNode[]; edges: MindmapEdge[] },
  ): Promise<MindmapDocument> {
    return this.mindmaps.update(
      ownerId,
      mindmapId,
      updateMindmapSchema.parse(input),
    );
  }

  /** Compact, model-readable snapshot of a mindmap. */
  private describe(doc: MindmapDocument) {
    const nodes = plainNodes(doc);
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const tree = buildTree(nodes, plainEdges(doc), byX);
    const lines: string[] = [];
    const walk = (id: string, depth: number) => {
      const node = byId.get(id);
      if (!node) return;
      // Notes are marked rather than inlined: a map where every topic carries
      // a paragraph would push the actual tree out of the model's attention,
      // and read_topic_note is one call away for the ones that matter.
      lines.push(
        `${"  ".repeat(depth)}- ${node.title} [${node.id}]${node.note ? " (note)" : ""}`,
      );
      for (const kid of tree.children.get(id) ?? []) walk(kid, depth + 1);
    };
    for (const root of tree.roots) walk(root, 0);
    return {
      mindmapId: String(doc._id),
      title: doc.title,
      topics: nodes.length,
      outline: lines.join("\n"),
    };
  }

  /**
   * Tool errors go back to the model as data instead of throwing: a 400 from
   * the graph check carries the full issue list, which is exactly what the
   * model needs to repair its edit — same design as the HTTP route, one
   * round trip with every problem listed.
   */
  private async run<T extends object>(
    fn: () => Promise<T>,
  ): Promise<T | { error: string; issues?: unknown }> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          error: "The edit failed validation.",
          issues: error.issues.map((issue) => issue.message),
        };
      }
      if (error instanceof HttpException) {
        const response = error.getResponse();
        const details =
          typeof response === "object" && response !== null
            ? (response as { message?: unknown; issues?: unknown })
            : {};
        return {
          error:
            typeof details.message === "string"
              ? details.message
              : error.message,
          ...(details.issues ? { issues: details.issues } : {}),
        };
      }
      throw error;
    }
  }
}

const titleSchema = z.string().trim().min(1).max(200);

type NewTopic = { title: string; children?: NewTopic[] };

/**
 * Nested topic input, capped at a fixed depth instead of using a recursive
 * schema — the JSON Schema sent to the model stays plain nesting with no
 * $refs, which every provider handles.
 */
function topicSchema(depth: number): z.ZodType<NewTopic> {
  if (depth === 0) {
    return z.object({ title: titleSchema });
  }
  return z.object({
    title: titleSchema,
    children: z
      .array(topicSchema(depth - 1))
      .max(50)
      .optional(),
  });
}

/** Same sibling ranking the canvas layout uses: left to right by x. */
const byX = (node: { x: number }) => node.x;

function plainNodes(doc: MindmapDocument): MindmapNode[] {
  return doc.nodes.map(({ id, title, x, y, note }) => ({
    id,
    title,
    x,
    y,
    // Carried through rather than dropped: every tool here reads the document
    // and writes the whole node array back, so a field missing from this map
    // is a field the next rename erases.
    ...(note ? { note } : {}),
  }));
}

function plainEdges(doc: MindmapDocument): MindmapEdge[] {
  return doc.edges.map(({ id, source, target }) => ({ id, source, target }));
}
