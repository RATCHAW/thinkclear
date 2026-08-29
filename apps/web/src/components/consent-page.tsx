import { useEffect, useState } from "react";
import { Check, Loader2, ShieldCheck } from "lucide-react";
import { MCP_SCOPE_DESCRIPTIONS } from "@thinkclear/shared";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Wordmark } from "@/components/wordmark";
import { authClient } from "@/lib/auth-client";
import { leaveApp } from "@/lib/navigation";
import type { OAuthAuthorization } from "@/lib/oauth-route";

/**
 * The consent screen: the one moment a person decides what an agent client is
 * allowed to do with their mindmaps.
 *
 * It reads the client and the scopes out of the *signed* query the
 * authorization server redirected with, so what is shown is what will be
 * granted — a link cannot be doctored to display less than it asks for. The
 * decision goes back through `oauth2.consent`, which re-checks that signature
 * server-side; this page is where the answer is collected, not where it is
 * trusted.
 */
export function ConsentPage({
  authorization,
  email,
}: {
  authorization: OAuthAuthorization;
  email: string;
}) {
  const clientName = useClientName(authorization.clientId);
  const [error, setError] = useState<string | null>(null);
  const [deciding, setDeciding] = useState<"allow" | "deny" | null>(null);

  async function decide(accept: boolean) {
    setDeciding(accept ? "allow" : "deny");
    setError(null);

    // The signed query rides along automatically — the auth client's oauth
    // plugin puts it on the request.
    const { data, error: failed } = await authClient.oauth2.consent({ accept });

    if (failed || !data?.url) {
      setError(
        failed?.message ??
          "That authorization request has expired. Start again from your agent client.",
      );
      setDeciding(null);
      return;
    }

    // Back to the client with a code, or with the user's refusal. Either way
    // this app is done and the browser leaves. The endpoint hands back the
    // redirect rather than performing it because this call is a fetch, not a
    // navigation.
    leaveApp(data.url);
  }

  return (
    <div className="surface-cloud flex min-h-svh items-center justify-center px-4 py-20">
      <Card className="w-full max-w-md">
        <CardHeader>
          {/* The mark matters more here than anywhere else in the app. A
              person arrives on this screen from someone else's agent client
              and has to decide whether to trust it; the first thing the page
              owes them is whose grant they are about to sign. */}
          <Wordmark />
          <CardTitle className="text-display-md">
            Allow {clientName ?? "this app"} to use your mindmaps?
          </CardTitle>
          <CardDescription>
            It is asking for access to the account {email}.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <ul className="flex flex-col gap-3">
            {authorization.scopes.map((scope) => (
              <li key={scope} className="flex items-start gap-3">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                <span className="text-body-sm">{describe(scope)}</span>
              </li>
            ))}
          </ul>

          {/* A grant is not forever, and saying so here is cheaper than a
              support conversation later. */}
          <p className="flex items-start gap-2 text-caption-md text-charcoal">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" />
            You can revoke this at any time from your account.
          </p>

          {error && <p className="text-caption-md text-destructive">{error}</p>}
        </CardContent>

        <CardFooter className="mt-6 flex-col gap-3">
          <Button
            className="w-full"
            disabled={deciding !== null}
            onClick={() => void decide(true)}
          >
            {deciding === "allow" && <Loader2 className="animate-spin" />}
            Allow access
          </Button>
          <Button
            variant="secondary"
            className="w-full"
            disabled={deciding !== null}
            onClick={() => void decide(false)}
          >
            {deciding === "deny" && <Loader2 className="animate-spin" />}
            Deny
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

/**
 * The client's registered name, once it arrives. A client id is not something
 * a person can recognize, and the screen is worthless if they cannot tell who
 * is asking — but the name is also not worth blocking the screen on, so it
 * fills in.
 */
function useClientName(clientId: string): string | null {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;

    void authClient.oauth2
      .publicClient({ query: { client_id: clientId } })
      .then(({ data }) => {
        const client = data as { client_name?: string; name?: string } | null;
        const label = client?.client_name ?? client?.name;
        if (!cancelled && label) setName(label);
      })
      .catch(() => {
        // Falls back to the generic wording; the scope list is the part that
        // actually has to be right.
      });

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  return name;
}

/**
 * The identity scopes are OIDC's, not this app's, so their wording lives here
 * with the rest of the presentation. The mindmap scopes come from shared,
 * where the server enforces them — the screen and the check read the same
 * list.
 */
const STANDARD_SCOPES: Record<string, string> = {
  openid: "Confirm who you are",
  profile: "See your name",
  email: "See your email address",
  offline_access: "Stay connected without asking you to sign in again",
};

function describe(scope: string): string {
  return (
    MCP_SCOPE_DESCRIPTIONS[scope as keyof typeof MCP_SCOPE_DESCRIPTIONS] ??
    STANDARD_SCOPES[scope] ??
    scope
  );
}
