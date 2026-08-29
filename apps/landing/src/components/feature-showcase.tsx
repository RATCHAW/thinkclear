"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDownIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

export interface ShowcaseItem {
  id: string;
  title: string;
  body: ReactNode;
  /** Rendered on the server and handed down, so no icon ships to the client. */
  icon: ReactNode;
  /** Same — the product mock is a server component passed in as an element. */
  visual: ReactNode;
}

/**
 * The feature accordion and the product card it drives.
 *
 * `icon` and `visual` arrive as already-rendered elements rather than as
 * component references, which is what keeps every mock and every glyph out of
 * the browser bundle: this file is the only client code in the section, and
 * all it holds is which row is open.
 *
 * The row title does not change size or weight between states, only color.
 * Both of the others reflow the list, and a list that shifts under the cursor
 * as you move down it is worse than a subtle active state.
 */
export function FeatureShowcase({ items }: { items: ShowcaseItem[] }) {
  const [activeId, setActiveId] = useState(items[0]?.id);
  const baseId = useId();

  return (
    <div className="mt-16 grid items-center gap-12 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:gap-16">
      <ul className="flex flex-col">
        {items.map((item) => {
          const active = item.id === activeId;
          const panelId = `${baseId}-${item.id}`;
          return (
            <li
              key={item.id}
              className="border-b border-hairline last:border-b-0"
            >
              <h3>
                <button
                  type="button"
                  onClick={() => setActiveId(item.id)}
                  aria-expanded={active}
                  aria-controls={panelId}
                  className="flex w-full items-center gap-3 py-5 text-left"
                >
                  <span
                    className={cn(
                      "shrink-0 transition-colors duration-200 ease-out",
                      active ? "text-signal-blue" : "text-mist-gray",
                    )}
                  >
                    {item.icon}
                  </span>
                  <span
                    className={cn(
                      "flex-1 text-body-lg font-semibold transition-colors duration-200 ease-out",
                      active ? "text-ink-navy" : "text-mist-gray",
                    )}
                  >
                    {item.title}
                  </span>
                  <ChevronDownIcon
                    className={cn(
                      "size-5 shrink-0 transition-[transform,color] duration-200 ease-out",
                      active
                        ? "-rotate-180 text-ink-navy"
                        : "rotate-0 text-mist-gray",
                    )}
                  />
                </button>
              </h3>
              {/* 0fr → 1fr is the CSS-only collapse. It costs layout on every
                  frame like `height` does, which is why it stays at 200ms. */}
              <div
                id={panelId}
                role="region"
                className={cn(
                  "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
                  active ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                )}
              >
                <div className="overflow-hidden">
                  <p className="pr-4 pb-6 text-body text-slate-gray">
                    {item.body}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="relative">
        <span
          aria-hidden="true"
          className="blob -top-10 -right-6 size-64 bg-sky-cyan"
        />
        <span
          aria-hidden="true"
          className="blob -bottom-10 -left-8 size-56 bg-coral-magenta"
        />
        {/* All three mocks are mounted and stacked in one grid cell, so the
            card is as tall as the tallest of them and never resizes as you
            move between rows. */}
        <div className="relative grid items-center overflow-hidden rounded-product bg-paper shadow-product">
          {items.map((item) => {
            const active = item.id === activeId;
            return (
              <div
                key={item.id}
                inert={!active}
                aria-hidden={!active}
                className={cn(
                  "[grid-area:1/1] transition-[opacity,transform,filter] duration-[260ms] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-[opacity]",
                  active
                    ? "opacity-100 blur-none"
                    : "pointer-events-none scale-[0.98] opacity-0 blur-[2px] motion-reduce:scale-100",
                )}
              >
                {item.visual}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
