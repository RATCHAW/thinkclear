import { useState } from "react";
import { Loader2, RotateCw, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Snippet } from "@/components/snippet";
import {
  useConnectedAgents,
  useRevokeAgent,
  type ConnectedAgent,
} from "@/hooks/use-account";
import {
  MCP_CLIENTS,
  mcpEndpointUrl,
  type McpSetupStep,
} from "@/lib/mcp-connection";
import { cn } from "@/lib/utils";

/**
 * The MCP section: the address, how to hand it to a client, and who is holding
 * a key.
 *
 * Those three are one section rather than three because they are one task read
 * at different times — you copy the endpoint once, follow the steps once, and
 * come back months later only to see what is connected. Splitting them would
 * put the answer to "what did I connect?" somewhere other than the page that
 * explains connecting.
 */
export function AccountMcp() {
  const endpoint = mcpEndpointUrl();

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h3 className="text-caption-bold uppercase text-graphite">Endpoint</h3>
        <Snippet className="mt-2" text={endpoint} label="the MCP endpoint" />
        <p className="mt-2 text-caption-md text-graphite">
          Any MCP client can use this address. There is no token to create — the
          client sends you back here to sign in and to approve what it may do.
        </p>
      </section>

      <SetupGuide endpoint={endpoint} />
      <ConnectedAgents />
    </div>
  );
}

/**
 * Which client the user is reading about is deliberately not in the URL. It is
 * a preference held for the length of one visit, not a place they can be — the
 * same line the note windows draw between what they are and where they sit.
 */
function SetupGuide({ endpoint }: { endpoint: string }) {
  const [clientId, setClientId] = useState(MCP_CLIENTS[0].id);
  const client = MCP_CLIENTS.find((entry) => entry.id === clientId)!;
  const aside = client.aside(endpoint);

  return (
    <section>
      <h3 className="text-caption-bold uppercase text-graphite">
        Setting one up
      </h3>

      <div
        role="group"
        aria-label="Agent client"
        className="mt-2 inline-flex gap-1 rounded-lg bg-cloud p-1"
      >
        {MCP_CLIENTS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            aria-pressed={entry.id === clientId}
            onClick={() => setClientId(entry.id)}
            className={cn(
              "h-8 rounded-md px-3 text-caption-md outline-none",
              "transition-[color,background-color,box-shadow,transform] duration-[160ms] ease-out-strong",
              "active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-ring",
              entry.id === clientId
                ? "bg-paper text-ink shadow-soft-lift"
                : "text-graphite hover:text-foreground",
            )}
          >
            {entry.name}
          </button>
        ))}
      </div>

      {/* Keyed on the client so the steps fade rather than cut when the
          selection changes — the block changes height, and a swap that lands
          in one frame reads as the page jumping. */}
      <ol key={clientId} className="mt-4 flex animate-fade-in flex-col gap-4">
        {client.steps(endpoint).map((step, index) => (
          <li key={step.text} className="flex gap-3">
            <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-pill bg-cloud text-caption-sm text-graphite">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <Step step={step} label={`step ${index + 1}`} />
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-4 border-l-2 border-hairline pl-3">
        <Step step={aside} label={`the ${client.name} alternative`} />
      </div>
    </section>
  );
}

function Step({ step, label }: { step: McpSetupStep; label: string }) {
  return (
    <>
      <p className="text-caption-md text-charcoal">{step.text}</p>
      {step.snippet && (
        <Snippet className="mt-2" text={step.snippet} label={label} />
      )}
    </>
  );
}

function ConnectedAgents() {
  const agents = useConnectedAgents();
  const revoke = useRevokeAgent();
  const [confirming, setConfirming] = useState<string | null>(null);

  return (
    <section>
      <h3 className="text-caption-bold uppercase text-graphite">
        Connected agents
      </h3>

      {agents.isPending ? (
        <div className="flex justify-center py-6">
          <Loader2 className="size-5 animate-spin text-graphite" />
        </div>
      ) : agents.isError ? (
        <div className="py-4">
          <p className="text-caption-md text-destructive">
            Could not load connected agents.
          </p>
          <Button
            variant="link"
            className="mt-1"
            onClick={() => void agents.refetch()}
          >
            <RotateCw /> Try again
          </Button>
        </div>
      ) : agents.data.length === 0 ? (
        <p className="mt-2 text-caption-md text-graphite">
          Nothing is connected yet. Follow the steps above, and whatever you
          approve shows up here.
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {agents.data.map((agent) => (
            <AgentRow
              key={agent.id}
              agent={agent}
              confirming={confirming === agent.id}
              revoking={revoke.isPending && revoke.variables === agent.id}
              onConfirm={() => setConfirming(agent.id)}
              onCancel={() => setConfirming(null)}
              onRevoke={() => {
                setConfirming(null);
                revoke.mutate(agent.id);
              }}
            />
          ))}
        </ul>
      )}

      {revoke.error && (
        <p className="mt-3 text-caption-md text-destructive">
          {revoke.error.message}
        </p>
      )}
    </section>
  );
}

function AgentRow({
  agent,
  confirming,
  revoking,
  onConfirm,
  onCancel,
  onRevoke,
}: {
  agent: ConnectedAgent;
  confirming: boolean;
  revoking: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onRevoke: () => void;
}) {
  return (
    // Both states share the row height, so confirming never shifts the list
    // under the pointer that is about to answer.
    <li className="flex h-14 items-center gap-3 rounded-lg border border-hairline px-4">
      {confirming ? (
        <>
          <p className="flex min-w-0 flex-1 items-center text-caption-md text-charcoal">
            <span className="shrink-0">Revoke&nbsp;</span>
            <span className="truncate">{agent.name}</span>
            <span className="shrink-0">’s access?</span>
          </p>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="destructive" size="sm" autoFocus onClick={onRevoke}>
            Revoke
          </Button>
        </>
      ) : (
        <>
          <Terminal className="size-4 shrink-0 text-graphite" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-body-md">{agent.name}</p>
            <p className="truncate text-caption-sm text-graphite">
              {accessLabel(agent.scopes)}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            disabled={revoking}
            aria-label={`Revoke access for ${agent.name}`}
            onClick={onConfirm}
          >
            {revoking && <Loader2 className="animate-spin" />}
            Revoke
          </Button>
        </>
      )}
    </li>
  );
}

/**
 * One sentence rather than the scope list the consent screen shows. Consent is
 * the moment the decision is made and every line has to be read; this is the
 * ledger afterwards, where "what can it do" is the only question, and the
 * identity scopes that came along with it are noise.
 */
function accessLabel(scopes: string[]): string {
  return scopes.includes("mindmaps:write")
    ? "Can read and change your mindmaps"
    : "Can read your mindmaps";
}
