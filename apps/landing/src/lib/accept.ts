/**
 * Content negotiation for `Accept`, to the acceptmarkdown.com convention:
 * serve markdown when it is asked for, set `Vary: Accept`, honour q-values, and
 * answer 406 when the client will take nothing this site can produce.
 *
 * RFC 9110 §12.5.1 is the actual rule being implemented. The part that matters
 * and is easy to get wrong is that q-value alone does not decide it. The fully
 * wildcarded range — what curl, most crawlers, and every client that did not
 * think about it send — matches `text/markdown` and `text/html` equally, and
 * markdown would break the ordinary case in the name of the exotic one. So
 * specificity breaks the tie, the way the spec says it should: a media range
 * that names the type outranks one that wildcards it, and an exact tie goes to
 * HTML, because HTML is what a URL on the web means by default.
 */

/** What this site can serve, most specific match wins. */
const HTML_TYPES = ["text/html", "application/xhtml+xml"];
const MARKDOWN_TYPES = ["text/markdown", "text/x-markdown"];

interface MediaRange {
  type: string;
  subtype: string;
  quality: number;
}

/**
 * Parses an `Accept` header into media ranges. Anything unparseable is dropped
 * rather than defaulted: a malformed range is not evidence of a preference, and
 * inventing one for it is how a client ends up served something it never asked
 * for.
 */
export function parseAcceptHeader(value: string | null): MediaRange[] {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => {
      const [range, ...parameters] = entry.split(";").map((it) => it.trim());
      const slash = range?.indexOf("/") ?? -1;
      if (!range || slash < 1) return null;

      const qParameter = parameters.find((parameter) =>
        parameter.toLowerCase().startsWith("q="),
      );
      const quality = qParameter ? Number(qParameter.slice(2)) : 1;
      if (!Number.isFinite(quality) || quality < 0 || quality > 1) return null;

      return {
        type: range.slice(0, slash).toLowerCase(),
        subtype: range.slice(slash + 1).toLowerCase(),
        quality,
      };
    })
    .filter((range): range is MediaRange => range !== null);
}

/**
 * How well a set of ranges matches a media type: its q-value, and how
 * specifically it was named. `precision` is 2 for an exact `type/subtype`, 1
 * for a wildcarded subtype, 0 for a fully wildcarded range, and the match is
 * absent when nothing covers it.
 */
function scoreFor(
  ranges: MediaRange[],
  mediaTypes: string[],
): { quality: number; precision: number } {
  let best = { quality: 0, precision: -1 };

  for (const mediaType of mediaTypes) {
    const [type, subtype] = mediaType.split("/");
    for (const range of ranges) {
      const precision =
        range.type === type && range.subtype === subtype
          ? 2
          : range.type === type && range.subtype === "*"
            ? 1
            : range.type === "*" && range.subtype === "*"
              ? 0
              : -1;
      if (precision < 0) continue;
      if (
        precision > best.precision ||
        (precision === best.precision && range.quality > best.quality)
      ) {
        best = { quality: range.quality, precision };
      }
    }
  }

  return best;
}

export type Negotiated = "html" | "markdown" | "unacceptable";

/**
 * What to serve for an `Accept` header.
 *
 * A missing or empty header means no preference, which RFC 9110 says to treat
 * as the fully wildcarded range — and this site's default representation is
 * HTML.
 */
export function negotiate(accept: string | null): Negotiated {
  const ranges = parseAcceptHeader(accept);
  if (ranges.length === 0) return "html";

  const html = scoreFor(ranges, HTML_TYPES);
  const markdown = scoreFor(ranges, MARKDOWN_TYPES);

  // `q=0` is a refusal, not a weak preference, so a client that names both and
  // zeroes both is asking for something this site does not have.
  if (html.quality === 0 && markdown.quality === 0) return "unacceptable";

  if (markdown.quality === 0) return "html";
  if (html.quality === 0) return "markdown";

  if (markdown.precision !== html.precision) {
    return markdown.precision > html.precision ? "markdown" : "html";
  }
  // Equal specificity: only a strictly higher q wins, so a wildcard stays HTML.
  return markdown.quality > html.quality ? "markdown" : "html";
}
