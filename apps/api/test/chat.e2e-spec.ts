import type { INestApplication } from "@nestjs/common";
import { NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { NextFunction, Request, Response } from "express";
import request from "supertest";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { AiService } from "../src/ai/ai.service";
import { ChatController } from "../src/ai/chat.controller";
import { MindmapToolsService } from "../src/ai/mindmap-tools.service";
import { ConversationsService } from "../src/conversations/conversations.service";

// The route is exercised down to (but not through) the model: `streamText` is
// replaced with an empty stream, which is enough to prove what the controller
// owns — ownership, validation, and when the turn is written.
const streamText = vi.hoisted(() => vi.fn());
vi.mock("ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("ai")>()),
  streamText,
}));

const ownerId = "user-123";
const conversationId = "507f1f77bcf86cd799439011";
const userMessage = {
  id: "m1",
  role: "user",
  parts: [{ type: "text", text: "create a mindmap about testing" }],
};

describe("chat HTTP API", () => {
  const ai = { isReady: vi.fn(), chatModel: vi.fn() };
  const tools = { forOwner: vi.fn() };
  const conversations = { findOne: vi.fn(), replaceMessages: vi.fn() };
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [
        { provide: AiService, useValue: ai },
        { provide: MindmapToolsService, useValue: tools },
        { provide: ConversationsService, useValue: conversations },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use((req: Request, _res: Response, next: NextFunction) => {
      Object.assign(req, {
        session: {
          user: { id: ownerId, email: "ada@example.com", name: "Ada" },
          session: { id: "session-1" },
        },
      });
      next();
    });
    await app.init();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    ai.isReady.mockReturnValue(true);
    ai.chatModel.mockReturnValue({});
    tools.forOwner.mockReturnValue({});
    conversations.findOne.mockResolvedValue({ _id: conversationId });
    conversations.replaceMessages.mockResolvedValue({ _id: conversationId });
    streamText.mockReturnValue({
      stream: new ReadableStream({
        start: (controller) => controller.close(),
      }),
    });
  });

  afterAll(async () => {
    await app.close();
  });

  const post = (body: object) =>
    request(app.getHttpServer()).post("/api/chat").send(body);

  it("answers 503 before touching the conversation when no gateway key is set", async () => {
    ai.isReady.mockReturnValue(false);

    const response = await post({ conversationId, messages: [userMessage] });

    expect(response.status).toBe(503);
    expect(conversations.findOne).not.toHaveBeenCalled();
  });

  it("requires a conversation to append the turn to", async () => {
    const response = await post({ messages: [userMessage] });

    expect(response.status).toBe(400);
    expect(streamText).not.toHaveBeenCalled();
  });

  it("rejects a body the AI SDK cannot read as messages", async () => {
    const response = await post({
      conversationId,
      messages: [{ id: "m1", role: "user", parts: [{ type: "nonsense" }] }],
    });

    expect(response.status).toBe(400);
    expect(streamText).not.toHaveBeenCalled();
  });

  it("spends nothing on a conversation the caller does not own", async () => {
    conversations.findOne.mockRejectedValue(
      new NotFoundException("Conversation not found"),
    );

    const response = await post({ conversationId, messages: [userMessage] });

    expect(response.status).toBe(404);
    expect(conversations.replaceMessages).not.toHaveBeenCalled();
    expect(streamText).not.toHaveBeenCalled();
  });

  it("banks the user's message before the model runs, then writes the turn", async () => {
    const response = await post({
      conversationId,
      mindmapId: "507f1f77bcf86cd799439022",
      messages: [userMessage],
    });

    expect(response.status).toBe(200);
    // Twice: once up front so an abandoned or failed generation still leaves
    // the question in the history, once when the stream ends.
    expect(conversations.replaceMessages).toHaveBeenCalledTimes(2);
    expect(conversations.replaceMessages.mock.calls[0]).toEqual([
      ownerId,
      conversationId,
      [userMessage],
    ]);
    expect(streamText).toHaveBeenCalledTimes(1);
    expect(tools.forOwner).toHaveBeenCalledWith(ownerId);
  });

  it("tells the model which mindmap is open, and when none is", async () => {
    await post({
      conversationId,
      mindmapId: "507f1f77bcf86cd799439022",
      messages: [userMessage],
    });
    await post({ conversationId, messages: [userMessage] });

    const [withMap, withoutMap] = streamText.mock.calls.map(
      (call) => (call[0] as { system: string }).system,
    );
    expect(withMap).toContain('mindmap with id "507f1f77bcf86cd799439022"');
    expect(withoutMap).toContain("no mindmap open");
    // The assistant is scoped to the library, not to whatever is on the canvas.
    expect(withoutMap).toContain("whole library");
  });
});
