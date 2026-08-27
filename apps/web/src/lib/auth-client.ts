import { createAuthClient } from "better-auth/react";

// Requests go to the current origin; the vite dev server (and nginx in
// docker) proxy /api to the NestJS backend, so cookies stay first-party.
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;
