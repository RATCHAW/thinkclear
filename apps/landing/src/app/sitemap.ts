import type { MetadataRoute } from "next";
import { SITE_DOCUMENTS } from "@/lib/documents";
import { SITE_URL } from "@/lib/site";

/**
 * Every URL on this domain, built from the same document list the pages and the
 * 404's recovery links are — so a page added there appears here without anybody
 * remembering to add it, which is the only way a sitemap stays true.
 *
 * `lastModified` is build time, which for a statically prerendered marketing
 * site is the only moment its content can have changed.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: SITE_URL,
      lastModified,
      changeFrequency: "monthly",
      priority: 1,
    },
    ...SITE_DOCUMENTS.map((doc) => ({
      url: `${SITE_URL}${doc.path}`,
      lastModified,
      changeFrequency: "monthly" as const,
      // The MCP reference is the page a developer or an agent is looking for by
      // name; the trust pages are read once, on the way to deciding.
      priority: doc.path === "/mcp" ? 0.8 : 0.5,
    })),
  ];
}
