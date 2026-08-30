import {
  createContext,
  useCallback,
  useContext,
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
  useUpdateNodeInternals,
  type Connection,
  type Edge,
  type EdgeProps,
  type FinalConnectionState,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { animate, useReducedMotion } from "motion/react";
import { Loader2, NotebookPen, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  buildTree,
  canConnect,
  DEFAULT_LAYOUT_DIRECTION,
  descendantsOf,
  ROOT_NODE_ID,
  type LayoutDirection,
} from "@thinkclear/shared";
import { prefetchNoteMarkdown } from "@/components/note-markdown-lazy";
import { NotePreview } from "@/components/note-preview";
import { NoteWindows } from "@/components/note-window";
import { HoverCard, HoverCardTrigger } from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";
import { usePreferences } from "@/hooks/use-account";
import {
  useActiveMindmap,
  useSaveMindmapGraph,
  type Mindmap,
} from "@/hooks/use-mindmaps";
import { openNote } from "@/hooks/use-workspace-route";

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
/**
 * How long the pointer has to rest on a topic before its note previews.
 * Long enough that crossing the canvas doesn't strobe cards on every topic it
 * passes over, short enough to feel like the answer to a question you asked.
 */
const HOVER_NOTE_DELAY_MS = 320;
/** `--ease-in-out-strong`: movement across the screen, per DESIGN.md › Motion. */
const EASE_IN_OUT_STRONG = [0.77, 0, 0.175, 1] as const;

// The canvas borrows roadmap.sh's palette instead of DESIGN.md: yellow title
// pills over blue connectors is the entire visual identity of the reference,
// and it reads as content on the white canvas rather than as app chrome.
const EDGE_COLOR = "#2b78e4";
const EDGE_STYLE = { stroke: EDGE_COLOR, strokeWidth: 2 };

export type TopicNode = Node<
  {
    title: string;
    /**
     * Markdown source for the topic's note, previewed on hover and edited in
     * `NoteWindow`. Empty and absent mean the same thing, so every reader
     * tests it for truth rather than for presence.
     */
    note?: string;
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

/**
 * Which way the tree grows, for the parts of the canvas that are rendered by
 * React Flow rather than called by it — a topic's handles and the position a
 * new branch is seeded at have to agree with the layout, and `nodeTypes` has
 * nowhere to pass a prop through.
 */
const LayoutDirectionContext = createContext<LayoutDirection>(
  DEFAULT_LAYOUT_DIRECTION,
);

export function MindmapCanvas() {
  const activeMindmap = useActiveMindmap();
  const { layoutDirection } = usePreferences();
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

  // Keyed by id so switching mindmaps remounts the editor — its React Flow
  // state is initialized once from the fetched document and then owned
  // locally, which is what keeps background refetches from clobbering an edit
  // in progress — and so the fade-in replays for the arriving map.
  return shown ? (
    <LayoutDirectionContext value={layoutDirection}>
      <ReactFlowProvider key={shown._id}>
        <div
          className={cn(
            "h-full w-full",
            leaving ? "animate-canvas-out" : "animate-canvas-in",
          )}
        >
          <MindmapEditor mindmap={shown} direction={layoutDirection} />
        </div>
        {/* Inside the provider, so they read and write the same node data the
            topics do; outside the dissolving wrapper, because a window has no
            business fading and scaling along with the map behind it. */}
        <NoteWindows />
      </ReactFlowProvider>
    </LayoutDirectionContext>
  ) : (
    // The idle backdrop behind the "No mindmap open" overlay.
    <div key="empty" className="animate-canvas-in h-full w-full">
      <ReactFlow nodes={[]} edges={[]}>
        <Background variant={BackgroundVariant.Dots} gap={24} />
      </ReactFlow>
    </div>
  );
}

const nodeTypes = { topic: TopicNodeView };
const edgeTypes = { topic: TopicEdgeView };

function MindmapEditor({
  mindmap,
  direction,
}: {
  mindmap: Mindmap;
  direction: LayoutDirection;
}) {
  const { screenToFlowPosition, fitView } = useReactFlow();
  const reduceMotion = Boolean(useReducedMotion());
  // Warmed here rather than on first hover: a preview that has to fetch
  // ProseMirror before it can render is a preview that arrives after the
  // pointer has moved on.
  useEffect(prefetchNoteMarkdown, []);
  // Lazily, because these walk the whole document and are read exactly once:
  // `useNodesState` keeps its argument only on the first render, but it is
  // still *evaluated* on every one — and a relayout renders this component
  // once per animation frame, where rebuilding the graph and throwing it away
  // is the most expensive thing happening.
  const [seed] = useState(() => ({
    nodes: toFlowNodes(mindmap),
    edges: toFlowEdges(mindmap),
  }));
  const [nodes, setNodes, onNodesChange] = useNodesState(seed.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(seed.edges);
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
  const syncedTitle = useRef(rootTitle(seed.nodes) ?? mindmap.title);
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
          // A cleared note is sent as no note rather than as an empty string,
          // which is what keeps "has a note" one truthy check everywhere —
          // here, in the pill's indicator, and in the assistant's outline.
          ...(node.data.note ? { note: node.data.note } : {}),
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
  // React Flow measures each topic's handles once and routes every connector
  // from that cache, so moving a handle from the bottom of the pill to its
  // right-hand side changes where the dot is drawn and nothing about where the
  // lines go. Turning the tree without this leaves every link departing the
  // side it used to, looping the long way round to reach a topic that is now
  // beside its parent — right again only on the next reload, which is exactly
  // as long as the stale measurement survives.
  const updateNodeInternals = useUpdateNodeInternals();
  useEffect(() => {
    updateNodeInternals(graph.current.nodes.map((node) => node.id));
  }, [direction, updateNodeInternals]);

  // Nodes are never dragged: whenever the graph's structure (or a node's
  // rendered size) changes, every position is recomputed as a tree growing the
  // way `direction` says. Waits until every node is measured so the stored
  // positions paint first and the settled layout doesn't need a second pass.
  //
  // Both dimensions are in the key because either can be the one that matters:
  // growing down, a wider title takes more room beside its siblings; growing
  // right, it pushes the whole level after it further across.
  const structureKey = [
    direction,
    nodes
      .map(
        (node) =>
          `${node.id}@${Math.round((node.measured?.width ?? 0) / 8)}x${Math.round((node.measured?.height ?? 0) / 8)}`,
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
    const laid = layoutGraph(current.nodes, current.edges, direction);
    if (laid.edges !== current.edges) setEdges(laid.edges);

    const target = release(laid.nodes, direction);
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
    // `direction` is already inside `structureKey`, so naming it here costs no
    // extra pass — the two can only ever change together.
  }, [structureKey, direction, reduceMotion, setNodes, setEdges]);

  // Changing the direction moves every topic without anyone having edited
  // anything, so nothing above has armed the debounce — and the positions the
  // glide lands on are what a reload re-derives sibling order from. Arming it
  // here is what keeps the map that comes back the map that was left.
  const laidDirection = useRef(direction);
  useEffect(() => {
    if (laidDirection.current === direction) return;
    laidDirection.current = direction;
    // Spread rather than replaced: a rename made a moment ago may still be
    // waiting in here, and the map's own title is not something to lose to a
    // change of direction.
    pending.current = { ...pending.current };
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, AUTOSAVE_MS);
  }, [direction, flush]);

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
      // Sibling order has no bearing on who is below whom, but the tree is
      // built the one way everywhere so there is only ever one to reason about.
      const tree = buildTree(nodes, edges, siblingOrder(direction));
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
    [direction],
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
  // Controlled rather than left to Radix, because pressing Edit has to put the
  // card away: the pointer is still resting on it at that moment, so on its
  // own it would stay open behind the window it just opened, showing the same
  // note twice.
  const [previewOpen, setPreviewOpen] = useState(false);
  const direction = useContext(LayoutDirectionContext);
  const across = direction === "right";
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
      // Seeded one level along from the parent and level with it, so it sorts
      // into the middle of any siblings; the tree layout then places it
      // properly. Which way "along" is is the whole difference between the two
      // directions here.
      position: across
        ? {
            x:
              parent.position.x +
              (parent.measured?.width ?? NODE_WIDTH) +
              LEVEL_GAP,
            y: parent.position.y,
          }
        : {
            x: parent.position.x,
            y:
              parent.position.y +
              (parent.measured?.height ?? NODE_HEIGHT) +
              LEVEL_GAP,
          },
      data: { title: "New topic", startEditing: true },
    });
    addEdges(makeEdge(id, childId));
  }

  function remove() {
    if (!confirmCount) {
      const tree = buildTree(
        getNodes() as TopicNode[],
        getEdges(),
        siblingOrder(direction),
      );
      const branchSize = descendantsOf(tree, id).length + 1;
      if (branchSize > 1) {
        setConfirmCount(branchSize);
        return;
      }
    }
    void deleteElements({ nodes: [{ id }] });
  }

  return (
    // The card is always mounted and only its *content* is conditional, so a
    // topic gaining or losing a note doesn't restructure the tree around the
    // pill and take its title-edit state down with it. With nothing to show,
    // opening resolves to nothing on screen.
    <HoverCard
      open={previewOpen}
      onOpenChange={setPreviewOpen}
      openDelay={HOVER_NOTE_DELAY_MS}
      closeDelay={120}
    >
      <HoverCardTrigger asChild>
        <div
          onDoubleClick={() => {
            setDraft(data.title);
            setEditing(true);
          }}
          // A topic an external edit added stays invisible until the tree has
          // made room for it, then fades in on its own beat.
          style={
            data.enterDelay
              ? { animationDelay: `${data.enterDelay}ms` }
              : undefined
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
            <span className="flex items-center gap-1.5">
              <span className="max-w-56 truncate">{data.title}</span>
              {/* A topic with a note says so on the pill. It widens the topic,
              which the tree layout absorbs on its next pass — so writing the
              first note on a branch tidies the branch around it. */}
              {data.note && (
                <>
                  <NotebookPen className="size-3 shrink-0" />
                  <span className="sr-only">Has a note</span>
                </>
              )}
            </span>
          )}
          {/* Loose connection mode makes both dots interchangeable grab points,
          so branches can grow from either end of a topic. They sit on the two
          ends of the growth axis, which is also what tells React Flow which way
          a connector should leave and arrive. */}
          <Handle
            type="target"
            position={across ? Position.Left : Position.Top}
            className="!size-2.5 !border-none !bg-[#2b78e4]"
          />
          <Handle
            type="source"
            position={across ? Position.Right : Position.Bottom}
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
              title={data.note ? "Edit note" : "Add note"}
              aria-label={data.note ? "Edit note" : "Add note"}
              onClick={() => openNote(id)}
              className={CANVAS_ACTION_BUTTON}
            >
              <NotebookPen className="size-3.5" />
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
      </HoverCardTrigger>

      {/* Only a topic with something to show gets a card. Editing the title
          suppresses it — a preview of the note is not what anyone hovering
          their own cursor over a rename field is asking for. Having the note
          already open does *not*: with several windows up, the one you want
          may be buried, and its topic is the shortest way back to it. */}
      {data.note && !editing && (
        <NotePreview
          note={data.note}
          title={data.title}
          onEdit={() => {
            setPreviewOpen(false);
            openNote(id);
          }}
        />
      )}
    </HoverCard>
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
    data: { title: node.title, note: node.note },
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
function release(nodes: TopicNode[], direction: LayoutDirection): TopicNode[] {
  const entering = nodes.filter((node) => node.data.enter === "pending");
  if (!entering.length) return nodes;
  // Down the branch, then across it — which is depth first either way, so the
  // order the topics appear in is the order they were reasoned into existence.
  const along =
    direction === "right"
      ? (a: TopicNode, b: TopicNode) =>
          a.position.x - b.position.x || a.position.y - b.position.y
      : (a: TopicNode, b: TopicNode) =>
          a.position.y - b.position.y || a.position.x - b.position.x;
  const delays = new Map(
    entering
      .sort(along)
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
// The canvas is a static tree: every position is derived from the graph, never
// from dragging. Each depth is a row (or a column), siblings sit side by side
// ordered by where they already are, and a parent centers over its children —
// so the ordering, including where a freshly dropped branch lands, is stable
// across relayouts and reloads.
//
// Which way the tree grows is the person's to choose, so the whole thing is
// written on two named axes rather than on x and y: **main** is the one depth
// advances along and **cross** the one siblings spread across. Growing down
// means main = y, cross = x; growing right swaps them, and nothing else in the
// algorithm changes. Everything that has to agree with the layout — the
// handles a connector leaves from, where a new branch is seeded, how
// `buildTree` ranks siblings — reads the same one answer.

/**
 * How `buildTree` ranks siblings: by where they already sit on the cross axis,
 * so a branch dropped between two others stays between them.
 */
function siblingOrder(direction: LayoutDirection) {
  return direction === "right"
    ? (node: { position: { y: number } }) => node.position.y
    : (node: { position: { x: number } }) => node.position.x;
}

/** Fallbacks for a topic that has not been measured yet. */
const NODE_WIDTH = 170;
const NODE_HEIGHT = 40;
/** Gap between a level of topics and the next one, along the growth axis. */
const LEVEL_GAP = 64;
/** Gap between sibling subtrees, across it. */
const SIBLING_GAP = 32;
/** Extra gap between disconnected fragments (post-delete orphans). */
const FRAGMENT_GAP = 96;

function layoutGraph(
  nodes: TopicNode[],
  edges: Edge[],
  direction: LayoutDirection,
): { nodes: TopicNode[]; edges: Edge[] } {
  if (!nodes.length) return { nodes, edges };
  const across = direction === "right";
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const { roots, children, parent, depthOf } = buildTree(
    nodes,
    edges,
    siblingOrder(direction),
  );

  const sizeOf = (id: string) => {
    const node = byId.get(id)!;
    const width = node.measured?.width ?? NODE_WIDTH;
    const height = node.measured?.height ?? NODE_HEIGHT;
    return across
      ? { main: width, cross: height }
      : { main: height, cross: width };
  };

  // Every topic at a depth shares one line, and the line is as thick as the
  // largest topic on it. That is what keeps a long title from overlapping the
  // level below when the tree grows sideways and depth is measured in widths.
  const thickness: number[] = [];
  for (const node of nodes) {
    const depth = depthOf.get(node.id)!;
    thickness[depth] = Math.max(thickness[depth] ?? 0, sizeOf(node.id).main);
  }
  const mainAt: number[] = [];
  let mainCursor = 0;
  for (let depth = 0; depth < thickness.length; depth++) {
    mainAt[depth] = mainCursor;
    mainCursor += thickness[depth] + LEVEL_GAP;
  }

  // Classic tidy tree: a subtree's extent is its children laid side by side
  // across the cross axis (never less than the topic's own size), and each
  // topic centers over that block.
  const extent = new Map<string, number>();
  const measure = (id: string): number => {
    const kids = children.get(id)!;
    const kidsCross =
      kids.reduce((sum, kid) => sum + measure(kid), 0) +
      SIBLING_GAP * (kids.length - 1);
    const cross = Math.max(sizeOf(id).cross, kids.length ? kidsCross : 0);
    extent.set(id, cross);
    return cross;
  };
  const pos = new Map<string, { x: number; y: number }>();
  const place = (id: string, start: number) => {
    const cross = extent.get(id)!;
    const own = start + (cross - sizeOf(id).cross) / 2;
    const main = mainAt[depthOf.get(id)!];
    pos.set(id, across ? { x: main, y: own } : { x: own, y: main });
    const kids = children.get(id)!;
    const kidsCross =
      kids.reduce((sum, kid) => sum + extent.get(kid)!, 0) +
      SIBLING_GAP * (kids.length - 1);
    let cursor = start + (cross - kidsCross) / 2;
    for (const kid of kids) {
      place(kid, cursor);
      cursor += extent.get(kid)! + SIBLING_GAP;
    }
  };
  let start = 0;
  for (const root of roots) {
    measure(root);
    place(root, start);
    start += extent.get(root)! + FRAGMENT_GAP;
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
  // source dot and enters its child's target dot, whichever side the direction
  // puts those on.
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
