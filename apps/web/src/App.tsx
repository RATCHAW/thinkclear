import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { AuthPage } from "@/components/auth-page";
import { ConsentPage } from "@/components/consent-page";
import { WorkspacePage } from "@/components/workspace-page";
import { useSession } from "@/lib/auth-client";
import { leaveApp } from "@/lib/navigation";
import {
  authorizeUrl,
  parseOAuthAuthorization,
  type OAuthAuthorization,
} from "@/lib/oauth-route";

export default function App() {
  const { data: session, isPending } = useSession();

  // Read straight from the address bar rather than through a subscription:
  // every way into and out of this flow is a server redirect, so the value
  // cannot change under a mounted app the way a workspace route can.
  const authorization = parseOAuthAuthorization(
    window.location.pathname + window.location.search,
  );

  if (isPending) return <Waiting />;

  // An MCP client is asking for access and nobody is signed in. The sign-in
  // form stays on this URL, so finishing it lands back here with a session and
  // the flow picks up where it left off.
  if (!session) return <AuthPage />;

  if (authorization?.screen === "sign-in") {
    return <ResumeAuthorization authorization={authorization} />;
  }

  if (authorization?.screen === "consent") {
    return (
      <ConsentPage authorization={authorization} email={session.user.email} />
    );
  }

  return <WorkspacePage user={session.user} />;
}

/**
 * Hands the flow back to the authorization server now that there is a session.
 * It answers with the next redirect — the consent screen, or straight out to
 * the client if this grant was already given — so the app is only ever passing
 * through here.
 */
function ResumeAuthorization({
  authorization,
}: {
  authorization: OAuthAuthorization;
}) {
  useEffect(() => {
    // `replace`, so Back does not drop the user onto a spent authorization
    // request.
    leaveApp(authorizeUrl(authorization), "replace");
  }, [authorization]);

  return <Waiting />;
}

function Waiting() {
  return (
    <div className="surface-cloud flex min-h-svh items-center justify-center">
      <Loader2 className="size-6 animate-spin text-graphite" />
    </div>
  );
}
