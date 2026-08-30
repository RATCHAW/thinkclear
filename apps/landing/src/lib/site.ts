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

/** The line on the page. Written to be read by a person, in the footer. */
export const SITE_TAGLINE =
  "A mindmap canvas with an assistant that can build it — and an MCP server so your own agent can too.";

/**
 * The line in the `<head>`, which is a different job and so a different
 * sentence. A search result has ~155 characters of room and no surrounding
 * page to lean on, so this one spends them naming the things somebody could
 * plausibly have typed to get here — mindmap, open source, MCP — where the
 * tagline can assume you are already looking at the product.
 */
export const SITE_DESCRIPTION =
  "Open-source mindmap canvas with an assistant that builds it with you, plus an MCP server so Claude Code or any agent you use can edit the same maps.";

/**
 * The title tag, and deliberately not the headline. "Think out loud" is what
 * the page says to somebody who is already on it; this is what has to win a
 * click from a result list against nine other blue links, none of which the
 * reader has heard of either.
 */
export const SITE_TITLE = `${SITE_NAME} — the AI mindmap your agent can edit too`;

/**
 * `rel="noreferrer"` is deliberate on anything leaving for somebody else's
 * origin: a third party has no business being told which page sent a visitor,
 * on top of the `Referrer-Policy` header that already trims the path off.
 *
 * The app is not a third party. It is the other half of this product, and
 * withholding the referrer there buys no privacy at all — it only means the
 * app reads every arrival from this page as direct traffic, which makes the
 * one number this page exists to move impossible to measure.
 */
export function isFirstParty(href: string): boolean {
  return href === APP_URL || href.startsWith(`${APP_URL}/`);
}
