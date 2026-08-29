import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  getToolName,
  isToolUIPart,
  type DynamicToolUIPart,
  type ToolUIPart,
  type UIMessage,
} from "ai";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Check,
  History,
  Loader2,
  RotateCw,
  Sparkles,
  SquarePen,
  X,
} from "lucide-react";
import {
  conversationTitleFromMessage,
  DEFAULT_CONVERSATION_TITLE,
  MUTATING_CHAT_TOOLS,
} from "@mindmap/shared";
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
import { AssistantHistory } from "@/components/assistant-history";
import { Button } from "@/components/ui/button";
import {
  conversationKeys,
  useConversation,
  useCreateConversation,
} from "@/hooks/use-conversations";
import { useActiveMindmap, mindmapKeys } from "@/hooks/use-mindmaps";
import {
  openConversation,
  openMindmap,
  setAssistantOpen,
  setHistoryOpen,
  useWorkspaceRoute,
} from "@/hooks/use-workspace-route";
import { cn } from "@/lib/utils";

/** Membership is checked once per finished tool call, so it is a set. */
const MUTATING_TOOLS = new Set<string>(MUTATING_CHAT_TOOLS);

/**
 * The assistant: a floating panel over the workspace that manages the user's
 * whole library by conversation — creating, renaming, reorganizing, and
 * deleting mindmaps as well as editing the topics inside them. It is app
 * chrome, not part of the canvas: the mindmap that happens to be open is
 * context it is told about, not the thing it is bound to.
 *
 * Conversations are stored server-side, so the panel is also the entry point
 * to chat history — a layer over the conversation, one press away.
 */
