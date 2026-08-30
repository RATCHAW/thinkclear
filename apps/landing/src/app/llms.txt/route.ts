import { renderLlmsTxt } from "@/lib/markdown";

/**
 * `/llms.txt` — the llmstxt.org index for this domain.
 *
 * A route rather than a checked-in file, for the reason the OG image is
 * generated rather than checked in: it is assembled from the same constants and
 * arrays the pages are, so the endpoint it names and the tools it lists cannot
 * fall behind the ones the site actually has.
 *
 * Served as `text/plain` because the extension promises text — a browser should
 * show it rather than download it — and because every client that fetches an
 * `llms.txt` already knows the body is markdown.
 */
export const dynamic = "force-static";

export function GET(): Response {
  return new Response(renderLlmsTxt(), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=0, must-revalidate",
    },
  });
}
