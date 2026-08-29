/**
 * Everything this page knows about the rest of the product.
 *
 * The landing app is deployed on its own, separately from `apps/web`, and it
 * reaches the app the way any other visitor does — by URL. So these are
 * written literally, for the same reason the API host is written literally in
 * the root `vercel.json`: they are per-deployment facts, and one place to
 * change them beats an environment variable that fails silently when it is
 * missing.
 */

/** The origin `apps/web` is served on — the value `APP_URL` names for the API. */
export const APP_URL = "https://app.thinkclear.xyz";

/** Where an agent client is pointed. `/api` is proxied to the API behind it. */
export const MCP_ENDPOINT = `${APP_URL}/api/mcp`;

/** The way in. The app decides whether that is sign-in or straight to a map. */
export const SIGN_UP_URL = APP_URL;

/** The MCP setup guide inside the app, deep-linked to its section. */
export const MCP_GUIDE_URL = `${APP_URL}/?account=mcp`;

export const GITHUB_URL = "https://github.com/RATCHAW/thinkclear";
export const GITHUB_README_URL = `${GITHUB_URL}#readme`;
export const GITHUB_DEPLOYMENT_URL = `${GITHUB_URL}/blob/main/DEPLOYMENT.md`;
export const GITHUB_DESIGN_URL = `${GITHUB_URL}/blob/main/DESIGN.md`;
export const GITHUB_LICENSE_URL = `${GITHUB_URL}/blob/main/LICENSE`;

export const SITE_NAME = "ThinkClear";
export const SITE_URL = "https://thinkclear.xyz";
export const SITE_TAGLINE =
  "A mindmap canvas with an assistant that can build it — and an MCP server so your own agent can too.";
