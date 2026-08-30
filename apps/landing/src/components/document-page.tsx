import { Reveal } from "@/components/reveal";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { MCP_TOOLS } from "@/lib/content";
import type { DocumentBlock, SiteDocument } from "@/lib/documents";
import { isFirstParty } from "@/lib/site";

/**
 * The written pages — about, contact, privacy, MCP — rendered from the doc
 * model in `lib/documents.ts`.
 *
 * One component for all four rather than four hand-laid pages, because they are
 * one kind of page: a title, a standfirst, and a column of prose at a readable
 * measure. The home page earns its own layout by being an argument with
 * pictures in it; these are read once, top to bottom, by somebody checking
 * whether this is a real thing.
 *
 * The measure is capped at 720px for the same reason the section intros are —
 * past about 80 characters a line the eye loses the start of the next one.
 */

function Block({ block }: { block: DocumentBlock }) {
  switch (block.kind) {
    case "paragraph":
      return <p className="mt-5 text-body text-pretty">{block.text}</p>;

    case "list":
      return (
        <ul className="mt-5 flex list-disc flex-col gap-3 pl-5 marker:text-mist-gray">
          {block.items.map((item) => (
            <li key={item} className="text-body text-pretty">
              {item}
            </li>
          ))}
        </ul>
      );

    case "links":
      return (
        <ul className="mt-5 flex flex-col gap-3">
          {block.items.map((item) => (
            <li key={item.href} className="text-body">
              <a
                href={item.href}
                rel={
                  item.href.startsWith("http") && !isFirstParty(item.href)
                    ? "noreferrer"
                    : undefined
                }
                className="font-semibold text-ink-navy underline decoration-hairline underline-offset-4 transition-colors duration-150 hover:decoration-signal-blue"
              >
                {item.label}
              </a>
              {item.note ? (
                <span className="text-slate-gray"> — {item.note}</span>
              ) : null}
            </li>
          ))}
        </ul>
      );

    case "code":
      return (
        <div className="mt-5">
          {block.caption ? (
            <p className="text-caption font-semibold tracking-[0.1em] text-slate-gray uppercase">
              {block.caption}
            </p>
          ) : null}
          {/* `overflow-x-auto` and `min-w-0` on the column above it: a command
              line does not wrap, and a grid item's automatic minimum size is
              its content's, so without both the page is as wide as the longest
              command on it. */}
          <pre
            className={`overflow-x-auto rounded-input border border-hairline bg-paper px-4 py-3 ${block.caption ? "mt-2" : ""}`}
          >
            <code className="font-mono text-body-sm text-ink-navy">
              {block.code}
            </code>
          </pre>
        </div>
      );

    // A definition list rather than a table: the scope belongs *with* the name,
    // and a three-column table on a phone is one column of names with the two
    // facts about them scrolled off the right.
    case "tools":
      return (
        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          {MCP_TOOLS.map((tool) => (
            <div
              key={tool.name}
              className="rounded-input border border-hairline bg-paper p-4"
            >
              <dt className="flex flex-wrap items-center gap-2">
                <code className="font-mono text-body-sm font-semibold text-ink-navy">
                  {tool.name}
                </code>
                <Badge>{tool.scope}</Badge>
              </dt>
              <dd className="mt-2 text-body-sm text-slate-gray">
                {tool.summary}
              </dd>
            </div>
          ))}
        </dl>
      );
  }
}

export function DocumentPage({ doc }: { doc: SiteDocument }) {
  return (
    <>
      <SiteHeader />
      <main id="main" className="border-t border-hairline">
        <article className="mx-auto min-w-0 max-w-[760px] px-5 py-16 sm:px-8 lg:py-24">
          <Reveal>
            <h1 className="text-heading text-balance text-ink-navy">
              {doc.title}
            </h1>
          </Reveal>
          <Reveal delay={60}>
            <p className="mt-6 text-body-lg text-pretty text-slate-gray">
              {doc.lead}
            </p>
          </Reveal>

          {doc.sections.map((section, index) => (
            <Reveal key={section.heading} delay={index === 0 ? 120 : 0}>
              <section className="mt-14 border-t border-hairline pt-10 text-slate-gray">
                <h2 className="text-subheading text-ink-navy">
                  {section.heading}
                </h2>
                {section.blocks.map((block, blockIndex) => (
                  <Block key={blockIndex} block={block} />
                ))}
              </section>
            </Reveal>
          ))}
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
