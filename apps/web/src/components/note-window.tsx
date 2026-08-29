import {
  memo,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useNodesData, useReactFlow } from "@xyflow/react";
import { GripVertical, Loader2, X } from "lucide-react";
import { MAX_NOTE_LENGTH } from "@thinkclear/shared";
import { Button } from "@/components/ui/button";
import { NoteMarkdown } from "@/components/note-markdown-lazy";
import type { TopicNode } from "@/components/mindmap-canvas";
import {
  closeNote,
  raiseNote,
  useWorkspaceRoute,
} from "@/hooks/use-workspace-route";
import { cn } from "@/lib/utils";

/** How long typing stays in the textarea before it settles into the topic. */
const NOTE_COMMIT_MS = 400;
/** Where the character count starts showing itself, ahead of the cap. */
const NOTE_LENGTH_HINT = Math.round(MAX_NOTE_LENGTH * 0.9);

/** Opening size, and the box the user can drag a window between. */
const DEFAULT_SIZE = { width: 460, height: 420 };
const MIN_SIZE = { width: 320, height: 240 };
const MAX_SIZE = { width: 760, height: 680 };
/** Breathing room kept between a window and the edge of the viewport. */
const MARGIN = 12;
/** Gap left between the topic and the first window opened from it. */
const ANCHOR_GAP = 16;
/**
 * How far each window opens down and right of the one before it. Roughly a
 * title bar, which is the whole point: what stays uncovered underneath is the
 * strip you can read the topic's name on and grab to pull it back out.
 */
const CASCADE_STEP = 28;
/** Windows stack above the assistant; each one above the last. */
const WINDOW_Z_BASE = 30;
/** How long a closed window has to scale away before it is forgotten. */
const WINDOW_EXIT_MS = 200;

type Rect = { x: number; y: number; width: number; height: number };
type Tab = "edit" | "preview";

/**
 * Every open note, as a stack of windows over the canvas.
 *
 * Opening a note never closes another — that is the point, since the reason to
 * put a note in a window rather than a panel is to read it against the others.
 * New windows cascade down and to the right of the last one placed, so the one
 * underneath keeps a title bar you can see and grab, and pressing anywhere in
 * a window brings it to the front. Which notes are open, and which is in
 * front, live in the URL; where each window sits and how big it is do not.
 *
 * Rendered inside the canvas' `ReactFlowProvider` but outside its dissolve, so
 * the windows read and write the same node data the topics do without fading
 * and scaling with the map behind them.
 */
