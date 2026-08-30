import type { AnchorHTMLAttributes } from "react";
import { isFirstParty } from "@/lib/site";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "dark" | "quiet" | "outline";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "button-primary",
  dark: "button-dark",
  quiet: "button-quiet",
  outline: "button-outline",
};

interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  variant?: ButtonVariant;
  compact?: boolean;
}

/**
 * Every button on this page is a link — there is nothing here to submit. The
 * visual treatment lives in `globals.css`; this only chooses between them.
 *
 * Anything leaving for a third party carries `rel="noreferrer"`, so that
 * destination is not told which page sent the visitor. The app is the one
 * exception, and `isFirstParty` is where that reasoning lives.
 */
export function ButtonLink({
  href,
  variant = "primary",
  compact = false,
  className,
  ...props
}: ButtonLinkProps) {
  const thirdParty = href.startsWith("http") && !isFirstParty(href);
  return (
    <a
      href={href}
      rel={thirdParty ? "noreferrer" : undefined}
      className={cn(
        "button",
        VARIANT_CLASS[variant],
        compact ? "button-compact" : undefined,
        className,
      )}
      {...props}
    />
  );
}
