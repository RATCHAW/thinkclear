import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  Background,
  BackgroundVariant,
  BaseEdge,
  ConnectionMode,
  Controls,
  EdgeLabelRenderer,
  getSmoothStepPath,
  Handle,
  NodeToolbar,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeProps,
  type FinalConnectionState,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { animate, useReducedMotion } from "motion/react";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  buildTree,
  canConnect,
  descendantsOf,
  ROOT_NODE_ID,
} from "@mindmap/shared";
import { cn } from "@/lib/utils";
import {
  useActiveMindmap,
  useSaveMindmapGraph,
  type Mindmap,
} from "@/hooks/use-mindmaps";

/** How long the canvas stays quiet after the last change before persisting. */
const AUTOSAVE_MS = 800;

/** How long the outgoing map dissolves for before the next one is mounted. */
const SWITCH_OUT_MS = 140;
/** How long the tree takes to glide from one layout to the next. */
const RELAYOUT_MS = 260;
/** Gap between successive topics fading in after an assistant edit. */
const TOPIC_STAGGER_MS = 45;
/** Cap on that stagger, so a twenty-topic branch doesn't take a second. */
const TOPIC_STAGGER_STEPS = 5;
/** How long the viewport takes to reframe around an assistant edit. */
const REFRAME_MS = 300;
/** `--ease-in-out-strong`: movement across the screen, per DESIGN.md › Motion. */
const EASE_IN_OUT_STRONG = [0.77, 0, 0.175, 1] as const;

// The canvas borrows roadmap.sh's palette instead of DESIGN.md: yellow title
// pills over blue connectors is the entire visual identity of the reference,
// and it reads as content on the white canvas rather than as app chrome.
const EDGE_COLOR = "#2b78e4";
const EDGE_STYLE = { stroke: EDGE_COLOR, strokeWidth: 2 };

type TopicNode = Node<
  {
    title: string;
    startEditing?: boolean;
    /**
     * Set on topics an external edit added. They render invisible while
     * `"pending"` and fade in when the relayout that made room for them
     * releases them to `"in"` — see `MindmapEditor`'s layout effect.
     */
    enter?: "pending" | "in";
    enterDelay?: number;
  },
  "topic"
>;

export function MindmapCanvas() {
  const activeMindmap = useActiveMindmap();
  // Swapping in the next map is deferred by one dissolve: the outgoing canvas
  // fades out first, so a switch is something the user watches happen rather
  // than a frame in which the whole page is a different mindmap.
  const [shown, setShown] = useState(activeMindmap);
  useEffect(() => {
    if (activeMindmap?._id === shown?._id) {
      // Same map, newer document — an autosave response or an assistant edit.
      // The editor needs that one immediately; only a *switch* waits.
      if (activeMindmap !== shown) setShown(activeMindmap);
      return;
    }
    // Nothing on screen to dissolve — the first map of the session arrives
    // straight into its own fade-in.
    if (!shown) {
      setShown(activeMindmap);
      return;
    }
    const timer = window.setTimeout(
      () => setShown(activeMindmap),
      SWITCH_OUT_MS,
    );
    return () => window.clearTimeout(timer);
  }, [activeMindmap, shown]);
  const leaving = Boolean(shown) && activeMindmap?._id !== shown?._id;

  return (
    // Keyed by id so switching mindmaps remounts the editor — its React Flow
    // state is initialized once from the fetched document and then owned
    // locally, which is what keeps background refetches from clobbering an
    // edit in progress — and so the fade-in replays for the arriving map.
    <div
      key={shown?._id ?? "empty"}
      className={cn(
        "h-full w-full",
        leaving ? "animate-canvas-out" : "animate-canvas-in",
      )}
    >
      {shown ? (
        <ReactFlowProvider key={shown._id}>
          <MindmapEditor mindmap={shown} />
        </ReactFlowProvider>
      ) : (
        // The idle backdrop behind the "No mindmap open" overlay.
        <ReactFlow nodes={[]} edges={[]}>
          <Background variant={BackgroundVariant.Dots} gap={24} />
        </ReactFlow>
      )}
    </div>
  );
}

