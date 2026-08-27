import { useState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { signOut } from "@/lib/auth-client";

export function WelcomePage({
  user,
}: {
  user: { email: string; name: string };
}) {
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    setSigningOut(false);
  }

  return (
    <div className="surface-cloud flex min-h-svh items-center justify-center px-4 py-20">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="text-display-md break-words">
            Welcome {user.email}
          </CardTitle>
          <CardDescription>
            You are signed in{user.name ? ` as ${user.name}` : ""}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* `button-outline-ink` — neutral against the blue primary. */}
          <Button
            variant="secondary"
            onClick={handleSignOut}
            disabled={signingOut}
          >
            <LogOut /> Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
