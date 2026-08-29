import { mcp } from "@better-auth/mcp";
// `mcp()` is the OAuth provider plugin underneath, so `auth`'s inferred type
// names types from that package. Importing it here is what lets TypeScript
// write the name down; without it the inference is unportable across the
// pnpm store.
import type {} from "@better-auth/oauth-provider";
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { jwt } from "better-auth/plugins";
import { MongoClient } from "mongodb";
import { MCP_SCOPES, type SocialProvider } from "@mindmap/shared";

const mongoUri = process.env.MONGODB_URI ?? "mongodb://localhost:27017/mindmap";

const client = new MongoClient(mongoUri);

/**
 * The app's public origin — what a browser and an MCP client both type.
 *
 * The whole app is one origin: the web server proxies `/api` to this API (vite
 * in dev, nginx in the image), which is what keeps the session cookie
 * first-party. That was already true for the web client; MCP makes it load
 * bearing on the server too. Better Auth is now an OAuth authorization server,
 * and its `authorize` endpoint answers with a *relative* redirect to the login
 * and consent pages — pages that live in the web app. So the issuer has to be
 * the origin those pages are served from, not the API's own port, or the
 * consent step lands on a 404.
 */
export const APP_URL = process.env.APP_URL ?? "http://localhost:5173";

/**
 * The MCP endpoint's canonical identifier (RFC 8707 / RFC 9728). Access tokens
 * are audience-bound to this exact string, and it is what the protected
 * resource metadata advertises, so it must be the URL an MCP client actually
 * connects to — not an internal address.
 */
export const MCP_RESOURCE_URL =
  process.env.MCP_RESOURCE_URL ?? `${APP_URL}/api/mcp`;

/**
 * Every origin allowed to drive this API — `CLIENT_ORIGIN` as a comma-separated
 * list, with `APP_URL` always in it because that is the app.
 *
 * A list rather than a string because a deployment has more than one legitimate
 * front door: an apex and its `www`, and Vercel's preview URLs, which are a
 * different origin per branch. Better Auth rejects a state-changing request
 * whose `Origin` it does not trust, so a preview deployment left out here can
 * render the app perfectly and fail at sign-in. Better Auth accepts wildcards,
 * which is the only practical way to name previews:
 * `https://*-myteam.vercel.app`.
 */
export const CLIENT_ORIGINS = [
  ...new Set([
    APP_URL,
    ...(process.env.CLIENT_ORIGIN ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  ]),
];

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

/**
 * The social providers this deployment can actually offer — the ones it holds
 * client credentials for.
 *
 * Knowing how to speak to Google is not the same as being allowed to, and a
 * self-hosted instance with no Google app is the normal case rather than a
 * misconfiguration. So the provider is registered only when both halves of its
 * credential are present, and `GET /api/me` reports this list so the account
 * screen never renders a button that would fail on press.
 */
export const SOCIAL_PROVIDERS: SocialProvider[] =
  googleClientId && googleClientSecret ? ["google"] : [];

export const auth = betterAuth({
  baseURL: APP_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: mongodbAdapter(client.db()),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders:
    googleClientId && googleClientSecret
      ? {
          google: {
            clientId: googleClientId,
            clientSecret: googleClientSecret,
          },
        }
      : {},
  account: {
    accountLinking: {
      // Signing in with Google using the address an account already has joins
      // that account rather than starting a second one — otherwise a person
      // who signed up with a password and later pressed "Continue with Google"
      // would find an empty library and no way to explain it.
      //
      // `trustedProviders` is what makes that automatic, and the trust is
      // specifically that the provider verified the address. Google does. A
      // provider that does not must stay off this list, because the join is
      // keyed on email: an unverified one would let anyone who can claim an
      // address at that provider walk into the matching account here.
      enabled: true,
      trustedProviders: ["google"],
      // Better Auth's default, restated because the account screen depends on
      // it: unlinking the last credential would leave an account nobody can
      // sign in to.
      allowUnlinkingAll: false,
    },
  },
  trustedOrigins: CLIENT_ORIGINS,
  plugins: [
    // Access tokens are JWTs verified against this plugin's JWKS, which is how
    // the MCP route can check a token without a database round trip.
    jwt(),
    // `mcp()` *is* the OAuth 2.1 provider, configured for MCP: it binds issued
    // tokens to the resource below and serves the RFC 9728 protected-resource
    // metadata. It cannot be combined with a separate oauthProvider().
    mcp({
      resource: MCP_RESOURCE_URL,
      // Paths on APP_URL, not on this API. The authorize endpoint redirects
      // the browser here and the web app reads the signed query it carries.
      loginPage: "/sign-in",
      consentPage: "/consent",
      // The identity scopes are what make an id token and a *refresh* token
      // possible; without `offline_access` a connected agent would have to
      // send the user back through consent every time its access token aged
      // out. The resource scopes are the ones that actually gate tools.
      scopes: ["openid", "profile", "email", "offline_access", ...MCP_SCOPES],
      // Agent clients are not registered by hand: Claude Code and friends
      // register themselves (RFC 7591) the first time a user connects, before
      // anyone has signed in, so registration has to be open. What that grants
      // is only the right to *ask* — every client still goes through the same
      // login and consent screens, and a token still only carries the scopes
      // the user approved there.
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: true,
      clientRegistrationDefaultScopes: [...MCP_SCOPES],
      clientRegistrationAllowedScopes: [
        "openid",
        "profile",
        "email",
        "offline_access",
        ...MCP_SCOPES,
      ],
      // A public client that cannot keep a secret must prove possession of the
      // code it started the flow with.
      clientRegistrationRequirePKCE: true,
      storeClientSecret: "hashed",
    }),
  ],
});

export type Auth = typeof auth;
