import { useEffect, useMemo, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  getToolName,
  isToolUIPart,
  type DynamicToolUIPart,
  type ToolUIPart,
} from "ai";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Check,
  Loader2,
  RotateCw,
  Sparkles,
  X,
} from "lucide-react";
import { MUTATING_CHAT_TOOLS } from "@mindmap/shared";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import { useActiveMindmap, mindmapKeys } from "@/hooks/use-mindmaps";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";

/**
 * The AI side panel: a floating chat over the canvas that edits mindmaps
 * through the server's tools. It stays mounted while the workspace is open —
 * closing the panel hides it without dropping the conversation — and slides
 * in from the right edge with the same inset-and-float treatment as the
 * library sheet.
 */
export function MindmapChat() {
  const open = useUiStore((state) => state.chatOpen);
  const setOpen = useUiStore((state) => state.setChatOpen);
  const selectMindmap = useUiStore((state) => state.selectMindmap);
  const activeMindmap = useActiveMindmap();
  const queryClient = useQueryClient();

  // Same-origin plain fetch: the SSE response can't go through the typed
  // openapi-fetch client, and the session cookie rides along on its own.
  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat" }),
    [],
  );
  const { messages, sendMessage, status, error, regenerate, stop } = useChat({
    transport,
  });

  // The server's tools write straight to Mongo, so the canvas finds out here:
  // every finished mutating tool call invalidates the mindmap list, and the
  // refetched document's updatedAt tells the open editor to reseed. A newly
  // created mindmap is opened on the canvas right away.
  const handledToolCalls = useRef(new Set<string>());
  useEffect(() => {
    for (const message of messages) {
      if (message.role !== "assistant") continue;
      for (const part of message.parts) {
        if (!isToolUIPart(part) || part.state !== "output-available") continue;
        if (handledToolCalls.current.has(part.toolCallId)) continue;
        handledToolCalls.current.add(part.toolCallId);
        const toolName = getToolName(part);
        if (!(MUTATING_CHAT_TOOLS as readonly string[]).includes(toolName)) {
          continue;
        }
        void queryClient.invalidateQueries({ queryKey: mindmapKeys.all });
        const output = part.output as
          { mindmapId?: string; error?: string } | undefined;
        if (
          toolName === "create_mindmap" &&
          output?.mindmapId &&
          !output.error
        ) {
          selectMindmap(output.mindmapId);
        }
      }
    }
  }, [messages, queryClient, selectMindmap]);

  function handleSubmit(message: PromptInputMessage) {
    const text = message.text?.trim();
    if (!text || status === "submitted" || status === "streaming") return;
    void sendMessage(
      { text },
      { body: { mindmapId: activeMindmap?._id ?? null } },
    );
  }

  const busy = status === "submitted" || status === "streaming";

  return (
    <aside
      aria-label="AI assistant"
      aria-hidden={!open}
      inert={!open}
      className={cn(
        // Floating Modal treatment, mirrored from the library sheet: paper on
        // {rounded.xl} with the Floating shadow, inset 8px from the viewport.
        "absolute inset-y-2 right-2 z-20 flex w-[min(24rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-xl bg-paper shadow-floating",
        "transition-[transform,opacity] motion-reduce:transition-[opacity]",
        open
          ? "translate-x-0 opacity-100 duration-[280ms] ease-drawer"
          : "pointer-events-none translate-x-[calc(100%+1.5rem)] opacity-0 duration-[200ms] ease-out-strong motion-reduce:translate-x-0",
      )}
    >
      <header className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-4">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-display-xs">
            <Sparkles className="size-4 text-primary" />
            Assistant
          </h2>
          <p className="mt-1 truncate text-caption-sm text-graphite">
            {activeMindmap
              ? `Working on “${activeMindmap.title}”`
              : "No mindmap open — ask for a new one"}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close assistant"
          onClick={() => setOpen(false)}
        >
          <X />
        </Button>
      </header>

      <Conversation className="flex-1">
        <ConversationContent className="gap-6 px-5 py-4">
          {messages.length === 0 ? (
            <ConversationEmptyState
              className="text-graphite"
              icon={<Sparkles className="size-5" />}
              title="Build mindmaps by talking"
              description="Try “create a mindmap about learning TypeScript” or “add three subtopics under Testing”."
            />
          ) : (
            messages.map((message) => (
              <Message from={message.role} key={message.id}>
                <MessageContent className="text-body-md">
                  {message.parts.map((part, index) =>
                    part.type === "text" ? (
                      <MessageResponse key={index}>{part.text}</MessageResponse>
                    ) : isToolUIPart(part) ? (
                      <ToolActivity key={index} part={part} />
                    ) : null,
                  )}
                </MessageContent>
              </Message>
            ))
          )}
          {status === "submitted" && (
            <Shimmer className="text-caption-md">Thinking…</Shimmer>
          )}
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-bloom-rose/30 px-3 py-2 text-caption-md text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              <span className="min-w-0 flex-1">{friendlyError(error)}</span>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => void regenerate()}
              >
                <RotateCw /> Retry
              </Button>
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton aria-label="Scroll to latest message" />
      </Conversation>

      <div className="border-t border-hairline p-3">
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputBody>
            <PromptInputTextarea
              placeholder={
                activeMindmap
                  ? "Ask for topics, changes, cleanups…"
                  : "Describe the mindmap you want…"
              }
            />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools />
            <PromptInputSubmit
              status={status}
              onStop={busy ? stop : undefined}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </aside>
  );
}

/**
 * A failed chat request carries the raw response body as the error message;
 * when that body is Nest's JSON error envelope, show its `message` instead of
 * the serialized JSON.
 */
function friendlyError(error: Error): string {
  try {
    const parsed = JSON.parse(error.message) as { message?: unknown };
    if (typeof parsed.message === "string") return parsed.message;
  } catch {
    // Not JSON — show it as is.
  }
  return error.message;
}

/** One line per tool call: what the assistant is doing to the mindmap. */
function ToolActivity({ part }: { part: ToolUIPart | DynamicToolUIPart }) {
  const toolName = getToolName(part);
  const output = part.output as
    { summary?: string; error?: string } | undefined;
  const failed = part.state === "output-error" || Boolean(output?.error);
  const done = part.state === "output-available" && !failed;
  const label = failed
    ? (output?.error ?? part.errorText ?? "Something went wrong")
    : (output?.summary ?? TOOL_LABELS[toolName] ?? toolName);

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 self-start rounded-lg border border-hairline bg-cloud px-2.5 py-1.5 text-caption-sm",
        failed ? "text-destructive" : "text-charcoal",
      )}
    >
      {done ? (
        <Check className="size-3 shrink-0 text-primary" />
      ) : failed ? (
        <AlertCircle className="size-3 shrink-0" />
      ) : (
        <Loader2 className="size-3 shrink-0 animate-spin" />
      )}
      <span className="min-w-0 truncate">{label}</span>
    </span>
  );
}

/** Shown while a tool runs, before its result (with `summary`) arrives. */
const TOOL_LABELS: Record<string, string> = {
  list_mindmaps: "Looking through your mindmaps",
  read_mindmap: "Reading the mindmap",
  create_mindmap: "Creating a mindmap",
  rename_mindmap: "Renaming the mindmap",
  delete_mindmap: "Deleting the mindmap",
  add_topics: "Adding topics",
  rename_topic: "Renaming a topic",
  move_topic: "Moving a topic",
  delete_topics: "Deleting topics",
};
