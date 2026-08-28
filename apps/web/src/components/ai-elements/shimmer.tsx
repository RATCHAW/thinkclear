"use client";

import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import type { CSSProperties } from "react";
import { memo, useMemo } from "react";

// Simplified from the AI Elements original: the upstream version resolves a
// motion component from an `as` prop at render time, which trips the
// static-components lint rule. This app only ever shimmers inline text, so
// one module-level motion element covers it.
const MotionSpan = motion.create("span");

export interface TextShimmerProps {
  children: string;
  className?: string;
  duration?: number;
  spread?: number;
}

const ShimmerComponent = ({
  children,
  className,
  duration = 2,
  spread = 2,
}: TextShimmerProps) => {
  const dynamicSpread = useMemo(
    () => (children?.length ?? 0) * spread,
    [children, spread],
  );

  return (
    <MotionSpan
      animate={{ backgroundPosition: "0% center" }}
      className={cn(
        "relative inline-block bg-[length:250%_100%,auto] bg-clip-text text-transparent",
        "[--bg:linear-gradient(90deg,#0000_calc(50%-var(--spread)),var(--color-background),#0000_calc(50%+var(--spread)))] [background-repeat:no-repeat,padding-box]",
        className,
      )}
      initial={{ backgroundPosition: "100% center" }}
      style={
        {
          "--spread": `${dynamicSpread}px`,
          backgroundImage:
            "var(--bg), linear-gradient(var(--color-muted-foreground), var(--color-muted-foreground))",
        } as CSSProperties
      }
      transition={{
        duration,
        ease: "linear",
        repeat: Number.POSITIVE_INFINITY,
      }}
    >
      {children}
    </MotionSpan>
  );
};

export const Shimmer = memo(ShimmerComponent);
