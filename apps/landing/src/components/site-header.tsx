"use client";

import { useEffect, useState } from "react";
import { CloseIcon, MenuIcon } from "@/components/icons";
import { ButtonLink } from "@/components/ui/button";
import { Wordmark } from "@/components/wordmark";
import { SIGN_UP_URL } from "@/lib/site";

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#mcp", label: "MCP" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#open-source", label: "Open source" },
];

/**
 * The sticky top bar. Client-side for one reason — the small-screen menu —
 * which is also why the panel is a plain conditional render rather than
 * something animated: a menu opened from a tap should be there on the tap.
 */
export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-50 border-b border-hairline bg-cloud/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-page items-center gap-6 px-5 sm:px-8">
        <a
          href="#top"
          className="flex items-center gap-2 rounded-[4px] text-ink-navy"
          aria-label="ThinkClear, back to top"
        >
          <Wordmark />
        </a>

        <nav className="hidden flex-1 items-center justify-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-body-sm font-medium text-ink-navy transition-colors duration-150 hover:text-signal-blue"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <a
            href={SIGN_UP_URL}
            className="hidden rounded-[4px] px-2 py-1 text-body-sm font-semibold text-ink-navy transition-colors duration-150 hover:text-signal-blue sm:inline-flex"
          >
            Sign in
          </a>
          <ButtonLink href={SIGN_UP_URL} compact>
            Get started
          </ButtonLink>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="site-menu"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className="-mr-2 inline-flex size-9 items-center justify-center rounded-input text-ink-navy md:hidden"
          >
            {menuOpen ? (
              <CloseIcon className="size-5" />
            ) : (
              <MenuIcon className="size-5" />
            )}
          </button>
        </div>
      </div>

      {menuOpen ? (
        <nav
          id="site-menu"
          className="border-t border-hairline bg-paper px-5 py-3 md:hidden"
        >
          <ul className="flex flex-col">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="block border-b border-hairline py-3 text-body font-medium text-ink-navy last:border-b-0"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
