import { NextResponse, type NextRequest } from "next/server";
import { negotiate } from "@/lib/accept";
import { markdownForPath } from "@/lib/markdown";
import { SITE_URL } from "@/lib/site";

/**
 * Content negotiation, in front of every page. (Next 16 calls this file
 * `proxy`; it is the convention that used to be called `middleware`.)
 *
 * A page on this site has two representations at one URL: the HTML a person
 * reads and the markdown an agent reads. Which one comes back is decided here,
 * from `Accept`, and the decision is announced with `Vary: Accept` — without
 * that header a CDN that cached one variant will hand it to a client that asked
 * for the other, which is the failure mode the whole convention exists to
 * prevent.
 *
 * Doing it in middleware rather than in each route is what keeps the 404 case
 * honest. An unmatched path has no route to negotiate in, and "there is no page
 * here, and here is the list of pages there are" is the single most useful thing
 * this site can say to an agent that guessed a URL.
 */

const CACHE_CONTROL = "public, max-age=0, must-revalidate";

/**
 * `Accept` is the header this site actually varies on. The four `Next-Router-*`
 * entries are Next's own — it sets them so a CDN does not serve an RSC payload
 * where a document was asked for — and they are restated here because setting
 * `vary` replaces the header rather than adding to it. Dropping them would trade
 * one cache-poisoning bug for another.
 *
 * The same string is in `vercel.json`, and has to be, because this is the one
 * header Next will not let anything else set: it overwrites `vary` on a page
 * response with its own list, so the responses built *here* get it from here and
 * the statically served ones get it from the platform, above Next. The two
 * copies are asserted equal in `test/proxy.spec.ts` — a `Vary` that says
 * different things depending on which layer answered is worse than one that is
 * wrong in a single predictable way.
 */
export const VARY =
  "Accept, RSC, Next-Router-State-Tree, Next-Router-Prefetch, Next-Router-Segment-Prefetch";

/** `/about/` and `/about` are the same page; `/` stays `/`. */
function normalizePath(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

export default function proxy(request: NextRequest): NextResponse {
  // The router talking to itself. An RSC payload request carries its own
  // `Accept` (`text/x-component`), and negotiating it would answer client-side
  // navigation with a 406 — or worse, with a page.
  if (
    request.headers.has("rsc") ||
    request.headers.has("next-router-prefetch")
  ) {
    return NextResponse.next();
  }

  const path = normalizePath(request.nextUrl.pathname);
  const wanted = negotiate(request.headers.get("accept"));

  if (wanted === "unacceptable") {
    return new NextResponse(
      `This URL is served as text/html and text/markdown. Ask for one of those.\n`,
      {
        status: 406,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          vary: VARY,
        },
      },
    );
  }

  if (wanted === "markdown") {
    const { body, status } = markdownForPath(path);
    return new NextResponse(body, {
      status,
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        vary: VARY,
        "cache-control": CACHE_CONTROL,
        // The markdown is a representation of the page, not a page of its own,
        // so it points at the same canonical URL the HTML does.
        link: `<${SITE_URL}${path === "/" ? "" : path}>; rel="canonical"`,
      },
    });
  }

  // HTML: hand it to Next. `Vary` is not set here on purpose — Next overwrites
  // it on a page response with its own list, so this branch gets the header from
  // `vercel.json`, at the layer above.
  return NextResponse.next();
}

export const config = {
  // Everything except the build output and the files that are already a machine
  // format. `robots.txt`, `sitemap.xml`, `llms.txt` and the manifest have one
  // representation each; there is nothing for them to negotiate.
  matcher: [
    "/((?!_next/|\\.well-known/|opengraph-image|icon\\.svg|favicon\\.ico|robots\\.txt|sitemap\\.xml|llms\\.txt).*)",
  ],
};