const nodeTypes = { topic: TopicNodeView };
const edgeTypes = { topic: TopicEdgeView };

function MindmapEditor({ mindmap }: { mindmap: Mindmap }) {
  const { screenToFlowPosition, fitView } = useReactFlow();
  const reduceMotion = Boolean(useReducedMotion());
  const [nodes, setNodes, onNodesChange] = useNodesState(toFlowNodes(mindmap));
  const [edges, setEdges, onEdgesChange] = useEdgesState(toFlowEdges(mindmap));
  const save = useSaveMindmapGraph();
  // `mutate` is referentially stable while the `save` object is not; closing
  // over the object would rebuild `flush` (and re-arm the autosave effect)
  // every time a save starts or settles.
  const saveGraph = save.mutate;

  // -- Autosave ------------------------------------------------------------
  // Every change lands in `pending`; the debounce timer flushes it as one
  // PATCH. Refs rather than state because none of this should re-render the
  // canvas, and the unmount flush must see the latest values.
  const pending = useRef<{ title?: string } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const graph = useRef({ nodes, edges });
  useLayoutEffect(() => {
    graph.current = { nodes, edges };
  }, [nodes, edges]);
  // The map title the server currently has. Root renames move it; comparing
  // against it keeps autosave from re-sending a stale root title over a
  // rename made in the library sheet.
  const syncedTitle = useRef(rootTitle(toFlowNodes(mindmap)) ?? mindmap.title);
  // The `updatedAt` this editor's local state corresponds to: the document it
  // seeded from, advanced by every save it makes itself. When the prop's
  // `updatedAt` moves past it, someone else wrote — see the reconcile effect.
  const syncedAt = useRef(mindmap.updatedAt);
  // Where the running relayout is headed, while it is running. A save that
  // lands mid-glide (the unmount flush, when a map is closed a few frames
  // after an edit) must persist those positions rather than the interpolated
  // ones — half-travelled x values can order siblings differently on reload.
  const settling = useRef<Map<string, { x: number; y: number }> | null>(null);

  const flush = useCallback(() => {
    if (!pending.current) return;
    const { title } = pending.current;
    pending.current = null;
    const { nodes, edges } = graph.current;
    const settled = settling.current;
    saveGraph(
      {
        id: mindmap._id,
        nodes: nodes.map((node) => ({
          id: node.id,
          title: node.data.title,
          x: settled?.get(node.id)?.x ?? node.position.x,
          y: settled?.get(node.id)?.y ?? node.position.y,
        })),
        edges: edges.map(({ id, source, target }) => ({ id, source, target })),
        ...(title ? { title } : {}),
      },
      {
        onSuccess: (updated) => {
          if (updated) syncedAt.current = updated.updatedAt;
        },
      },
    );
  }, [mindmap._id, saveGraph]);

  // -- External edits ------------------------------------------------------
  // The AI chat (and, later, MCP clients) write to Mongo server-side, so the
  // seed-once rule gets one exception: when the fetched document's updatedAt
  // is one this editor didn't produce, the server has a newer graph than the
  // canvas. Local state reseeds from it and any pending autosave is dropped —
  // otherwise the debounced PATCH would overwrite the external edit with the
  // stale local graph a moment later.
  //
  // Such an edit is also the one change the user did not make with their own
  // hands, so it is the one that has to be legible: topics it added are held
  // invisible until the relayout below has opened a gap for them (nobody
  // should watch a topic slide over from the position the tool seeded it at),
  // and if the tree grew or shrank the viewport reframes around the result.
  const reframe = useRef(false);
  useEffect(() => {
    if (mindmap.updatedAt === syncedAt.current) return;
    syncedAt.current = mindmap.updatedAt;
    pending.current = null;
    window.clearTimeout(timer.current);
    const known = new Set(graph.current.nodes.map((node) => node.id));
    const nodes = toFlowNodes(mindmap).map((node) =>
      known.has(node.id)
        ? node
        : { ...node, data: { ...node.data, enter: "pending" as const } },
    );
    reframe.current = nodes.length !== known.size;
    setNodes(nodes);
    setEdges(toFlowEdges(mindmap));
    syncedTitle.current = rootTitle(nodes) ?? mindmap.title;
  }, [mindmap, setNodes, setEdges]);

  const initialized = useRef(false);
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      return;
    }
    const title = rootTitle(nodes);
    pending.current = {
      title: title && title !== syncedTitle.current ? title : undefined,
    };
    if (pending.current.title) syncedTitle.current = pending.current.title;
    // A glide is only walking the graph to positions it has already settled
    // on, so its frames must not restart the debounce — otherwise every save
    // waits out an animation. `flush` reads those positions from `settling`.
    if (settling.current) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, AUTOSAVE_MS);
  }, [nodes, edges, flush]);

  // Closing the map (or the whole workspace) mid-debounce still saves. The
  // timer is cleared after that, not before: a cleanup on every graph change
  // would cancel the debounce the frames above deliberately leave running.
  useEffect(() => () => flush(), [flush]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  // -- Static tree layout --------------------------------------------------
  // Nodes are never dragged: whenever the graph's structure (or a node's
  // rendered width) changes, every position is recomputed as a left-to-right
  // tree. Waits until every node is measured so the stored positions paint
  // first and the settled layout doesn't need a second pass.
  const structureKey = [
    nodes
      .map(
        (node) => `${node.id}@${Math.round((node.measured?.width ?? 0) / 8)}`,
      )
      .join(),
    edges.map((edge) => `${edge.source}>${edge.target}`).join(),
  ].join("|");
  const laidOnce = useRef(false);
  const glide = useRef<{ stop: () => void } | null>(null);
  // Bumped every time a layout finishes, which is the beat the reframe below
  // waits for. State rather than a ref because it has to schedule an effect.
  const [settledPass, setSettledPass] = useState(0);
  useEffect(() => () => glide.current?.stop(), []);
  useEffect(() => {
    const current = graph.current;
    if (current.nodes.some((node) => !node.measured?.width)) return;
    const laid = layoutGraph(current.nodes, current.edges);
    if (laid.edges !== current.edges) setEdges(laid.edges);

    const target = release(laid.nodes);
    const to = new Map(target.map((node) => [node.id, node]));
    const from = new Map(current.nodes.map((node) => [node.id, node.position]));
    // Positions are interpolated in state rather than transitioned in CSS
    // because React Flow redraws every connector from the node positions it
    // is handed: move the nodes alone and the lines detach from them for the
    // length of the animation. The updater form keeps whatever else happened
    // to a node meanwhile — a selection, a rename — out of the tween's way.
    const step = (t: number) =>
      setNodes((nodes) => {
        let changed = false;
        const next = nodes.map((node) => {
          const end = to.get(node.id);
          const start = from.get(node.id);
          if (!end || !start) return node;
          if (t >= 1) {
            if (
              node.position.x === end.position.x &&
              node.position.y === end.position.y &&
              node.data === end.data
            )
              return node;
            changed = true;
            return { ...node, position: end.position, data: end.data };
          }
          changed = true;
          return {
            ...node,
            position: {
              x: start.x + (end.position.x - start.x) * t,
              y: start.y + (end.position.y - start.y) * t,
            },
          };
        });
        return changed ? next : nodes;
      });

    // Only topics already on screen are worth gliding — the ones still held
    // invisible have no travel anyone can see. The first pass is exempt too:
    // it only corrects the stored positions the map painted with, which is
    // not a change the user made.
    const moved =
      laidOnce.current &&
      !reduceMotion &&
      laid.nodes.some((node) => {
        const start = from.get(node.id);
        return (
          node.data.enter !== "pending" &&
          start &&
          (start.x !== node.position.x || start.y !== node.position.y)
        );
      });
    laidOnce.current = true;
    glide.current?.stop();

    if (!moved) {
      settling.current = null;
      step(1);
      setSettledPass((pass) => pass + 1);
      return;
    }
    settling.current = new Map(target.map((node) => [node.id, node.position]));
    glide.current = animate(0, 1, {
      duration: RELAYOUT_MS / 1000,
      ease: EASE_IN_OUT_STRONG,
      onUpdate: step,
      onComplete: () => {
        step(1);
        setSettledPass((pass) => pass + 1);
      },
    });
  }, [structureKey, reduceMotion, setNodes, setEdges]);

  // Reframing waits for that settled beat instead of firing with the edit:
  // fitView measures the positions React Flow has already been handed, which
  // until the relayout lands are still the ones the assistant seeded.
  useEffect(() => {
    if (!settledPass) return;
    // Cleared here rather than when the glide ends, so that the commit which
    // lands the settled positions still counts as part of it — the autosave
    // effect above reads this to decide whether to restart its debounce.
    settling.current = null;
    if (!reframe.current) return;
    reframe.current = false;
    void fitView({
      duration: reduceMotion ? 0 : REFRAME_MS,
      maxZoom: 1,
      padding: 0.3,
    });
  }, [settledPass, fitView, reduceMotion]);

  // -- Graph editing -------------------------------------------------------
  // `canConnect` is the same rule the API enforces on save: only connections
  // between two separate components keep the map a tree.
  const isValidConnection = useCallback(
    (connection: Connection | Edge) =>
      canConnect(graph.current.edges, connection.source, connection.target),
    [],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      const { source, target } = connection;
      setEdges((edges) =>
        canConnect(edges, source, target)
          ? [...edges, makeEdge(source, target)]
          : edges,
      );
    },
    [setEdges],
  );

  // Dropping a connection on empty canvas is the one gesture that grows the
  // map: it mints a linked topic, already in edit mode so typing the title is
  // the immediate next keystroke. The drop point only seeds where the new
  // branch sorts among its siblings — the tree layout decides the position.
  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent, connectionState: FinalConnectionState) => {
      if (
        connectionState.isValid ||
        !connectionState.fromNode ||
        connectionState.toNode
      )
        return;
      const { clientX, clientY } =
        "changedTouches" in event ? event.changedTouches[0] : event;
      // Only a drop on genuinely empty canvas mints a topic: a drop on another
      // topic's body (which React Flow reports as no target, same as empty
      // space) is a failed link attempt, not a request for a new branch.
      if (
        document
          .elementFromPoint(clientX, clientY)
          ?.closest(".react-flow__node")
      )
        return;
      const position = screenToFlowPosition({ x: clientX, y: clientY });
      const id = crypto.randomUUID();
      setNodes((nodes) => [
        ...nodes,
        {
          id,
          type: "topic" as const,
          position: { x: position.x - 70, y: position.y - 19 },
          data: { title: "New topic", startEditing: true },
        },
      ]);
      setEdges((edges) => [
        ...edges,
        makeEdge(connectionState.fromNode!.id, id),
      ]);
    },
    [screenToFlowPosition, setNodes, setEdges],
  );

  // A topic and its whole branch live or die together: expanding any node
  // deletion to its descendants (plus every edge touching them) is what keeps
  // the canvas free of stranded fragments. Applies to the toolbar's trash
  // button and Backspace alike; the root never qualifies.
  const onBeforeDelete = useCallback(
    async ({
      nodes: requested,
      edges: requestedEdges,
    }: {
      nodes: Node[];
      edges: Edge[];
    }) => {
      const { nodes, edges } = graph.current;
      const tree = buildTree(nodes, edges, byX);
      const doomed = new Set<string>();
      for (const node of requested) {
        if (node.id === ROOT_NODE_ID) continue;
        doomed.add(node.id);
        for (const kid of descendantsOf(tree, node.id)) doomed.add(kid);
      }
      const requestedEdgeIds = new Set(requestedEdges.map((edge) => edge.id));
      return {
        nodes: nodes.filter((node) => doomed.has(node.id)),
        edges: edges.filter(
          (edge) =>
            requestedEdgeIds.has(edge.id) ||
            doomed.has(edge.source) ||
            doomed.has(edge.target),
        ),
      };
    },
    [],
  );

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectEnd={onConnectEnd}
        onBeforeDelete={onBeforeDelete}
        isValidConnection={isValidConnection}
        nodesDraggable={false}
        connectionMode={ConnectionMode.Loose}
        connectionLineStyle={EDGE_STYLE}
        fitView
        fitViewOptions={{ maxZoom: 1, padding: 0.3 }}
        zoomOnDoubleClick={false}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} />
        <Controls showInteractive={false} />
      </ReactFlow>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-end p-2">
        <span className="flex h-11 items-center gap-1.5 px-2 text-caption-sm text-graphite">
          {save.isPending && <Loader2 className="size-3 animate-spin" />}
          {save.isPending
            ? "Saving"
            : save.isError
              ? "Save failed — retrying on next change"
              : "Saved"}
        </span>
      </div>

      <p className="pointer-events-none absolute inset-x-0 bottom-3 z-10 text-center text-caption-sm text-graphite">
        Click a topic to branch, rename, or delete · drag from a blue dot to
        grow the tree · click a connection to remove it
      </p>
    </div>
  );
}

