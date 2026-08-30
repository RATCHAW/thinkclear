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

      search_topics: tool({
        description:
          'Find topics across the user\'s mindmaps by words in their title or note. Searches every mindmap unless mindmapId narrows it to one. This is how to answer "where did I write about X": a read_mindmap outline marks which topics have notes but never contains the prose, so reading maps one by one to look for a word both misses note text and costs a call per map.',
        inputSchema: z.object({
          query: z
            .string()
            .trim()
            .min(1)
            .max(200)
            .describe(
              "Words to look for. A topic matches when its title contains all of them, or its note does.",
            ),
          mindmapId: z
            .string()
            .optional()
            .describe("Search only this mindmap; omit to search all of them"),
          includeNotes: z
            .boolean()
            .optional()
            .describe("Search note text as well as titles. Defaults to true."),
        }),
        execute: ({ query, mindmapId, includeNotes = true }) =>
          this.run(async () => {
            const docs = mindmapId
              ? [await this.mindmaps.findOne(ownerId, mindmapId)]
              : await this.mindmaps.findAllByOwner(ownerId);
            const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
            const found = docs.flatMap((doc) =>
              this.matchesIn(doc, terms, includeNotes),
            );
            const results = found.slice(0, MAX_SEARCH_RESULTS);
            const maps = new Set(found.map((match) => match.mindmapId)).size;
            // A cap that is hit says so: "50 matches" and "the first 50 of
            // 137" are different answers, and only one of them means the
            // model should narrow the query and search again.
            const capped =
              found.length > results.length
                ? `, showing the first ${MAX_SEARCH_RESULTS}`
                : "";
            return {
              summary: found.length
                ? `Found ${found.length} topic${found.length === 1 ? "" : "s"} in ${maps} mindmap${maps === 1 ? "" : "s"}${capped}`
                : `Nothing matches "${query}"`,
              query,
              results,
            };
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

      rename_topics: tool({
        description:
          "Rename topics. Retitling several at once — a prefix, a shortening, a translation — is one call, not one per topic. Renaming the root topic also renames the mindmap itself.",
        inputSchema: z.object({
          mindmapId: z.string(),
          renames: z
            .array(z.object({ nodeId: z.string(), title: titleSchema }))
            .min(1)
            .max(100)
            .describe("One entry per topic to rename"),
        }),
        execute: ({ mindmapId, renames }) =>
          this.run(async () => {
            const doc = await this.mindmaps.findOne(ownerId, mindmapId);
            const titles = new Map<string, string>();
            for (const rename of renames) {
              // Two titles for one topic is a batch built wrong. Taking the
              // last one would apply half of what was asked and say it worked.
              if (titles.has(rename.nodeId)) {
                return {
                  error: `Topic "${rename.nodeId}" is renamed twice in this call. Send one title per topic.`,
                };
              }
              titles.set(rename.nodeId, rename.title);
            }
            const missing = [...titles.keys()].filter(
              (id) => !doc.nodes.some((node) => node.id === id),
            );
            if (missing.length) {
              return {
                error: `No topic with id ${missing.map((id) => `"${id}"`).join(", ")} in this mindmap.`,
              };
            }
            const nodes = plainNodes(doc).map((node) => {
              const title = titles.get(node.id);
              return title ? { ...node, title } : node;
            });
            const rootTitle = titles.get(ROOT_NODE_ID);
            const updated = await this.save(ownerId, mindmapId, {
              nodes,
              edges: plainEdges(doc),
              // The canvas keeps the map's title mirrored on the root topic;
              // an AI rename must go through the same coupling or they drift.
              ...(rootTitle ? { title: rootTitle } : {}),
            });
            return {
              summary: `Renamed ${titles.size} topic${titles.size === 1 ? "" : "s"}`,
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

      move_topics: tool({
        description:
          "Move topics (each with its whole branch) under one different parent topic. Re-parenting several siblings at once is one call, not one per topic.",
        inputSchema: z.object({
          mindmapId: z.string(),
          nodeIds: z
            .array(z.string())
            .min(1)
            .max(100)
            .describe("The topics to move, all under the same new parent"),
          newParentId: z.string().describe("The topic to move them under"),
        }),
        execute: ({ mindmapId, nodeIds, newParentId }) =>
          this.run(async () => {
            const doc = await this.mindmaps.findOne(ownerId, mindmapId);
            const nodes = plainNodes(doc);
            const edges = plainEdges(doc);
            // A topic named twice is one move, not two edges to the same
            // parent — the second would be a duplicate connection.
            const moving = [...new Set(nodeIds)];
            const missing = [...moving, newParentId].filter(
              (id) => !nodes.some((node) => node.id === id),
            );
            if (missing.length) {
              return {
                error: `No topic with id ${missing.map((id) => `"${id}"`).join(", ")} in this mindmap.`,
              };
            }
            if (moving.includes(ROOT_NODE_ID)) {
              return { error: "The root topic cannot be moved." };
            }
            const tree = buildTree(nodes, edges, byX);
            // Checked against the tree as it stands, which is enough: every
            // move lands under the same parent, and a parent whose own
            // ancestry is being moved is caught by that ancestor's check.
            const looping = moving.filter(
              (id) =>
                id === newParentId ||
                descendantsOf(tree, id).includes(newParentId),
            );
            if (looping.length) {
              return {
                error: `Cannot move ${looping.map((id) => `"${id}"`).join(", ")} under its own branch — that would create a loop.`,
              };
            }
            // Drop each moved topic's edge to its current parent, whichever
            // way round it was drawn, and hang it off the new one instead.
            const detaches = (child: string, parent: string) =>
              moving.includes(child) && tree.parent.get(child) === parent;
            const nextEdges = edges.filter(
              (edge) =>
                !detaches(edge.target, edge.source) &&
                !detaches(edge.source, edge.target),
            );
            for (const id of moving) {
              nextEdges.push({
                id: randomUUID(),
                source: newParentId,
                target: id,
              });
            }
            const updated = await this.save(ownerId, mindmapId, {
              nodes,
              edges: nextEdges,
            });
            return {
              summary: `Moved ${moving.length} topic${moving.length === 1 ? "" : "s"}`,
              ...this.describe(updated),
            };
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
   * Every topic in one mindmap carrying all of `terms` in its title or in its
   * note, in outline order. The note half is the reason the tool exists: no
   * outline contains the prose, so a word only written in a note is otherwise
   * reachable exactly one read_topic_note at a time.
   *
   * Each match carries the trail of ancestor titles that says where in the map
   * it sits, so "which of the three 'Migration' topics is this" is answered
   * without a second read.
   */
  private matchesIn(
    doc: MindmapDocument,
    terms: string[],
    includeNotes: boolean,
  ): TopicMatch[] {
    const nodes = plainNodes(doc);
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const tree = buildTree(nodes, plainEdges(doc), byX);
    const found: TopicMatch[] = [];
    const walk = (id: string, trail: string[]) => {
      const node = byId.get(id);
      if (!node) return;
      const note = includeNotes ? (node.note ?? "") : "";
      const inTitle = holdsAll(node.title, terms);
      const inNote = note ? holdsAll(note, terms) : false;
      if (inTitle || inNote) {
        found.push({
          mindmapId: String(doc._id),
          mindmapTitle: doc.title,
          nodeId: node.id,
          title: node.title,
          matchedIn: inTitle && inNote ? "both" : inTitle ? "title" : "note",
          ...(trail.length ? { path: trail.join(" › ") } : {}),
          ...(inNote ? { noteSnippet: snippet(note, terms) } : {}),
        });
      }
      const below = [...trail, node.title];
      for (const kid of tree.children.get(id) ?? []) walk(kid, below);
    };
    for (const root of tree.roots) walk(root, []);
    return found;
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

/** One hit from `search_topics`. */
type TopicMatch = {
  mindmapId: string;
  mindmapTitle: string;
  nodeId: string;
  title: string;
  matchedIn: "title" | "note" | "both";
  /** Ancestor titles, root first. Absent on the root topic itself. */
  path?: string;
  noteSnippet?: string;
};

/**
 * A search answers with topics, not with mindmaps, so the cap is on rows and
 * a hit is one line — 50 is a list a model can act on, and the summary says
 * when there were more rather than letting the tail vanish quietly.
 */
const MAX_SEARCH_RESULTS = 50;
const SNIPPET_LENGTH = 180;
const SNIPPET_MARGIN = 60;

/** Case-insensitive "contains every word" — the whole matching rule. */
function holdsAll(text: string, terms: string[]): boolean {
  const haystack = text.toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

/**
 * A window of the note around the first word that matched. Notes run to
 * MAX_NOTE_LENGTH, so a library-wide search that returned them whole would
 * spend more context on one answer than reading the maps would have.
 */
function snippet(note: string, terms: string[]): string {
  const flat = note.replace(/\s+/g, " ").trim();
  const at = flat.toLowerCase().indexOf(terms[0]);
  const from = Math.max(0, at - SNIPPET_MARGIN);
  const to = Math.min(flat.length, from + SNIPPET_LENGTH);
  const head = from > 0 ? "…" : "";
  const tail = to < flat.length ? "…" : "";
  return head + flat.slice(from, to) + tail;
}

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
