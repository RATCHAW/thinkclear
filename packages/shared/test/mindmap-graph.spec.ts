import { describe, expect, it } from "vitest";
import {
  areLinked,
  buildTree,
  canConnect,
  descendantsOf,
  findMindmapGraphIssues,
} from "../src";

const nodes = [
  { id: "root", x: 30 },
  { id: "research", x: 20 },
  { id: "build", x: 10 },
  { id: "orphan", x: 0 },
];

describe("findMindmapGraphIssues", () => {
  it("accepts a tree and deliberately accepts disconnected fragments", () => {
    expect(
      findMindmapGraphIssues(nodes, [
        { id: "edge-1", source: "root", target: "research" },
        { id: "edge-2", source: "root", target: "build" },
      ]),
    ).toEqual([]);
  });

  it("reports duplicate identities and a missing root", () => {
    const issues = findMindmapGraphIssues(
      [{ id: "topic" }, { id: "topic" }],
      [
        { id: "same", source: "topic", target: "topic" },
        { id: "same", source: "topic", target: "topic" },
      ],
    );

    expect(issues.map(({ code }) => code)).toEqual([
      "duplicate_node_id",
      "missing_root",
      "self_edge",
      "duplicate_edge_id",
      "self_edge",
    ]);
  });

  it("reports dangling, self, and duplicate undirected connections", () => {
    const issues = findMindmapGraphIssues(
      [{ id: "root" }, { id: "topic" }],
      [
        { id: "dangling", source: "root", target: "missing" },
        { id: "self", source: "topic", target: "topic" },
        { id: "first", source: "root", target: "topic" },
        { id: "reverse", source: "topic", target: "root" },
      ],
    );

    expect(issues.map(({ code }) => code)).toEqual([
      "unknown_edge_endpoint",
      "self_edge",
      "duplicate_edge",
    ]);
  });

  it("detects the edge that closes a longer loop", () => {
    const issues = findMindmapGraphIssues(
      [{ id: "root" }, { id: "a" }, { id: "b" }],
      [
        { id: "root-a", source: "root", target: "a" },
        { id: "a-b", source: "a", target: "b" },
        { id: "b-root", source: "b", target: "root" },
      ],
    );

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ code: "cycle" });
  });
});

describe("graph navigation", () => {
  const edges = [
    { id: "root-a", source: "root", target: "a" },
    { id: "a-b", source: "a", target: "b" },
  ];

  it("finds indirect links and prevents connections within a component", () => {
    expect(areLinked(edges, "root", "b")).toBe(true);
    expect(areLinked(edges, "root", "elsewhere")).toBe(false);
    expect(canConnect(edges, "root", "b")).toBe(false);
    expect(canConnect(edges, "root", "root")).toBe(false);
    expect(canConnect(edges, "root", "elsewhere")).toBe(true);
  });

  it("indexes the root first, orders siblings, and preserves fragments", () => {
    const tree = buildTree(
      nodes,
      [
        { id: "edge-1", source: "root", target: "research" },
        { id: "edge-2", source: "root", target: "build" },
      ],
      (node) => node.x,
    );

    expect(tree.roots).toEqual(["root", "orphan"]);
    expect(tree.children.get("root")).toEqual(["build", "research"]);
    expect(tree.parent.get("build")).toBe("root");
    expect(tree.depthOf.get("research")).toBe(1);
    expect(tree.depthOf.get("orphan")).toBe(0);
  });

  it("returns descendants in breadth-first order", () => {
    const tree = buildTree(
      [{ id: "root" }, { id: "a" }, { id: "b" }, { id: "c" }],
      [
        { id: "root-a", source: "root", target: "a" },
        { id: "root-b", source: "root", target: "b" },
        { id: "a-c", source: "a", target: "c" },
      ],
    );

    expect(descendantsOf(tree, "root")).toEqual(["a", "b", "c"]);
    expect(descendantsOf(tree, "b")).toEqual([]);
  });
});