/** Shared look for the small action buttons on topics and connections. */
const CANVAS_ACTION_BUTTON =
  "flex h-7 min-w-7 items-center justify-center rounded-md border-2 border-ink-deep bg-white px-1 text-ink-deep shadow-soft-lift";

/**
 * A roadmap.sh-style topic pill: the root gets the loud yellow, every other
 * topic the softer amber. Selecting it reveals a toolbar to branch, rename,
 * or delete; double-click also renames. Enter or clicking away commits an
 * edit, Escape puts the old title back.
 */
function TopicNodeView({ id, data, selected }: NodeProps<TopicNode>) {
  const {
    updateNodeData,
    addNodes,
    addEdges,
    deleteElements,
    getNode,
    getNodes,
    getEdges,
  } = useReactFlow();
  const [editing, setEditing] = useState(Boolean(data.startEditing));
  const [draft, setDraft] = useState(data.title);
  // 0 = idle; otherwise the number of topics the pending delete would take,
  // shown on the trash button until a second click confirms.
  const [confirmCount, setConfirmCount] = useState(0);
  const isRoot = id === ROOT_NODE_ID;

  // The toolbar's rename button (and a fresh mint) request editing by
  // flipping `startEditing` in the node data.
  useEffect(() => {
    if (data.startEditing) {
      setDraft(data.title);
      setEditing(true);
    }
  }, [data.startEditing, data.title]);

  // Deselecting is the natural "never mind" for a pending delete.
  useEffect(() => {
    if (!selected) setConfirmCount(0);
  }, [selected]);

  // `autoFocus` alone loses the focus fight against React Flow's own focus
  // management (leaving keystrokes going to the canvas — or worse, to the
  // toolbar button that just spawned this topic), so the input claims focus
  // after paint. Stable identity keeps this to the input's mount only.
  const focusInput = useCallback((input: HTMLInputElement | null) => {
    if (!input) return;
    window.requestAnimationFrame(() => {
      input.focus();
      input.select();
    });
  }, []);

  function commit() {
    const title = draft.trim() || data.title;
    setDraft(title);
    setEditing(false);
    updateNodeData(id, { title, startEditing: false });
  }

  function cancel() {
    setDraft(data.title);
    setEditing(false);
    updateNodeData(id, { startEditing: false });
  }

  function addBranch() {
    const parent = getNode(id);
    if (!parent) return;
    const childId = crypto.randomUUID();
    addNodes({
      id: childId,
      type: "topic" as const,
      // Seeded just below the parent; the tree layout slots it in properly.
      position: {
        x: parent.position.x,
        y: parent.position.y + NODE_HEIGHT + LEVEL_GAP,
      },
      data: { title: "New topic", startEditing: true },
    });
    addEdges(makeEdge(id, childId));
  }

  function remove() {
    if (!confirmCount) {
      const tree = buildTree(getNodes() as TopicNode[], getEdges(), byX);
      const branchSize = descendantsOf(tree, id).length + 1;
      if (branchSize > 1) {
        setConfirmCount(branchSize);
        return;
      }
    }
    void deleteElements({ nodes: [{ id }] });
  }

  return (
    <div
      onDoubleClick={() => {
        setDraft(data.title);
        setEditing(true);
      }}
      // A topic an external edit added stays invisible until the tree has
      // made room for it, then fades in on its own beat.
      style={
        data.enterDelay ? { animationDelay: `${data.enterDelay}ms` } : undefined
      }
      className={cn(
        "rounded-md border-2 border-ink-deep px-4 py-2 text-ink-deep",
        isRoot
          ? "bg-[#ffe600] text-body-emphasis"
          : "bg-[#ffe599] text-caption-bold",
        selected && "shadow-[0_0_0_3px_#c9e0fc]",
        data.enter === "pending" && "opacity-0",
        data.enter === "in" && "animate-topic-in",
      )}
    >
      {editing ? (
        <input
          ref={focusInput}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit();
            if (event.key === "Escape") cancel();
          }}
          className="nodrag w-36 bg-transparent outline-none"
        />
      ) : (
        <span className="block max-w-56 truncate">{data.title}</span>
      )}
      {/* Loose connection mode makes both dots interchangeable grab points,
          so branches can grow from either end of a topic. */}
      <Handle
        type="target"
        position={Position.Top}
        className="!size-2.5 !border-none !bg-[#2b78e4]"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!size-2.5 !border-none !bg-[#2b78e4]"
      />

      <NodeToolbar
        isVisible={selected && !editing}
        position={Position.Top}
        offset={12}
        className="flex gap-1"
      >
        <button
          type="button"
          title="Add branch"
          aria-label="Add branch"
          onClick={addBranch}
          className={CANVAS_ACTION_BUTTON}
        >
          <Plus className="size-3.5" />
        </button>
        <button
          type="button"
          title="Rename"
          aria-label="Rename"
          onClick={() => updateNodeData(id, { startEditing: true })}
          className={CANVAS_ACTION_BUTTON}
        >
          <Pencil className="size-3" />
        </button>
        {!isRoot && (
          <button
            type="button"
            title={confirmCount ? undefined : "Delete"}
            aria-label="Delete"
            onClick={remove}
            className={cn(CANVAS_ACTION_BUTTON, "text-red-600")}
          >
            {confirmCount ? (
              <span className="whitespace-nowrap px-1 text-caption-bold">
                Delete {confirmCount} topics?
              </span>
            ) : (
              <Trash2 className="size-3.5" />
            )}
          </button>
        )}
      </NodeToolbar>
    </div>
  );
}