export function NoteWindows() {
  const { noteNodeIds } = useWorkspaceRoute();
  const { getNode, flowToScreenPosition } = useReactFlow();

  // Windows are rendered from `rects`, not straight from the route: a note
  // that has just been closed stays here one beat longer so its window can
  // leave rather than blink out.
  const [rects, setRects] = useState<Record<string, Rect>>({});
  const placed = useRef(rects);
  useLayoutEffect(() => {
    placed.current = rects;
  }, [rects]);

  // Where the cascade is up to. Not the position of whatever was dragged last
  // — a window the user moved is theirs, and the next one should still land
  // where the run was going.
  const lastSeed = useRef<Rect | null>(null);
  // Notes already open on the first render arrived from the address bar, not
  // from a press: there is no gesture to feel connected to, and the canvas is
  // still fitting the map to the viewport, so the topic is not yet where it is
  // about to be. That run starts centred; every later one anchors to the topic
  // actually pressed.
  const fromLink = useRef(noteNodeIds.length > 0);

  useEffect(() => {
    if (noteNodeIds.length === 0) lastSeed.current = null;
    const unplaced = noteNodeIds.filter((id) => !(id in placed.current));
    if (unplaced.length === 0) return;

    const opened: Record<string, Rect> = {};
    for (const id of unplaced) {
      const seed = lastSeed.current
        ? cascade(lastSeed.current)
        : fromLink.current
          ? centered()
          : anchoredTo(
              getNode(id) as TopicNode | undefined,
              flowToScreenPosition,
            );
      opened[id] = seed;
      lastSeed.current = seed;
    }
    fromLink.current = false;
    // Written eagerly as well as through state so a second run in the same
    // commit — React's development double-invoke — sees these as placed and
    // does not advance the cascade twice.
    placed.current = { ...placed.current, ...opened };
    setRects((current) => ({ ...current, ...opened }));
  }, [noteNodeIds, getNode, flowToScreenPosition]);

  useEffect(() => {
    const closed = Object.keys(placed.current).filter(
      (id) => !noteNodeIds.includes(id),
    );
    if (closed.length === 0) return;
    const timer = window.setTimeout(() => {
      setRects((current) => {
        const next = { ...current };
        for (const id of closed) delete next[id];
        return next;
      });
    }, WINDOW_EXIT_MS);
    // Reopening a note before the beat is up re-runs this with a shorter list,
    // so the window it just got back is not swept away underneath it.
    return () => window.clearTimeout(timer);
  }, [noteNodeIds]);

  // A viewport that shrinks under the windows (a resized browser, a rotated
  // tablet) must not leave any of them half outside or larger than the screen.
  useEffect(() => {
    const onResize = () =>
      setRects((current) =>
        Object.fromEntries(
          Object.entries(current).map(([id, rect]) => [id, fit(rect)]),
        ),
      );
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // One stable callback for every window rather than one closure per id, so a
  // window whose rect did not change can skip re-rendering while another is
  // being dragged.
  const setRect = useCallback((nodeId: string, rect: Rect) => {
    setRects((current) => ({ ...current, [nodeId]: rect }));
  }, []);

  return (
    <>
      {Object.entries(rects).map(([nodeId, rect]) => {
        const depth = noteNodeIds.indexOf(nodeId);
        return (
          <NoteWindow
            key={nodeId}
            nodeId={nodeId}
            rect={rect}
            open={depth !== -1}
            // Route order is stacking order, front-most last. A window on its
            // way out drops below the live ones instead of fading over them.
            z={WINDOW_Z_BASE + (depth === -1 ? -1 : depth)}
            onRectChange={setRect}
          />
        );
      })}
    </>
  );
}

const NoteWindow = memo(function NoteWindow({
  nodeId,
  rect,
  open,
  z,
  onRectChange,
}: {
  nodeId: string;
  rect: Rect;
  open: boolean;
  z: number;
  onRectChange: (nodeId: string, rect: Rect) => void;
}) {
  const node = useNodesData<TopicNode>(nodeId);
  const [dragging, setDragging] = useState(false);
  const [tab, setTab] = useState<Tab>("edit");

  // -- Drag and resize -----------------------------------------------------
  // One gesture at a time, tracked by pointer id: a second finger arriving
  // mid-drag would otherwise snap the window to it.
  const gesture = useRef<{
    pointerId: number;
    mode: "move" | "resize";
    originX: number;
    originY: number;
    rect: Rect;
  } | null>(null);

  const onPointerDown = useCallback(
    (mode: "move" | "resize") => (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0 || gesture.current) return;
      // The whole header is a grab handle, which means the controls sitting in
      // it are inside the handle. Capturing the pointer there would retarget
      // the rest of the gesture at the header and the button would never see
      // its click — so a press that starts on a control is not a drag.
      if ((event.target as HTMLElement).closest("button")) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      gesture.current = {
        pointerId: event.pointerId,
        mode,
        originX: event.clientX,
        originY: event.clientY,
        rect,
      };
      setDragging(true);
    },
    [rect],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent) => {
      const start = gesture.current;
      if (!start || start.pointerId !== event.pointerId) return;
      const dx = event.clientX - start.originX;
      const dy = event.clientY - start.originY;
      onRectChange(
        nodeId,
        fit(
          start.mode === "move"
            ? { ...start.rect, x: start.rect.x + dx, y: start.rect.y + dy }
            : {
                ...start.rect,
                width: start.rect.width + dx,
                height: start.rect.height + dy,
              },
        ),
      );
    },
    [nodeId, onRectChange],
  );

  const endGesture = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (gesture.current?.pointerId !== event.pointerId) return;
    gesture.current = null;
    setDragging(false);
  }, []);

  if (!node) return null;

  return (
    <section
      role="dialog"
      aria-label={`Note on ${node.data.title}`}
      aria-hidden={!open}
      inert={!open}
      // Capture, so this runs before the header's drag or the textarea's focus
      // and a press anywhere in the window raises it — including a press that
      // lands on a button, which is the one people notice when it's missing.
      onPointerDownCapture={() => raiseNote(nodeId)}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.stopPropagation();
        closeNote(nodeId);
      }}
      style={{
        // Position travels on `transform` rather than `left`/`top` so a drag
        // is composited instead of relaid out on every pointer move.
        transform: `translate3d(${rect.x}px, ${rect.y}px, 0)`,
        width: rect.width,
        height: rect.height,
        zIndex: z,
      }}
      className={cn("fixed top-0 left-0", !open && "pointer-events-none")}
    >
      {/* The window the user sees is this inner box, and the split is what
          keeps a drag honest: position lives on the element above, which never
          transitions, while arriving and leaving happen here on scale and
          opacity. Sharing one `transform` between the two would mean the last
          pointer move and the release landing in the same commit sends the
          window gliding to where it was dropped, 200ms after the hand let go
          of it. */}
      <div
        className={cn(
          "flex h-full w-full flex-col overflow-hidden rounded-xl bg-paper shadow-floating",
          "transition-[opacity,transform] duration-200 ease-out-strong",
          open ? "scale-100 opacity-100" : "scale-[0.97] opacity-0",
        )}
      >
        <header
          onPointerDown={onPointerDown("move")}
          onPointerMove={onPointerMove}
          onPointerUp={endGesture}
          onPointerCancel={endGesture}
          className={cn(
            "flex shrink-0 touch-none items-center gap-2 border-b border-hairline px-2 py-2",
            dragging ? "cursor-grabbing" : "cursor-grab",
          )}
        >
          <GripVertical className="size-4 shrink-0 text-steel" />
          <p className="min-w-0 flex-1 truncate text-caption-md">
            {node.data.title}
          </p>

          {/* Edit / Preview, the way a pull request description does it. The
            indicator travels rather than cross-fading, so the two tabs read as
            one control with a position instead of two lights. */}
          <div className="relative flex shrink-0 rounded-md bg-cloud p-0.5">
            <span
              aria-hidden
              className={cn(
                "absolute inset-y-0.5 left-0.5 w-[calc(50%-0.125rem)] rounded-sm bg-paper shadow-soft-lift",
                "transition-transform duration-200 ease-out-strong",
                tab === "preview" && "translate-x-full",
              )}
            />
            {(["edit", "preview"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={tab === value}
                onClick={() => setTab(value)}
                className={cn(
                  "relative z-10 w-20 rounded-sm px-2 py-1 text-caption-md capitalize transition-colors duration-200 ease-out-strong",
                  tab === value
                    ? "text-ink"
                    : "text-graphite hover:text-charcoal",
                )}
              >
                {value}
              </button>
            ))}
          </div>

          <Button
            variant="ghost"
            size="icon-sm"
            className="shrink-0"
            aria-label={`Close note on ${node.data.title}`}
            onClick={() => closeNote(nodeId)}
          >
            <X />
          </Button>
        </header>

        <NoteBody
          nodeId={nodeId}
          note={node.data.note ?? ""}
          tab={tab}
          open={open}
        />

        <span
          role="separator"
          aria-label={`Resize note on ${node.data.title}`}
          onPointerDown={onPointerDown("resize")}
          onPointerMove={onPointerMove}
          onPointerUp={endGesture}
          onPointerCancel={endGesture}
          // A corner grip rather than four edges: the window is anchored from
          // its top-left and only ever grows down and right, so one handle is
          // the whole gesture and there is no hidden 4px target to hunt for.
          className="absolute right-0 bottom-0 size-5 cursor-nwse-resize touch-none"
        >
          <span className="pointer-events-none absolute right-1.5 bottom-1.5 block size-2 rounded-[1px] border-r-2 border-b-2 border-steel" />
        </span>
      </div>
    </section>
  );
});

