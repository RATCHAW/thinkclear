import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ButtonLink } from "@/components/ui/button";
import { SITE_DOCUMENTS } from "@/lib/documents";
import { SIGN_UP_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: "Page not found · ThinkClear" },
  // A 404 has nothing to rank for, and a search engine that indexed one would
  // be listing a dead end.
  robots: { index: false, follow: true },
};

/**
 * The 404, which is a routing surface rather than a joke about a lost astronaut.
 *
 * A wrong path is where a reader — human or agent — has the least information
 * and the fewest ways to get more, so this page spends all of itself on
 * recovery: every page this site has, and the two machine-readable indexes that
 * would have answered the question without a guess. Next serves it with a real
 * 404 status; the middleware serves the same list as markdown to anything that
 * asked for `text/markdown`, so an agent gets the map out in the format it
 * reads rather than as tag soup.
 */
const RECOVERY = [
  {
    label: "/llms.txt",
    href: "/llms.txt",
    note: "this site's index, written for agents",
  },
  { label: "/sitemap.xml", href: "/sitemap.xml", note: "every URL" },
  {
    label: "/.well-known/mcp.json",
    href: "/.well-known/mcp.json",
    note: "the endpoint and its transport, as JSON",
  },
];

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="border-t border-hairline">
        <div className="mx-auto max-w-[760px] px-5 py-16 sm:px-8 lg:py-24">
          <p className="text-caption font-semibold tracking-[0.14em] text-slate-gray uppercase">
            404
          </p>
          <h1 className="mt-4 text-heading text-balance text-ink-navy">
            There is no page here.
          </h1>
          <p className="mt-6 text-body-lg text-pretty text-slate-gray">
            This site is small — the list below is all of it. The product itself
            is on a different host, and the two files under it answer most of
            what an agent comes here to ask.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <ButtonLink href="/">Back to the home page</ButtonLink>
            <ButtonLink href={SIGN_UP_URL} variant="quiet">
              Open the app
            </ButtonLink>
          </div>

          <section className="mt-14 border-t border-hairline pt-10">
            <h2 className="text-subheading text-ink-navy">Every page</h2>
            <ul className="mt-5 flex flex-col gap-3">
              <li className="text-body">
                <a
                  href="/"
                  className="font-semibold text-ink-navy underline decoration-hairline underline-offset-4 transition-colors duration-150 hover:decoration-signal-blue"
                >
                  Home
                </a>
                <span className="text-slate-gray"> — what ThinkClear is</span>
              </li>
              {SITE_DOCUMENTS.map((doc) => (
                <li key={doc.path} className="text-body">
                  <a
                    href={doc.path}
                    className="font-semibold text-ink-navy underline decoration-hairline underline-offset-4 transition-colors duration-150 hover:decoration-signal-blue"
                  >
                    {doc.title}
                  </a>
                  <span className="text-slate-gray"> — {doc.description}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-12 border-t border-hairline pt-10">
            <h2 className="text-subheading text-ink-navy">
              Machine-readable index
            </h2>
            <ul className="mt-5 flex flex-col gap-3">
              {RECOVERY.map((entry) => (
                <li key={entry.href} className="text-body">
                  <a
                    href={entry.href}
                    className="font-mono text-body-sm font-semibold text-ink-navy underline decoration-hairline underline-offset-4 transition-colors duration-150 hover:decoration-signal-blue"
                  >
                    {entry.label}
                  </a>
                  <span className="text-slate-gray"> — {entry.note}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
