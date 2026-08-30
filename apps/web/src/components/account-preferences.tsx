import { Loader2, RotateCw } from "lucide-react";
import {
  LAYOUT_DIRECTION_LABELS,
  LAYOUT_DIRECTIONS,
  type LayoutDirection,
} from "@thinkclear/shared";
import { Button } from "@/components/ui/button";
import {
  useMe,
  usePreferences,
  useUpdatePreferences,
} from "@/hooks/use-account";
import { cn } from "@/lib/utils";

/**
 * How the app behaves, as opposed to who is using it — the section that grows
 * as the canvas gains opinions worth disagreeing with.
 *
 * The one setting here changes the shape of every mindmap, so it is shown as
 * two pictures rather than as a select: the words "top to bottom" and "left to
 * right" are only unambiguous once you already know what they do, and the
 * thing being chosen is a shape. The mocks keep the canvas' own yellow and
 * blue for the same reason the landing page's do — a preview recoloured to
 * match the dialog around it stops previewing anything.
 *
 * Choosing writes immediately. There is no Save button because there is
 * nothing to review: the canvas behind this dialog rearranges as the choice is
 * made, which is the confirmation.
 */
const DIRECTION_HINTS: Record<LayoutDirection, string> = {
  down: "Branches spread sideways under the root. Best for a map with a few short branches.",
  right:
    "Branches stack down the side of the root. Best for a deep map, or long titles.",
};

export function AccountPreferences() {
  const me = useMe();
  const { layoutDirection } = usePreferences();
  const update = useUpdatePreferences();

  if (me.isPending) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="size-5 animate-spin text-graphite" />
      </div>
    );
  }

  if (me.isError) {
    return (
      <div className="py-6 text-center">
        <p className="text-caption-md text-destructive">
          Could not load your preferences.
        </p>
        <Button
          variant="link"
          className="mt-1"
          onClick={() => void me.refetch()}
        >
          <RotateCw /> Try again
        </Button>
      </div>
    );
  }

  return (
    <div>
      {/* Real radios rather than styled buttons: this is one choice out of two,
          and the browser already knows that arrow keys move between them. */}
      <fieldset>
        <legend className="text-body-emphasis">Layout direction</legend>
        <p className="mt-1 text-caption-md text-graphite">
          Which way a mindmap grows away from its root topic. It applies to
          every map, and rearranges the ones you already have.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {LAYOUT_DIRECTIONS.map((direction) => (
            <DirectionOption
              key={direction}
              direction={direction}
              checked={direction === layoutDirection}
              onChoose={() => update.mutate({ layoutDirection: direction })}
            />
          ))}
        </div>
      </fieldset>

      {update.isError && (
        <p className="mt-3 text-caption-md text-destructive">
          Could not save that. Your maps are still laid out the old way.
        </p>
      )}
    </div>
  );
}

function DirectionOption({
  direction,
  checked,
  onChoose,
}: {
  direction: LayoutDirection;
  checked: boolean;
  onChoose: () => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer flex-col gap-3 rounded-lg border p-4 outline-none",
        "transition-[background-color,border-color] duration-[160ms] ease-out-strong",
        "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
        checked ? "border-ink bg-cloud" : "border-hairline hover:bg-cloud",
      )}
    >
      <input
        type="radio"
        name="layout-direction"
        className="sr-only"
        checked={checked}
        onChange={onChoose}
      />
      <DirectionMock direction={direction} />
      <span className="text-body-md">{LAYOUT_DIRECTION_LABELS[direction]}</span>
      <span className="text-caption-md text-graphite">
        {DIRECTION_HINTS[direction]}
      </span>
    </label>
  );
}

/** A root and three branches, drawn the way the canvas would draw them. */
function DirectionMock({ direction }: { direction: LayoutDirection }) {
  const shared = {
    viewBox: "0 0 128 76",
    "aria-hidden": true,
    className: "w-full rounded-md bg-paper",
  } as const;

  if (direction === "right") {
    return (
      <svg {...shared}>
        <g fill="none" stroke="#2b78e4" strokeWidth="2">
          <path d="M42 38h14" />
          <path d="M56 14v48" />
          <path d="M56 14h12M56 38h12M56 62h12" />
        </g>
        <Pill x={8} y={29} width={34} height={18} root />
        <Pill x={68} y={6} width={52} height={16} />
        <Pill x={68} y={30} width={52} height={16} />
        <Pill x={68} y={54} width={52} height={16} />
      </svg>
    );
  }

  return (
    <svg {...shared}>
      <g fill="none" stroke="#2b78e4" strokeWidth="2">
        <path d="M64 26v10" />
        <path d="M24 36h80" />
        <path d="M24 36v10M64 36v10M104 36v10" />
      </g>
      <Pill x={40} y={8} width={48} height={18} root />
      <Pill x={6} y={46} width={36} height={16} />
      <Pill x={46} y={46} width={36} height={16} />
      <Pill x={86} y={46} width={36} height={16} />
    </svg>
  );
}

function Pill({
  x,
  y,
  width,
  height,
  root,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  root?: boolean;
}) {
  return (
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      rx={4}
      fill={root ? "#ffe600" : "#ffe599"}
      stroke="#000000"
      strokeWidth="2"
    />
  );
}
