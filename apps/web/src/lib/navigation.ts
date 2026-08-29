/**
 * Leaving the app for a URL the app does not own.
 *
 * Everywhere else navigation is `pushState` over `workspace-route.ts` and the
 * page never reloads. The OAuth flow is the exception: it hands control back
 * to the authorization server, and then to whichever agent client started it,
 * so these are real navigations to somewhere React is not.
 *
 * It is a function rather than a bare `window.location` assignment so the
 * destination is observable — a test can watch where the app decided to send
 * the user without the harness being navigated away mid-assertion.
 */
export function leaveApp(url: string, mode: "push" | "replace" = "push"): void {
  if (mode === "replace") window.location.replace(url);
  else window.location.href = url;
}
