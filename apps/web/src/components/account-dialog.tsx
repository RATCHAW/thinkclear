import { useState } from "react";
import { KeyRound, Loader2, LogOut, Plug, User } from "lucide-react";
import { AccountMcp } from "@/components/account-mcp";
import { AccountSignIn } from "@/components/account-sign-in";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  closeAccount,
  setAccountSection,
  useWorkspaceRoute,
} from "@/hooks/use-workspace-route";
import { signOut } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { ACCOUNT_SECTIONS, type AccountSection } from "@/lib/workspace-route";

/**
 * Everything about the person rather than about their mindmaps: who they are,
 * how they get in, and which agents they have let in.
 *
 * It is a modal rather than a fourth panel over the canvas. The canvas is the
 * page and the library and assistant float over it because they are used
 * *while* working; settings are somewhere you go, finish, and leave, and a
 * surface that is rarely opened should not be permanently reachable chrome.
 * The panel's own height is fixed for the same reason the rows in a list are:
 * a box that resizes as you move between sections turns navigating it into
 * something you have to watch.
 *
 * Sections are addressable (`?account=mcp`), so "here is how you connect Claude
 * Code" is a link somebody can send — and so returning from Google's consent
 * screen lands back on the section that sent them there, with nothing to
 * restore.
 */

const SECTIONS: Record<
  AccountSection,
  { label: string; icon: typeof User; title: string; description: string }
> = {
  profile: {
    label: "Profile",
    icon: User,
    title: "Profile",
    description: "The account these mindmaps belong to.",
  },
  "sign-in": {
    label: "Sign-in",
    icon: KeyRound,
    title: "How you sign in",
    description:
      "Every way into this account. Adding one never replaces another.",
  },
  mcp: {
    label: "MCP",
    icon: Plug,
    title: "Agents and MCP",
    description:
      "Let Claude Code, Codex, or any MCP client work with your mindmaps.",
  },
};

export function AccountDialog({
  user,
}: {
  user: { email: string; name: string };
}) {
  const { accountSection } = useWorkspaceRoute();

  return (
    <Dialog
      open={accountSection !== null}
      onOpenChange={(open) => {
        if (!open) closeAccount();
      }}
    >
      {/* Radix unmounts this subtree when the dialog is closed, which is what
          keeps the account queries below from running for someone who never
          opens it — and what replays the entrance every time they do. */}
      {accountSection && <AccountPanel section={accountSection} user={user} />}
    </Dialog>
  );
}

function AccountPanel({
  section,
  user,
}: {
  section: AccountSection;
  user: { email: string; name: string };
}) {
  const current = SECTIONS[section];

  return (
    <DialogContent className="h-[min(36rem,calc(100svh-1rem))] gap-0 p-0 sm:max-w-3xl">
      <DialogHeader className="shrink-0 border-b border-hairline py-4 pr-16 pl-5">
        <DialogTitle>Account</DialogTitle>
        <DialogDescription>
          Your profile, how you sign in, and the agents you have connected.
        </DialogDescription>
      </DialogHeader>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <nav
          aria-label="Account settings"
          className="flex shrink-0 gap-1 overflow-x-auto border-b border-hairline p-2 md:w-52 md:flex-col md:overflow-x-visible md:border-r md:border-b-0"
        >
          {ACCOUNT_SECTIONS.map((id) => (
            <SectionTab key={id} id={id} active={id === section} />
          ))}
        </nav>

        {/* Keyed so the fade replays on every switch. It is short and carries
            no travel: this is a swap of what is on screen, not something
            arriving from a direction. */}
        <div
          key={section}
          className="min-h-0 flex-1 animate-fade-in overflow-y-auto px-5 py-5"
        >
          <h2 className="text-body-emphasis">{current.title}</h2>
          <p className="mt-1 text-caption-md text-graphite">
            {current.description}
          </p>

          <div className="mt-5">
            {section === "profile" && <AccountProfile user={user} />}
            {section === "sign-in" && <AccountSignIn />}
            {section === "mcp" && <AccountMcp />}
          </div>
        </div>
      </div>
    </DialogContent>
  );
}

function SectionTab({ id, active }: { id: AccountSection; active: boolean }) {
  const { label, icon: Icon } = SECTIONS[id];

  return (
    <button
      type="button"
      onClick={() => setAccountSection(id)}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-10 shrink-0 items-center gap-2 rounded-md px-3 text-left outline-none",
        "transition-[color,background-color] duration-[160ms] ease-out-strong",
        "focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-cloud text-ink"
          : "text-graphite hover:bg-cloud hover:text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="text-body-md">{label}</span>
    </button>
  );
}

function AccountProfile({ user }: { user: { email: string; name: string } }) {
  return (
    <div>
      <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-6 gap-y-3">
        <dt className="text-caption-md text-graphite">Name</dt>
        <dd className="min-w-0 truncate text-body-md">{user.name}</dd>
        <dt className="text-caption-md text-graphite">Email</dt>
        <dd className="min-w-0 truncate text-body-md">{user.email}</dd>
      </dl>

      <div className="mt-6 border-t border-hairline pt-5">
        <SignOutButton />
      </div>
    </div>
  );
}

function SignOutButton() {
  const [signingOut, setSigningOut] = useState(false);

  return (
    <Button
      variant="secondary"
      disabled={signingOut}
      onClick={async () => {
        setSigningOut(true);
        await signOut();
        setSigningOut(false);
      }}
    >
      {signingOut ? <Loader2 className="animate-spin" /> : <LogOut />}
      Sign out
    </Button>
  );
}
