import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_CONVERSATION_MESSAGES } from "@mindmap/shared";
import { ConversationsService } from "../src/conversations/conversations.service";

const conversationId = "507f1f77bcf86cd799439011";
const ownerId = "owner-1";

const stored = {
  _id: conversationId,
  ownerId,
  title: "Plan a launch mindmap",
  messages: [],
};

function query<T>(value: T) {
  return { exec: vi.fn().mockResolvedValue(value) };
}

const message = (id: number) => ({
  id: `m${id}`,
  role: "user",
  parts: [{ type: "text", text: "hi" }],
});

describe("ConversationsService", () => {
  const model = {
    create: vi.fn(),
    find: vi.fn(),
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    findOneAndDelete: vi.fn(),
  };
  let service: ConversationsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ConversationsService(model as never);
  });

  it("creates an empty conversation owned by the session user", async () => {
    model.create.mockResolvedValue(stored);

    await expect(
      service.create(ownerId, "  Plan a launch mindmap  "),
    ).resolves.toBe(stored);
    expect(model.create).toHaveBeenCalledWith({
      ownerId,
      title: "Plan a launch mindmap",
      messages: [],
    });
  });

  it("names an untitled conversation rather than storing a blank one", async () => {
    model.create.mockResolvedValue(stored);

    await service.create(ownerId, "   ");
    await service.create(ownerId);

    for (const call of model.create.mock.calls) {
      expect(call[0]).toMatchObject({ title: "New chat" });
    }
  });

  it("lists the owner's history most recently used first, without messages", async () => {
    const exec = vi.fn().mockResolvedValue([stored]);
    const sort = vi.fn().mockReturnValue({ exec });
    const select = vi.fn().mockReturnValue({ sort });
    model.find.mockReturnValue({ select });

    await expect(service.findAllByOwner(ownerId)).resolves.toEqual([stored]);
    expect(model.find).toHaveBeenCalledWith({ ownerId });
    expect(select).toHaveBeenCalledWith("-messages");
    expect(sort).toHaveBeenCalledWith({ updatedAt: -1 });
  });

  it("scopes every read, rename, and delete by owner", async () => {
    model.findOne.mockReturnValue(query(stored));
    model.findOneAndUpdate.mockReturnValue(query(stored));
    model.findOneAndDelete.mockReturnValue(query(stored));

    await service.findOne(ownerId, conversationId);
    await service.rename(ownerId, conversationId, "Ideas");
    await service.remove(ownerId, conversationId);

    const scope = { _id: conversationId, ownerId };
    expect(model.findOne).toHaveBeenCalledWith(scope);
    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      scope,
      { title: "Ideas" },
      { new: true },
    );
    expect(model.findOneAndDelete).toHaveBeenCalledWith(scope);
  });

  it("returns the same 404 for malformed, missing, and other users' ids", async () => {
    await expect(
      service.findOne(ownerId, "not-an-object-id"),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(model.findOne).not.toHaveBeenCalled();

    // Someone else's conversation misses the owner-scoped filter and is
    // indistinguishable from one that never existed.
    model.findOne.mockReturnValue(query(null));
    await expect(
      service.findOne(ownerId, conversationId),
    ).rejects.toBeInstanceOf(NotFoundException);

    model.findOneAndUpdate.mockReturnValue(query(null));
    await expect(
      service.rename(ownerId, conversationId, "Ideas"),
    ).rejects.toBeInstanceOf(NotFoundException);

    model.findOneAndDelete.mockReturnValue(query(null));
    await expect(
      service.remove(ownerId, conversationId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("keeps only the newest messages a turn could replay", async () => {
    model.findOneAndUpdate.mockReturnValue(query(stored));
    const messages = Array.from(
      { length: MAX_CONVERSATION_MESSAGES + 3 },
      (_, index) => message(index),
    );

    await service.replaceMessages(ownerId, conversationId, messages);

    const written = model.findOneAndUpdate.mock.calls[0][1] as {
      messages: { id: string }[];
    };
    expect(written.messages).toHaveLength(MAX_CONVERSATION_MESSAGES);
    expect(written.messages[0].id).toBe("m3");
    expect(written.messages.at(-1)?.id).toBe(
      `m${MAX_CONVERSATION_MESSAGES + 2}`,
    );
  });
});
