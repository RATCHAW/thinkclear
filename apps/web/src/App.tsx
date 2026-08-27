import { Loader2 } from "lucide-react";
import { AuthPage } from "@/components/auth-page";
import { WelcomePage } from "@/components/welcome-page";
import { useSession } from "@/lib/auth-client";

export default function App() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <div className="surface-cloud flex min-h-svh items-center justify-center">
        <Loader2 className="size-6 animate-spin text-graphite" />
      </div>
    );
  }

  return session ? <WelcomePage user={session.user} /> : <AuthPage />;
}
