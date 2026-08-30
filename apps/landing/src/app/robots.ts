import type { MetadataRoute } from "next";
import { SITEMAP_URL } from "@/lib/site";

/**
 * The landing page wants to be crawled — all of it — so this file exists for
 * the one thing a permissive robots.txt is still for: naming the sitemap.
 *
 * `host` is here for a second reason. A crawler that reaches this domain by
 * some other name should be told which one is canonical, and the brand-search
 * problem this site has is partly a problem of one product answering to several
 * hostnames.
 *
 * The app's own robots.txt is a different document with a different job, and
 * it lives in `apps/web/public` because that host is a different deployment.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: SITEMAP_URL,
    host: "thinkclear.xyz",
  };
}