export function AssistantPanel() {
  const {
    assistantOpen: open,
    historyOpen,
    conversationId: activeConversationId,
  } = useWorkspaceRoute();
  const activeMindmap = useActiveMindmap();
  const queryClient = useQueryClient();

  const createConversation = useCreateConversation();
  const { data: conversation } = useConversation(activeConversationId);

  // `useChat` builds its store once, so the callbacks below can't close over
  // the conversation id — it is read from a ref kept in step with the store.
  const conversationIdRef = useRef(activeConversationId);
  useEffect(() => {
    conversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  // Same-origin plain fetch: the SSE response can't go through the typed
  // openapi-fetch client, and the session cookie rides along on its own.
  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat" }),
    [],
  );
  const {
    messages,
    setMessages,
    sendMessage,
    status,
    error,
    regenerate,
    stop,
  } = useChat({
    transport,
    // The server wrote the turn as it streamed. Refreshing both queries keeps
    // the history list's title order honest and stops a later revisit from
    // rendering this conversation without the exchange that just happened.
    onFinish: () => {
      void queryClient.invalidateQueries({ queryKey: conversationKeys.list });
      const id = conversationIdRef.current;
      if (id) {
        void queryClient.invalidateQueries({
          queryKey: conversationKeys.detail(id),
        });
      }
    },
  });

  // Which conversation's stored messages `useChat` is currently showing.
  // Tracked rather than assumed because seeding waits on a fetch, and because
  // sending the first message adopts a conversation whose messages are already
  // on screen — reseeding that one from the server would undo the stream.
  const [seededId, setSeededId] = useState<string | null>(null);
  useEffect(() => {
    if (seededId === activeConversationId) return;
    if (activeConversationId === null) {
      setMessages([]);
      setSeededId(null);
      return;
    }
    if (conversation?._id !== activeConversationId) return;
    setMessages(conversation.messages as unknown as UIMessage[]);
    setSeededId(activeConversationId);
  }, [activeConversationId, conversation, seededId, setMessages]);

  const busy = status === "submitted" || status === "streaming";
  const loadingConversation =
    activeConversationId !== null && seededId !== activeConversationId;

  // The server's tools write straight to Mongo, so the rest of the app finds
  // out here: every finished mutating tool call invalidates the mindmap list,
  // and the refetched document's updatedAt tells an open editor to reseed. A
  // newly created mindmap is opened on the canvas right away.
  //
  // Only the newest message is looked at. Tool parts accumulate on the
  // assistant message that is streaming, and `output-available` is terminal, so
  // walking the whole transcript would re-scan every earlier turn on every
  // chunk that arrives — dozens of times a second — to find nothing.
  const handledToolCalls = useRef(new Set<string>());
  const latestMessage = messages.at(-1);
  useEffect(() => {
    if (latestMessage?.role !== "assistant") return;
    for (const part of latestMessage.parts) {
      if (!isToolUIPart(part) || part.state !== "output-available") continue;
      if (handledToolCalls.current.has(part.toolCallId)) continue;
      handledToolCalls.current.add(part.toolCallId);
      const toolName = getToolName(part);
      if (!MUTATING_TOOLS.has(toolName)) continue;
      void queryClient.invalidateQueries({ queryKey: mindmapKeys.all });
      const output = part.output as
        { mindmapId?: string; error?: string } | undefined;
      if (toolName === "create_mindmap" && output?.mindmapId && !output.error) {
        openMindmap(output.mindmapId);
      }
    }
  }, [latestMessage, queryClient]);

  /**
   * The text of a message whose conversation could not be created. The prompt
   * input clears itself on submit, so without holding on to it a failed start
   * would lose what the user typed; Retry re-runs the whole flow with it.
   */
  const [unsentText, setUnsentText] = useState<string | null>(null);

  async function startAndSend(text: string) {
    setUnsentText(null);
    let conversationId = activeConversationId;
    if (!conversationId) {
      try {
        const created = await createConversation.mutateAsync(
          conversationTitleFromMessage(text),
        );
        conversationId = created._id;
        // Adopted, not seeded: the message about to be sent is already the
        // truth for this conversation.
        setSeededId(conversationId);
        openConversation(conversationId);
      } catch {
        setUnsentText(text);
        return;
      }
    }
    conversationIdRef.current = conversationId;
    void sendMessage(
      { text },
      { body: { conversationId, mindmapId: activeMindmap?._id ?? null } },
    );
  }

  function handleSubmit(message: PromptInputMessage) {
    const text = message.text?.trim();
    if (!text || busy) return;
    void startAndSend(text);
  }

  // The three below are the history layer's props, and it is memoized: every
  // streamed chunk re-renders this panel, and rebuilding them inline would
  // re-render the whole conversation list along with it.
  const startNewChat = useCallback(() => {
    // Whatever has streamed so far is already persisted server-side, so
    // stopping mid-answer loses nothing but the rest of the reply.
    if (busy) void stop();
    setUnsentText(null);
    setSeededId(null);
    setMessages([]);
    openConversation(null);
  }, [busy, stop, setMessages]);

  const handleOpenConversation = useCallback(
    (id: string) => {
      if (id === activeConversationId) {
        setHistoryOpen(false);
        return;
      }
      if (busy) void stop();
      setUnsentText(null);
      openConversation(id);
    },
    [activeConversationId, busy, stop],
  );

  const handleConversationDeleted = useCallback(
    (id: string) => {
      if (id === activeConversationId) startNewChat();
    },
    [activeConversationId, startNewChat],
  );

  const isEmptyNewChat = activeConversationId === null && messages.length === 0;

  return (
    <aside
      aria-label="AI assistant"
      aria-hidden={!open}
      inert={!open}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.stopPropagation();
        if (historyOpen) setHistoryOpen(false);
        else setAssistantOpen(false);
      }}
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
      <header className="flex items-center justify-between gap-2 border-b border-hairline px-5 py-4">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-display-xs">
            <Sparkles className="size-4 text-primary" />
            Assistant
          </h2>
          <p className="mt-1 truncate text-caption-sm text-graphite">
            {historyOpen
              ? "Your chats"
              : conversationTitle(
                  activeConversationId ? conversation?.title : null,
                ) + (activeMindmap ? ` · ${activeMindmap.title}` : "")}
          </p>
        </div>
        <div className="flex shrink-0 items-center">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="New chat"
            disabled={isEmptyNewChat}
            onClick={startNewChat}
          >
            <SquarePen />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Chat history"
            aria-pressed={historyOpen}
            className={cn(historyOpen && "bg-fog")}
            onClick={() => setHistoryOpen(!historyOpen)}
          >
            <History />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Close assistant"
            onClick={() => setAssistantOpen(false)}
          >
            <X />
          </Button>
        </div>
      </header>

      {/* The chat and the history list are siblings in one stacking context so
          the chat is never unmounted: opening history must not cost the
          conversation its scroll position or a stream in flight. */}
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0 flex flex-col" inert={historyOpen}>
          <Conversation className="min-h-0 flex-1">
            <ConversationContent className="gap-6 px-5 py-4">
              {loadingConversation ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="size-5 animate-spin text-graphite" />
                </div>
              ) : messages.length === 0 ? (
                <ConversationEmptyState
                  className="text-graphite"
                  icon={<Sparkles className="size-5" />}
                  title="Manage your mindmaps by talking"
                  description="Try “create a mindmap about learning TypeScript”, “rename Roadmap to Launch plan”, or “add three subtopics under Testing”."
                />
              ) : (
                messages.map((message) => (
                  <Message from={message.role} key={message.id}>
                    <MessageContent className="text-body-md">
                      {message.parts.map((part, index) =>
                        part.type === "text" ? (
                          <MessageResponse key={index}>
                            {part.text}
                          </MessageResponse>
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
              {(unsentText !== null || error) && (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-bloom-rose/30 px-3 py-2 text-caption-md text-destructive">
                  <AlertCircle className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1">
                    {unsentText !== null
                      ? "Could not start a new chat."
                      : friendlyError(error!)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() =>
                      unsentText !== null
                        ? void startAndSend(unsentText)
                        : void regenerate()
                    }
                  >
                    <RotateCw /> Retry
                  </Button>
                </div>
              )}
            </ConversationContent>
            <ConversationScrollButton aria-label="Scroll to latest message" />
          </Conversation>

          <div className="shrink-0 border-t border-hairline p-3">
            <PromptInput onSubmit={handleSubmit}>
              <PromptInputBody>
                <PromptInputTextarea
                  placeholder={
                    activeMindmap
                      ? "Ask for topics, changes, cleanups…"
                      : "Ask for a mindmap, or about the ones you have…"
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
        </div>

        <AssistantHistory
          open={historyOpen}
          activeConversationId={activeConversationId}
          onSelect={handleOpenConversation}
          onNewChat={startNewChat}
          onDeleted={handleConversationDeleted}
        />
      </div>
    </aside>
  );
}

function conversationTitle(title: string | null | undefined): string {
  return title ?? DEFAULT_CONVERSATION_TITLE;
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

/** One line per tool call: what the assistant is doing to the user's maps. */
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
  read_topic_note: "Reading a note",
  set_topic_note: "Writing a note",
};
