"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { observeReveal } from "@/lib/reveal-observer";
import { cn } from "@/lib/utils";

interface RevealProps {
  children: ReactNode;
  /** Milliseconds behind the element above it. Keep runs to 30–80ms apart. */
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li" | "article";
}

/**
 * Fades and lifts its children in the first time they are scrolled to.
 *
 * A client component wrapping server-rendered `children`: the children are
 * passed in already rendered, so nothing inside a `Reveal` is dragged into the
 * browser bundle by being wrapped in one.
 */
export function Reveal({
  children,
  delay = 0,
  className,
  as: Tag = "div",
}: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    return observeReveal(element, () => setVisible(true));
  }, []);

  return (
    <Tag
      // One `HTMLElement` ref for four possible tags; each of them is one.
      ref={ref as React.Ref<never>}
      data-visible={visible ? "" : undefined}
      style={delay > 0 ? { transitionDelay: `${delay}ms` } : undefined}
      className={cn("reveal", className)}
    >
      {children}
    </Tag>
  );
}
