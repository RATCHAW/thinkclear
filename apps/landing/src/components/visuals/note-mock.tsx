import { CloseIcon } from "@/components/icons";

/**
 * A note window over the canvas: markdown written as source in the Edit tab,
 * read as rendered markdown in Preview. Two windows, cascaded down and right,
 * because opening one never closes another.
 */

function WindowChrome({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-product border border-hairline bg-paper shadow-product ${className ?? ""}`}
    >
      <div className="flex items-center gap-3 border-b border-hairline bg-cloud px-4 py-2.5">
        <span className="truncate text-body-sm font-semibold text-ink-navy">
          {title}
        </span>
        <div className="ml-auto flex items-center gap-1 rounded-input bg-pebble p-0.5">
          <span className="rounded-[6px] px-2 py-0.5 text-caption font-medium text-slate-gray">
            Edit
          </span>
          <span className="rounded-[6px] bg-paper px-2 py-0.5 text-caption font-semibold text-ink-navy shadow-lift">
            Preview
          </span>
        </div>
        <CloseIcon className="size-4 shrink-0 text-mist-gray" />
      </div>
      {children}
    </div>
  );
}

export function NoteMock() {
  return (
    <div className="relative px-6 pt-6 pb-10 sm:px-8">
      {/* The window underneath. Its title bar stays visible, which is the
          whole reason the cascade goes down and to the right. */}
      <WindowChrome
        title="Pricing"
        className="absolute top-10 left-12 hidden w-[62%] sm:block"
      >
        <div className="px-4 py-3">
          <p className="text-body-sm text-slate-gray">
            Free while in beta. Decide before the changelog post goes out.
          </p>
        </div>
      </WindowChrome>

      <WindowChrome
        title="Positioning"
        className="relative mt-6 ml-auto w-full sm:mt-16 sm:w-[88%]"
      >
        <div className="flex flex-col gap-3 px-5 py-4 text-left">
          <h3 className="text-body font-bold text-ink-navy">
            Who it&rsquo;s for
          </h3>
          <p className="text-body-sm text-slate-gray">
            People who think by writing things down and then need to see the
            shape of what they wrote.
          </p>
          <ul className="flex flex-col gap-1.5 text-body-sm text-slate-gray">
            {[
              "Not a wiki — it has to be fast to change",
              "Not a to-do list — nothing here is done",
            ].map((item) => (
              <li key={item} className="flex gap-2">
                <span
                  aria-hidden="true"
                  className="mt-[9px] size-1.5 shrink-0 rounded-full bg-mist-gray"
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="text-body-sm text-slate-gray">
            Read the map with{" "}
            <code className="rounded-[4px] bg-pebble px-1.5 py-0.5 font-mono text-caption text-deep-cobalt">
              read_mindmap
            </code>{" "}
            before editing it.
          </p>
        </div>
      </WindowChrome>
    </div>
  );
}
