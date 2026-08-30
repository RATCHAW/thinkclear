import type { Metadata } from "next";
import type { SiteDocument } from "@/lib/documents";
import { SITE_NAME } from "@/lib/site";

/**
 * The `<head>` of a written page, derived from the document rather than typed
 * out beside it.
 *
 * The title carries the product name because these are exactly the pages
 * somebody reaches by searching for it — "ThinkClear privacy", "ThinkClear MCP"
 * — and a result that reads only "Privacy" wins none of them. The root layout's
 * template appends it, so this passes the bare title and lets the template do
 * the joining.
 */
export function documentMetadata(doc: SiteDocument): Metadata {
  const title = doc.title.startsWith(SITE_NAME)
    ? doc.title
    : `${doc.title} · ${SITE_NAME}`;

  return {
    // `absolute` because the layout's template would otherwise append the name
    // a second time to the titles that already open with it.
    title: { absolute: title },
    description: doc.description,
    alternates: { canonical: doc.path },
    openGraph: {
      type: "article",
      url: doc.path,
      siteName: SITE_NAME,
      title,
      description: doc.description,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: doc.description,
    },
  };
}
