import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SocialProvider } from "@mindmap/shared";
import { api } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";
import { leaveApp } from "@/lib/navigation";

/**
 * Everything the account screen reads and writes.
 *
 * It spans two APIs on purpose. The mindmap API answers what *this deployment*
 * offers — which social providers it has credentials for — while Better Auth
 * answers what *this person* has done with it: which sign-in methods are
 * linked, and which agent clients hold a grant. Neither knows the other's half,
 * and merging them anywhere but here would mean a route whose job was to
 * forward.
 *
 * Better Auth calls go through `authClient` rather than the generated
 * openapi-fetch client for the same reason the chat stream does: those routes
 * are not in this API's OpenAPI document, because it is not this API that
 * serves them.
 */

export const accountKeys = {
  me: ["me"] as const,
  signInMethods: ["sign-in-methods"] as const,
  agents: ["connected-agents"] as const,
};

/**
 * Who the session belongs to, and what this deployment can offer it. The
 * session already carries the user, so what is actually being fetched here is
 * `socialProviders` — but splitting that into a route of its own would be a
 * second request for one field of the same answer.
 */
export function useMe() {
  return useQuery({
    queryKey: accountKeys.me,
    queryFn: async () => {
      const { data, error } = await api.GET("/api/me");
      if (error) throw error;
      return data;
    },
  });
}

export interface SignInMethod {
  /** Better Auth's row id — what `unlinkAccount` takes. */
  id: string;
  providerId: string;
}

/** Every credential that can get into this account, password included. */
export function useSignInMethods() {
  return useQuery({
    queryKey: accountKeys.signInMethods,
    queryFn: async (): Promise<SignInMethod[]> => {
      const { data, error } = await authClient.listAccounts();
      if (error) throw new Error(error.message ?? "Could not load accounts");
      return data ?? [];
    },
  });
}

/**
 * Starts the link. It ends as a full page navigation to the provider and comes
 * back through Better Auth's callback, so nothing after this call runs — which
 * is why `callbackURL` is the URL the app is on right now: settings are
 * addressable, so returning to this exact address returns to this exact screen,
 * with the section the user was reading still open.
 */
export function useConnectProvider() {
  return useMutation({
    mutationFn: async (provider: SocialProvider) => {
      const here = window.location.pathname + window.location.search;
      const { data, error } = await authClient.linkSocial({
        provider,
        callbackURL: here,
        errorCallbackURL: here,
        // The redirect is performed here rather than by the auth client, so
        // that leaving is one observable decision — the same shape the consent
        // screen uses, and the reason a test can watch it without being
        // navigated out from under itself.
        disableRedirect: true,
      });
      if (error || !data?.url) {
        throw new Error(error?.message ?? "Could not start the connection");
      }
      leaveApp(data.url);
    },
  });
}

export function useDisconnectProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (accountId: string) => {
      const { error } = await authClient.unlinkAccount({ accountId });
      if (error) throw new Error(error.message ?? "Could not disconnect");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: accountKeys.signInMethods,
      });
    },
  });
}

export interface ConnectedAgent {
  /** The consent row, which is what revoking deletes. */
  id: string;
  /** What the client registered itself as, falling back to its id. */
  name: string;
  scopes: string[];
}

/**
 * The agent clients holding a grant on this account — the other side of the
 * consent screen, which promises exactly this list exists.
 *
 * A consent row names its client by id, and a client id is not something a
 * person recognizes, so the display name is fetched per client the same way the
 * consent screen fetches it. That is one small request per connected agent,
 * which is fine for a list that is realistically two entries long, and it
 * degrades to the id rather than to nothing.
 */
export function useConnectedAgents() {
  return useQuery({
    queryKey: accountKeys.agents,
    queryFn: async (): Promise<ConnectedAgent[]> => {
      const { data, error } = await authClient.oauth2.getConsents();
      if (error) throw new Error(error.message ?? "Could not load agents");
      const consents = data ?? [];

      const names = await Promise.all(
        consents.map((consent) => clientName(consent.clientId)),
      );
      return consents.map((consent, index) => ({
        id: consent.id,
        name: names[index] ?? consent.clientId,
        scopes: consent.scopes,
      }));
    },
  });
}

export function useRevokeAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await authClient.oauth2.deleteConsent({ id });
      if (error) throw new Error(error.message ?? "Could not revoke access");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: accountKeys.agents });
    },
  });
}

async function clientName(clientId: string): Promise<string | null> {
  try {
    const { data } = await authClient.oauth2.publicClient({
      query: { client_id: clientId },
    });
    const client = data as { client_name?: string; name?: string } | null;
    return client?.client_name ?? client?.name ?? null;
  } catch {
    return null;
  }
}
