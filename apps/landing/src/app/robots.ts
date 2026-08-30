import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * The landing page wants to be crawled — all of it — so this file exists for
 * the one thing a permissive robots.txt is still for: naming the sitemap.
 *
 * The app's own robots.txt is a different document with a different job, and
 * it lives in `apps/web/public` because that host is a different deployment.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
