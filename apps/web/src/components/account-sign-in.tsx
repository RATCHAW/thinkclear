import { KeyRound, Loader2, RotateCw } from "lucide-react";
import {
  PASSWORD_PROVIDER_ID,
  SOCIAL_PROVIDERS,
  SOCIAL_PROVIDER_LABELS,
  isSocialProvider,
  type SocialProvider,
} from "@thinkclear/shared";
import { Button } from "@/components/ui/button";
import {
  useConnectProvider,
  useDisconnectProvider,
  useMe,
  useSignInMethods,
} from "@/hooks/use-account";

/**
 * The ways into this account, and the buttons that add or remove one.
 *
 * Two sources have to agree before a provider is offered: the API says which
 * ones this deployment holds credentials for, and Better Auth says which ones
 * this person has already linked. A provider the server cannot serve is not
 * rendered as a disabled row — it is not rendered at all, because a row for
 * something that will never work is a question the user cannot answer.
 */
export function AccountSignIn() {
  const me = useMe();
  const methods = useSignInMethods();
  const connect = useConnectProvider();
  const disconnect = useDisconnectProvider();

  if (me.isPending || methods.isPending) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="size-5 animate-spin text-graphite" />
      </div>
    );
  }

  if (me.isError || methods.isError) {
    return (
      <div className="py-6 text-center">
        <p className="text-caption-md text-destructive">
          Could not load your sign-in methods.
        </p>
        <Button
          variant="link"
          className="mt-1"
          onClick={() => {
            void me.refetch();
            void methods.refetch();
          }}
        >
          <RotateCw /> Try again
        </Button>
      </div>
    );
  }

  const available = me.data.socialProviders.filter(isSocialProvider);
  const password = methods.data.find(
    (method) => method.providerId === PASSWORD_PROVIDER_ID,
  );
  // Unlinking the last credential would leave an account nobody can sign into,
  // so the server refuses it. Saying so before the press is the difference
  // between a disabled control and an error message.
  const isOnlyMethod = methods.data.length <= 1;
  const error = connect.error ?? disconnect.error;

  return (
    <div>
      <ul className="flex flex-col gap-2">
        {password && (
          <MethodRow
            icon={<KeyRound className="size-4 text-graphite" />}
            name="Email and password"
            status="Enabled"
          />
        )}

        {SOCIAL_PROVIDERS.filter((provider) =>
          available.includes(provider),
        ).map((provider) => {
          const linked = methods.data.find(
            (method) => method.providerId === provider,
          );
          return (
            <MethodRow
              key={provider}
              icon={<ProviderMark provider={provider} />}
              name={SOCIAL_PROVIDER_LABELS[provider]}
              status={linked ? "Connected" : undefined}
              action={
                linked ? (
                  <DisconnectButton
                    name={SOCIAL_PROVIDER_LABELS[provider]}
                    disabled={isOnlyMethod}
                    pending={
                      disconnect.isPending && disconnect.variables === linked.id
                    }
                    onDisconnect={() => disconnect.mutate(linked.id)}
                  />
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={connect.isPending}
                    onClick={() => connect.mutate(provider)}
                  >
                    {connect.isPending && connect.variables === provider && (
                      <Loader2 className="animate-spin" />
                    )}
                    Connect
                  </Button>
                )
              }
            />
          );
        })}
      </ul>

      {available.length === 0 && (
        <p className="mt-3 text-caption-md text-graphite">
          No other sign-in providers are configured on this server.
        </p>
      )}

      {/* Only when there is a disabled Disconnect on screen to explain. With a
          password as the single method nothing here is removable in the first
          place, and the sentence would be about nothing. */}
      {isOnlyMethod && !password && (
        <p className="mt-3 text-caption-md text-graphite">
          This is your only way in, so it can’t be removed. Add another first.
        </p>
      )}

      {error && (
        <p className="mt-3 text-caption-md text-destructive">{error.message}</p>
      )}
    </div>
  );
}

function MethodRow({
  icon,
  name,
  status,
  action,
}: {
  icon: React.ReactNode;
  name: string;
  status?: string;
  action?: React.ReactNode;
}) {
  return (
    // Pinned to 56px so a row with a button and a row without sit at the same
    // height, the way the list rows elsewhere do.
    <li className="flex h-14 items-center gap-3 rounded-lg border border-hairline px-4">
      <span className="grid size-5 shrink-0 place-items-center">{icon}</span>
      <span className="min-w-0 flex-1 truncate text-body-md">{name}</span>
      {status && (
        <span className="shrink-0 text-caption-md text-graphite">{status}</span>
      )}
      {action}
    </li>
  );
}

function DisconnectButton({
  name,
  disabled,
  pending,
  onDisconnect,
}: {
  name: string;
  disabled: boolean;
  pending: boolean;
  onDisconnect: () => void;
}) {
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={disabled || pending}
      aria-label={`Disconnect ${name}`}
      onClick={onDisconnect}
    >
      {pending && <Loader2 className="animate-spin" />}
      Disconnect
    </Button>
  );
}

/**
 * The provider's own mark. These are trademarks with their own colour rules, so
 * they are the one place in the app that reaches outside the palette — a Google
 * "G" recoloured to {colors.primary} would be both wrong and less
 * recognizable, which is the entire job of the glyph.
 */
function ProviderMark({ provider }: { provider: SocialProvider }) {
  if (provider === "google") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden className="size-4">
        <path
          fill="#4285F4"
          d="M23.06 12.25c0-.85-.08-1.67-.22-2.45H12v4.64h6.2a5.3 5.3 0 0 1-2.3 3.48v2.9h3.72c2.18-2 3.44-4.96 3.44-8.57Z"
        />
        <path
          fill="#34A853"
          d="M12 23.5c3.11 0 5.72-1.03 7.62-2.79l-3.72-2.89c-1.03.69-2.35 1.1-3.9 1.1-3 0-5.54-2.03-6.45-4.75H1.7v2.98A11.5 11.5 0 0 0 12 23.5Z"
        />
        <path
          fill="#FBBC05"
          d="M5.55 14.17a6.9 6.9 0 0 1 0-4.34V6.85H1.7a11.5 11.5 0 0 0 0 10.3l3.85-2.98Z"
        />
        <path
          fill="#EA4335"
          d="M12 5.08c1.69 0 3.2.58 4.4 1.72l3.3-3.3C17.72 1.63 15.1.5 12 .5A11.5 11.5 0 0 0 1.7 6.85l3.85 2.98C6.46 7.11 9 5.08 12 5.08Z"
        />
      </svg>
    );
  }
  return null;
}
