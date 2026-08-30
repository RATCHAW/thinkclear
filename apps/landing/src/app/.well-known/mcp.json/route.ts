import { MCP_MANIFEST } from "@/lib/mcp-manifest";

/**
 * Served with `application/json` rather than a bare `.json` in `public/` so the
 * manifest is built from the same constants everything else on this site is —
 * the endpoint moves in one place or in none.
 */
export const dynamic = "force-static";

export function GET(): Response {
  return Response.json(MCP_MANIFEST, {
    headers: {
      // A discovery document is read by clients on origins this site does not
      // control, and there is nothing in it that is not already public.
      "access-control-allow-origin": "*",
      "cache-control": "public, max-age=0, must-revalidate",
    },
  });
}