/**
 * The draft, and the two ways of looking at it.
 *
 * Write is raw markdown in a textarea — what is typed is exactly what is
 * stored, with no serializer in between to normalize it — and Preview renders
 * that same live draft, so the two tabs cannot disagree and switching does not
 * wait on a save.
 */
function NoteBody({
  nodeId,
  note,
  tab,
  open,
}: {
  nodeId: string;
  note: string;
  tab: Tab;
  open: boolean;
}) {
  const { updateNodeData } = useReactFlow();
  const [draft, setDraft] = useState(note);
  // The last markdown pushed into node data. The note coming back through
  // props is normally that exact string on its way around the loop; anything
  // else was written by someone else — the assistant, from the chat panel —
  // and is adopted rather than typed over.
  const emitted = useRef(note);
  const pending = useRef<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const flush = useCallback(() => {
    window.clearTimeout(timer.current);
    const markdown = pending.current;
    pending.current = null;
    if (markdown === null) return;
    emitted.current = markdown;
    updateNodeData(nodeId, { note: markdown });
  }, [nodeId, updateNodeData]);

  useEffect(() => {
    if (note === emitted.current) return;
    emitted.current = note;
    setDraft(note);
  }, [note]);

  // Typing settles into the topic on a debounce rather than a keystroke: each
  // write re-renders the canvas and restarts its autosave, and a note is prose
  // — nobody is waiting on the letter they just typed to land somewhere.
  function handleChange(markdown: string) {
    setDraft(markdown);
    pending.current = markdown;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, NOTE_COMMIT_MS);
  }

  // Leaving flushes, whichever way it happens: closing this window unmounts
  // it, but the map can also be closed a frame later, and the canvas' own save
  // must not go out without the last words typed. Switching *tabs* needs no
  // flush, because Preview reads the draft.
  useEffect(() => () => flush(), [flush]);
  useEffect(() => {
    if (!open) flush();
  }, [open, flush]);

  const atLimit = draft.length >= MAX_NOTE_LENGTH;

  return (
    <>
      {tab === "edit" ? (
        <textarea
          value={draft}
          onChange={(event) => handleChange(event.target.value)}
          // The cap is enforced by the field rather than checked after the
          // fact. What is typed here is what is stored — there is no
          // serializer that could push it back over the limit — so the note
          // can never be too long to save, and paste is truncated too.
          maxLength={MAX_NOTE_LENGTH}
          aria-label="Note"
          placeholder="Write a note… markdown works."
          spellCheck
          className="note-source min-h-0 w-full flex-1 resize-none bg-transparent px-5 py-4 outline-none"
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {draft.trim() ? (
            <Suspense
              fallback={
                <div className="flex justify-center py-8">
                  <Loader2 className="size-5 animate-spin text-graphite" />
                </div>
              }
            >
              <NoteMarkdown markdown={draft} />
            </Suspense>
          ) : (
            <p className="text-caption-md text-graphite">
              Nothing to preview yet.
            </p>
          )}
        </div>
      )}

      {draft.length > NOTE_LENGTH_HINT && (
        <p
          className={cn(
            "shrink-0 border-t border-hairline px-5 py-2 text-caption-sm",
            atLimit ? "text-destructive" : "text-graphite",
          )}
        >
          {atLimit
            ? `At the ${format(MAX_NOTE_LENGTH)} character limit.`
            : `${format(draft.length)} of ${format(MAX_NOTE_LENGTH)} characters`}
        </p>
      )}
    </>
  );
}

