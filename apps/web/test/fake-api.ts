import type { Preferences } from "@thinkclear/shared";
import type { Conversation } from "@/hooks/use-conversations";
import type { Mindmap } from "@/hooks/use-mindmaps";

type MindmapPatch = Partial<Pick<Mindmap, "title" | "nodes" | "edges">>;
type ChatBody = {
  conversationId: string;
  mindmapId: string | null;
  messages: { id: string; role: string; parts: { type: string }[] }[];
};

/**
 * An in-memory stand-in for the whole API: mindmaps, conversations, and the
 * chat stream. The chat route answers with a real AI SDK UI message stream so
 * the assistant panel is exercised through the transport it actually uses,
 * and it persists the turn the way the server does — the history a test reads
 * back is the history the app would have.
 */
export function createFakeApi({
  mindmaps: initialMindmaps = [],
  conversations: initialConversations = [],
  socialProviders = ["google"],
  preferences: initialPreferences = { layoutDirection: "down" },
  reply = "Done.",
  tool,
}: {
  mindmaps?: Mindmap[];
  conversations?: Conversation[];
  /** What `GET /api/me` says this deployment has credentials for. */
  socialProviders?: string[];
  /** The settings this account starts the test with. */
  preferences?: Preferences;
  reply?: string;
  /**
   * A server-side tool call to stream ahead of the reply, the way the real
   * chat route does. `create_mindmap` also writes the mindmap into this store,
   * since the panel invalidates the list on the strength of the call.
   */
  tool?: { name: string; title?: string };
} = {}) {
  let mindmaps = structuredClone(initialMindmaps);
  let conversations = structuredClone(initialConversations);
  let preferences = structuredClone(initialPreferences);
  let sequence = mindmaps.length + conversations.length;
  const graphPatches: MindmapPatch[] = [];
  const chatRequests: ChatBody[] = [];

  const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const { pathname } = new URL(request.url);
    const idIn = (prefix: string) =>
      pathname.startsWith(prefix)
        ? decodeURIComponent(pathname.slice(prefix.length))
        : null;
    const mindmapId = idIn("/api/mindmaps/");
    const conversationId = idIn("/api/conversations/");

    if (pathname === "/api/me" && request.method === "GET") {
      return json({
        user: { id: "user-1", email: "ada@example.com", name: "Ada" },
        socialProviders,
        preferences,
      });
    }

    // The real route answers with the whole settled object, not the patch, so
    // a client that sent one field still learns the rest.
    if (pathname === "/api/me/preferences" && request.method === "PATCH") {
      const body = (await request.json()) as Partial<Preferences>;
      preferences = { ...preferences, ...body };
      return json(preferences);
    }

    if (pathname === "/api/mindmaps" && request.method === "GET") {
      return json(mindmaps);
    }

    if (pathname === "/api/mindmaps" && request.method === "POST") {
      const body = (await request.json()) as { title: string };
      sequence += 1;
      const now = new Date().toISOString();
      const created: Mindmap = {
        _id: `mindmap-${sequence}`,
        ownerId: "user-1",
        title: body.title,
        nodes: [{ id: "root", title: body.title, x: 0, y: 0 }],
        edges: [],
        createdAt: now,
        updatedAt: now,
      };
      mindmaps = [created, ...mindmaps];
      return json(created, 201);
    }

    if (mindmapId && request.method === "PATCH") {
      const body = (await request.json()) as MindmapPatch;
      if (body.nodes || body.edges) graphPatches.push(structuredClone(body));
      const index = mindmaps.findIndex((mindmap) => mindmap._id === mindmapId);
      if (index === -1) return json({ message: "Mindmap not found" }, 404);
      const updated = {
        ...mindmaps[index],
        ...body,
        updatedAt: new Date().toISOString(),
      };
      mindmaps = mindmaps.map((mindmap, current) =>
        current === index ? updated : mindmap,
      );
      return json(updated);
    }

    if (mindmapId && request.method === "DELETE") {
      const exists = mindmaps.some((mindmap) => mindmap._id === mindmapId);
      if (!exists) return json({ message: "Mindmap not found" }, 404);
      mindmaps = mindmaps.filter((mindmap) => mindmap._id !== mindmapId);
      return new Response(null, { status: 204 });
    }

    if (pathname === "/api/conversations" && request.method === "GET") {
      // The real route projects the messages away, and the web types say so.
      return json(
        conversations.map(({ messages: _messages, ...summary }) => summary),
      );
    }

    if (pathname === "/api/conversations" && request.method === "POST") {
      const body = (await request.json()) as { title?: string };
      sequence += 1;
      const now = new Date().toISOString();
      const created: Conversation = {
        _id: `conversation-${sequence}`,
        ownerId: "user-1",
        title: body.title ?? "New chat",
        messages: [],
        createdAt: now,
        updatedAt: now,
      };
      conversations = [created, ...conversations];
      return json(created, 201);
    }

    if (conversationId && request.method === "GET") {
      const found = conversations.find(
        (conversation) => conversation._id === conversationId,
      );
      return found
        ? json(found)
        : json({ message: "Conversation not found" }, 404);
    }

    if (conversationId && request.method === "PATCH") {
      const body = (await request.json()) as { title: string };
      const index = conversations.findIndex(
        (conversation) => conversation._id === conversationId,
      );
      if (index === -1) return json({ message: "Conversation not found" }, 404);
      const updated = { ...conversations[index], title: body.title };
      conversations = conversations.map((conversation, current) =>
        current === index ? updated : conversation,
      );
      return json(updated);
    }

    if (conversationId && request.method === "DELETE") {
      const exists = conversations.some(
        (conversation) => conversation._id === conversationId,
      );
      if (!exists) return json({ message: "Conversation not found" }, 404);
      conversations = conversations.filter(
        (conversation) => conversation._id !== conversationId,
      );
      return new Response(null, { status: 204 });
    }

    if (pathname === "/api/chat" && request.method === "POST") {
      const body = (await request.json()) as ChatBody;
      chatRequests.push(structuredClone(body));
      const index = conversations.findIndex(
        (conversation) => conversation._id === body.conversationId,
      );
      if (index === -1) return json({ message: "Conversation not found" }, 404);

      // The real tools write to Mongo before the turn finishes streaming, so
      // the mindmap is here by the time the panel refetches the list.
      let toolCall;
      if (tool) {
        const title = tool.title ?? "Untitled";
        sequence += 1;
        const now = new Date().toISOString();
        const created: Mindmap = {
          _id: `mindmap-${sequence}`,
          ownerId: "user-1",
          title,
          nodes: [{ id: "root", title, x: 0, y: 0 }],
          edges: [],
          createdAt: now,
          updatedAt: now,
        };
        mindmaps = [created, ...mindmaps];
        toolCall = {
          name: tool.name,
          output: { mindmapId: created._id, summary: `Created “${title}”` },
        };
      }

      conversations[index] = {
        ...conversations[index],
        messages: [
          ...body.messages,
          { id: "assistant-1", role: "assistant", parts: [textPart(reply)] },
        ] as Conversation["messages"],
        updatedAt: new Date().toISOString(),
      };
      return uiMessageStream(reply, toolCall);
    }

    return json({ message: `Unhandled ${request.method} ${pathname}` }, 500);
  };

  return {
    fetch,
    graphPatches,
    chatRequests,
    mindmaps: () => structuredClone(mindmaps),
    conversations: () => structuredClone(conversations),
    preferences: () => structuredClone(preferences),
  };
}

