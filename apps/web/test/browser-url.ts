/**
 * The workspace has no client-side store to seed: it reads `window.location`,
 * so a test that wants to start inside a mindmap or a chat arrives the way a
 * user following a link would, and asserts on where the app navigated to.
 */

/** `replaceState`, so entries don't stack up across tests. */
export function visit(url: string): void {
  window.history.replaceState(null, "", url);
}

/** Where the app is now, in the same shape `visit` takes. */
export function currentUrl(): string {
  return window.location.pathname + window.location.search;
}
