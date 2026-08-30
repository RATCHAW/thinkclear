import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * One page, one entry. It is worth having anyway: a crawler that has the file
 * knows the page changed without re-fetching it, and the day this site grows a
 * second URL the discovery path already exists.
 *
 * `lastModified` is build time, which for a statically prerendered marketing
 * page is the only moment its content can have changed.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
