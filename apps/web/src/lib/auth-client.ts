import { oauthProviderClient } from "@better-auth/oauth-provider/client";
import { createAuthClient } from "better-auth/react";

// Requests go to the current origin; the vite dev server (and nginx in
// docker) proxy /api to the NestJS backend, so cookies stay first-party.
export const authClient = createAuthClient({
  // Adds the `oauth2` actions the consent screen calls, and — the part that is
  // easy to miss — a fetch hook that attaches the signed authorization query
  // from the address bar to those calls. That is why the consent page never
  // passes the query itself: it is already on the request.
  plugins: [oauthProviderClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