/**
 * A tree connector that can be removed: clicking the edge selects it, which
 * thickens the line and reveals a delete button at its midpoint.
 */
function TopicEdgeView({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  style,
}: EdgeProps) {
  const { deleteElements } = useReactFlow();
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={selected ? { ...style, strokeWidth: 3 } : style}
      />
      {selected && (
        <EdgeLabelRenderer>
          <button
            type="button"
            title="Delete connection"
            aria-label="Delete connection"
            onClick={() => deleteElements({ edges: [{ id }] })}
            className="nodrag nopan pointer-events-auto absolute flex size-6 items-center justify-center rounded-full border-2 border-ink-deep bg-white text-red-600 shadow-soft-lift"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            <X className="size-3.5" />
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

function toFlowNodes(mindmap: Mindmap): TopicNode[] {
  // Maps created before nodes existed come back empty; give them the root
  // they would have been born with so the canvas is never a dead end.
  const nodes = mindmap.nodes.length
    ? mindmap.nodes
    : [{ id: ROOT_NODE_ID, title: mindmap.title, x: 0, y: 0 }];
  return nodes.map((node) => ({
    id: node.id,
    type: "topic" as const,
    position: { x: node.x, y: node.y },
    data: { title: node.title },
    deletable: node.id !== ROOT_NODE_ID,
  }));
}

function toFlowEdges(mindmap: Mindmap): Edge[] {
  return mindmap.edges.map((edge) =>
    makeEdge(edge.source, edge.target, edge.id),
  );
}

function makeEdge(source: string, target: string, id?: string): Edge {
  return {
    id: id ?? crypto.randomUUID(),
    source,
    target,
    type: "topic",
    style: EDGE_STYLE,
  };
}

function rootTitle(nodes: TopicNode[]) {
  return nodes.find((node) => node.id === ROOT_NODE_ID)?.data.title;
}

/**
 * Releases the topics an external edit added, now that they have been laid
 * out: they fade in where they actually belong, one after the next down the
 * branch, so a five-topic answer reads as five topics rather than one blink.
 */
function release(nodes: TopicNode[]): TopicNode[] {
  const entering = nodes.filter((node) => node.data.enter === "pending");
  if (!entering.length) return nodes;
  const delays = new Map(
    entering
      .sort(
        (a, b) => a.position.y - b.position.y || a.position.x - b.position.x,
      )
      .map((node, index) => [
        node.id,
        Math.min(index, TOPIC_STAGGER_STEPS) * TOPIC_STAGGER_MS,
      ]),
  );
  return nodes.map((node) => {
    const enterDelay = delays.get(node.id);
    return enterDelay === undefined
      ? node
      : { ...node, data: { ...node.data, enter: "in" as const, enterDelay } };
  });
}

// -- Tree layout -----------------------------------------------------------
// The canvas is a static top-to-bottom tree: every position is derived from
// the graph, never from dragging. Each depth is a row, siblings sit side by
// side ordered by their previous x, and a parent centers over its children —
// so the ordering, including where a freshly dropped branch lands, is stable
// across relayouts and reloads.

/** How `buildTree` ranks siblings: left to right, by where they already are. */
const byX = (node: { position: { x: number } }) => node.position.x;

const NODE_HEIGHT = 40;
/** Vertical gap between a row of topics and its children's row. */
const LEVEL_GAP = 64;
/** Horizontal gap between sibling subtrees. */
const SIBLING_GAP = 32;
/** Extra horizontal gap between disconnected fragments (post-delete orphans). */
const FRAGMENT_GAP = 96;

function layoutGraph(
  nodes: TopicNode[],
  edges: Edge[],
): { nodes: TopicNode[]; edges: Edge[] } {
  if (!nodes.length) return { nodes, edges };
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const { roots, children, parent, depthOf } = buildTree(nodes, edges, byX);

  // Classic tidy tree, turned vertical: a subtree's extent is the width of
  // its children laid side by side (never less than the topic's own width),
  // and each topic centers horizontally over that block.
  const widthOf = (id: string) => byId.get(id)!.measured?.width ?? 170;
  const extent = new Map<string, number>();
  const measure = (id: string): number => {
    const kids = children.get(id)!;
    const kidsWidth =
      kids.reduce((sum, kid) => sum + measure(kid), 0) +
      SIBLING_GAP * (kids.length - 1);
    const width = Math.max(widthOf(id), kids.length ? kidsWidth : 0);
    extent.set(id, width);
    return width;
  };
  const pos = new Map<string, { x: number; y: number }>();
  const place = (id: string, left: number) => {
    const width = extent.get(id)!;
    pos.set(id, {
      x: left + (width - widthOf(id)) / 2,
      y: depthOf.get(id)! * (NODE_HEIGHT + LEVEL_GAP),
    });
    const kids = children.get(id)!;
    const kidsWidth =
      kids.reduce((sum, kid) => sum + extent.get(kid)!, 0) +
      SIBLING_GAP * (kids.length - 1);
    let cursor = left + (width - kidsWidth) / 2;
    for (const kid of kids) {
      place(kid, cursor);
      cursor += extent.get(kid)! + SIBLING_GAP;
    }
  };
  let left = 0;
  for (const root of roots) {
    measure(root);
    place(root, left);
    left += extent.get(root)! + FRAGMENT_GAP;
  }

  let nodesChanged = false;
  const nextNodes = nodes.map((node) => {
    const position = pos.get(node.id)!;
    if (node.position.x === position.x && node.position.y === position.y) {
      return node;
    }
    nodesChanged = true;
    return { ...node, position };
  });
  // Loose connection mode lets a branch be drawn from either handle, so an
  // edge can arrive child → parent; flip those so every edge leaves a parent's
  // bottom dot and enters its child's top dot.
  let edgesChanged = false;
  const nextEdges = edges.map((edge) => {
    if (parent.get(edge.source) !== edge.target) return edge;
    edgesChanged = true;
    return { ...edge, source: edge.target, target: edge.source };
  });
  return {
    nodes: nodesChanged ? nextNodes : nodes,
    edges: edgesChanged ? nextEdges : edges,
  };
}
