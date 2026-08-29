import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

/** How long the tick stays up before the button offers to copy again. */
const COPIED_MS = 1600;

/**
 * A line the user is meant to take somewhere else — an endpoint, a shell
 * command, a block of config.
 *
 * It is `select-all`, so one click grabs the whole thing whether or not the
 * copy button works. That is the fallback rather than an error state: the
 * clipboard API needs a secure context, and a person on one where it is
 * missing needs the text, not a message about why they can't have it.
 */
export function Snippet({
  text,
  label,
  className,
}: {
  text: string;
  /** What is being copied, for the button's accessible name. */
  label: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg bg-cloud py-2 pr-2 pl-3",
        className,
      )}
    >
      <pre className="min-w-0 flex-1 overflow-x-auto py-1 font-mono text-caption-md break-words whitespace-pre-wrap text-ink select-all">
        {text}
      </pre>
      <CopyButton text={text} label={label} />
    </div>
  );
}

/**
 * Copy, with the tick that says it happened.
 *
 * The two icons are stacked in one grid cell and cross-faded rather than
 * swapped, because a glyph that is replaced outright reads as a flicker at this
 * size. Both scale slightly as they go, so the one arriving grows into place
 * instead of appearing from nothing.
 */
export function CopyButton({
  text,
  label,
  className,
}: {
  text: string;
  label: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // The text is selectable; the tick would be a lie, so nothing happens.
      return;
    }
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), COPIED_MS);
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-md text-graphite outline-none",
        "transition-[color,background-color,transform] duration-[160ms] ease-out-strong",
        "hover:bg-fog hover:text-foreground active:scale-[0.94] active:bg-steel/50",
        "focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <Check
        aria-hidden
        className={cn(
          "col-start-1 row-start-1 size-4 text-primary",
          "transition-[opacity,transform] duration-[160ms] ease-out-strong",
          copied ? "scale-100 opacity-100" : "scale-90 opacity-0",
        )}
      />
      <Copy
        aria-hidden
        className={cn(
          "col-start-1 row-start-1 size-4",
          "transition-[opacity,transform] duration-[160ms] ease-out-strong",
          copied ? "scale-90 opacity-0" : "scale-100 opacity-100",
        )}
      />
    </button>
  );
}