export function mindmapFixture(overrides: Partial<Mindmap> = {}): Mindmap {
  return {
    _id: "mindmap-1",
    ownerId: "user-1",
    title: "Roadmap",
    nodes: [{ id: "root", title: "Roadmap", x: 0, y: 0 }],
    edges: [],
    createdAt: "2026-08-28T10:00:00.000Z",
    updatedAt: "2026-08-28T10:00:00.000Z",
    ...overrides,
  };
}

export function conversationFixture(
  overrides: Partial<Conversation> = {},
): Conversation {
  return {
    _id: "conversation-1",
    ownerId: "user-1",
    title: "Earlier chat",
    messages: [
      { id: "m1", role: "user", parts: [textPart("what do I have?")] },
      { id: "m2", role: "assistant", parts: [textPart("One mindmap.")] },
    ] as Conversation["messages"],
    createdAt: "2026-08-28T10:00:00.000Z",
    updatedAt: "2026-08-28T10:00:00.000Z",
    ...overrides,
  };
}

function textPart(text: string) {
  return { type: "text", text, state: "done" };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** The AI SDK's UI message stream: SSE-framed chunks, `[DONE]` to close. */
function uiMessageStream(
  text: string,
  tool?: { name: string; output: unknown },
) {
  const chunks = [
    { type: "start", messageId: "assistant-1" },
    { type: "start-step" },
    ...(tool
      ? [
          {
            type: "tool-input-start",
            toolCallId: "call-1",
            toolName: tool.name,
          },
          {
            type: "tool-input-available",
            toolCallId: "call-1",
            toolName: tool.name,
            input: {},
          },
          {
            type: "tool-output-available",
            toolCallId: "call-1",
            output: tool.output,
          },
        ]
      : []),
    { type: "text-start", id: "0" },
    { type: "text-delta", id: "0", delta: text },
    { type: "text-end", id: "0" },
    { type: "finish-step" },
    { type: "finish" },
  ];
  const body = `${chunks
    .map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`)
    .join("")}data: [DONE]\n\n`;

  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}
