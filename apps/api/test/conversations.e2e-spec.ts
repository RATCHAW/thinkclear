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
import { ConversationsController } from "../src/conversations/conversations.controller";
import { ConversationsService } from "../src/conversations/conversations.service";

const ownerId = "user-123";
const conversationId = "507f1f77bcf86cd799439011";
const conversation = {
  _id: conversationId,
  ownerId,
  title: "Plan a launch mindmap",
  messages: [{ id: "m1", role: "user", parts: [{ type: "text", text: "hi" }] }],
  createdAt: "2026-08-28T10:00:00.000Z",
  updatedAt: "2026-08-28T10:05:00.000Z",
};

describe("conversation HTTP API", () => {
  const service = {
    findAllByOwner: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    rename: vi.fn(),
    remove: vi.fn(),
  };
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ConversationsController],
      providers: [{ provide: ConversationsService, useValue: service }],
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
  });

  afterAll(async () => {
    await app.close();
  });

  it("lists and reads history using the session owner", async () => {
    const { messages: _messages, ...summary } = conversation;
    service.findAllByOwner.mockResolvedValue([summary]);
    service.findOne.mockResolvedValue(conversation);

    const listResponse = await request(app.getHttpServer()).get(
      "/api/conversations",
    );
    const detailResponse = await request(app.getHttpServer()).get(
      `/api/conversations/${conversationId}`,
    );

    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toEqual([summary]);
    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.messages).toHaveLength(1);
    expect(service.findAllByOwner).toHaveBeenCalledWith(ownerId);
    expect(service.findOne).toHaveBeenCalledWith(ownerId, conversationId);
  });

  it("creates a conversation with an optional, trimmed title", async () => {
    service.create.mockResolvedValue(conversation);

    const titled = await request(app.getHttpServer())
      .post("/api/conversations")
      .send({ title: "  Plan a launch mindmap  " });
    const untitled = await request(app.getHttpServer())
      .post("/api/conversations")
      .send({});

    expect(titled.status).toBe(201);
    expect(titled.body).toEqual(conversation);
    expect(service.create).toHaveBeenNthCalledWith(
      1,
      ownerId,
      "Plan a launch mindmap",
    );
    expect(untitled.status).toBe(201);
    expect(service.create).toHaveBeenNthCalledWith(2, ownerId, undefined);
  });

  it("rejects a blank rename before the service", async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/conversations/${conversationId}`)
      .send({ title: "   " });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ message: "Validation failed" });
    expect(service.rename).not.toHaveBeenCalled();
  });

  it("renames and deletes through the HTTP contract", async () => {
    service.rename.mockResolvedValue({ ...conversation, title: "Ideas" });
    service.remove.mockResolvedValue(undefined);

    const renameResponse = await request(app.getHttpServer())
      .patch(`/api/conversations/${conversationId}`)
      .send({ title: "Ideas" });
    const deleteResponse = await request(app.getHttpServer()).delete(
      `/api/conversations/${conversationId}`,
    );

    expect(renameResponse.status).toBe(200);
    expect(renameResponse.body.title).toBe("Ideas");
    expect(service.rename).toHaveBeenCalledWith(
      ownerId,
      conversationId,
      "Ideas",
    );
    expect(deleteResponse.status).toBe(204);
    expect(service.remove).toHaveBeenCalledWith(ownerId, conversationId);
  });

  it("answers 404 for a conversation the caller does not own", async () => {
    service.findOne.mockRejectedValue(
      new NotFoundException("Conversation not found"),
    );

    const response = await request(app.getHttpServer()).get(
      `/api/conversations/${conversationId}`,
    );

    expect(response.status).toBe(404);
  });
});
