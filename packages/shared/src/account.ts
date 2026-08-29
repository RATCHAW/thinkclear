/**
 * The ways into an account, named once so the API and the account screen agree.
 *
 * Better Auth owns the mechanics — linking, unlinking, and the redirect dance —
 * but it has no opinion about which providers *this* app offers or what they
 * are called on screen. That belongs here for the same reason
 * `MCP_SCOPE_DESCRIPTIONS` does: the API decides which providers it actually
 * has credentials for and the web app renders the list, so a label kept only in
 * the web app would be a second source of truth for a name the two share.
 */

/**
 * Better Auth's provider id for email and password. It is not a social
 * provider and never appears in the list below, but `list-accounts` returns it
 * alongside the linked ones — which is what lets the sign-in screen say "you
 * have a password" without a second query, and what makes "don't unlink your
 * last way in" a count over one list rather than a special case.
 */
export const PASSWORD_PROVIDER_ID = "credential";

/**
 * Social providers this app knows how to offer, in the order they are shown.
 *
 * Knowing *how* is not the same as being able to: a provider needs client
 * credentials, and a deployment that has none must not show a button that
 * cannot work. `GET /api/me` answers with the subset that is configured, and
 * this list is what that subset is drawn from.
 */
export const SOCIAL_PROVIDERS = ["google"] as const;

export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number];

export const SOCIAL_PROVIDER_LABELS: Record<SocialProvider, string> = {
  google: "Google",
};

export function isSocialProvider(value: string): value is SocialProvider {
  return (SOCIAL_PROVIDERS as readonly string[]).includes(value);
}