const format = (count: number) => count.toLocaleString("en-US");

/** A window's box, clamped to a viewport it always has to fit inside. */
function fit(rect: Rect): Rect {
  const width = clamp(
    rect.width,
    MIN_SIZE.width,
    Math.min(MAX_SIZE.width, window.innerWidth - MARGIN * 2),
  );
  const height = clamp(
    rect.height,
    MIN_SIZE.height,
    Math.min(MAX_SIZE.height, window.innerHeight - MARGIN * 2),
  );
  return {
    width,
    height,
    x: clamp(rect.x, MARGIN, window.innerWidth - width - MARGIN),
    y: clamp(rect.y, MARGIN, window.innerHeight - height - MARGIN),
  };
}

function openingSize() {
  return {
    width: Math.min(DEFAULT_SIZE.width, window.innerWidth - MARGIN * 2),
    height: Math.min(DEFAULT_SIZE.height, window.innerHeight - MARGIN * 2),
  };
}

function centered(): Rect {
  const size = openingSize();
  return fit({
    ...size,
    x: (window.innerWidth - size.width) / 2,
    y: (window.innerHeight - size.height) / 2,
  });
}

/**
 * The next step of the cascade: down and right of the window before it, at its
 * opening size rather than that window's — a run of windows should look like a
 * run, whatever the one underneath has been resized to.
 *
 * When the step would run off the screen the cascade starts over, which is
 * what covering the first window exactly looks like, and is what every window
 * manager that has ever cascaded does at the bottom of the run.
 */
function cascade(previous: Rect): Rect {
  const size = openingSize();
  const stepped = {
    ...size,
    x: previous.x + CASCADE_STEP,
    y: previous.y + CASCADE_STEP,
  };
  const fitted = fit(stepped);
  return fitted.x === stepped.x && fitted.y === stepped.y
    ? fitted
    : fit({ ...size, x: MARGIN + CASCADE_STEP, y: MARGIN + CASCADE_STEP });
}

/**
 * Opens the first window of a run beside the topic it belongs to — right of it
 * if there is room, left if there isn't — so it arrives somewhere connected to
 * what was pressed rather than somewhere arbitrary, without landing on top of
 * it. Everything opened after it cascades from there.
 *
 * The topic's position is read once, here, rather than subscribed to: a window
 * is placed and then owned by whoever drags it, so it must not chase the topic
 * when the canvas pans.
 */
function anchoredTo(
  node: TopicNode | undefined,
  toScreen: (position: { x: number; y: number }) => { x: number; y: number },
): Rect {
  if (!node) return centered();
  const size = openingSize();
  const anchor = toScreen(node.position);
  const toTheRight = anchor.x + (node.measured?.width ?? 170) + ANCHOR_GAP;
  return fit({
    ...size,
    x:
      toTheRight + size.width + MARGIN <= window.innerWidth
        ? toTheRight
        : anchor.x - size.width - ANCHOR_GAP,
    y: anchor.y - size.height / 3,
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}
