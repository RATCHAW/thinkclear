/**
 * The authorization surface's URL grammar — the one part of the app the *user*
 * does not navigate to. Better Auth's authorize endpoint redirects here when
 * an MCP client asks for access, and reads the answer back out of the same
 * query it sent:
 *
 *   /sign-in?<signed authorization query>   sign in, then resume
 *   /consent?<signed authorization query>   approve the scopes, then resume
 *
 * The query is signed, which is what makes these screens trustworthy: the
 * client, the scopes, and the redirect the user is approving are the ones the
 * authorization server put there, not ones an attacker appended to a link. So
 * it is carried verbatim and handed back untouched — this module reads it,
 * never rewrites it.
 *
 * It is deliberately separate from `workspace-route.ts`. That grammar
 * describes what the user has open and is navigated through `pushState`; this
 * one describes a flow the server drives with real redirects, and every exit
 * from it is a full page load.
 */

export type OAuthScreen = "sign-in" | "consent";

export interface OAuthAuthorization {
  screen: OAuthScreen;
  /** The client asking for access, by the id it registered under. */
  clientId: string;
  /** The scopes it is asking for, in the order it asked. */
  scopes: string[];
  /** The signed query, exactly as it arrived, leading `?` included. */
  query: string;
}

const SCREENS: Record<string, OAuthScreen> = {
  "/sign-in": "sign-in",
  "/consent": "consent",
};

export function parseOAuthAuthorization(
  url: string,
): OAuthAuthorization | null {
  const { pathname, search, searchParams } = new URL(
    url,
    "http://workspace.invalid",
  );

  const screen = SCREENS[pathname];
  // The signature is what separates a real authorization redirect from
  // someone typing `/consent` into the address bar, and it is checked again
  // on the server. Without one there is nothing to consent to, so the app
  // falls through to its ordinary routing rather than showing an empty
  // approval screen.
  if (!screen || !searchParams.get("sig")) return null;

  return {
    screen,
    clientId: searchParams.get("client_id") ?? "",
    scopes: (searchParams.get("scope") ?? "").split(" ").filter(Boolean),
    query: search,
  };
}

/**
 * Back to the authorize endpoint to resume the flow, carrying the same signed
 * query. This is a real navigation, not a `pushState`: what happens next is a
 * server redirect — on to consent, or out to the client with a code.
 */
export function authorizeUrl(authorization: OAuthAuthorization): string {
  return `/api/auth/oauth2/authorize${authorization.query}`;
}
