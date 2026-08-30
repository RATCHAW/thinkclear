import { BadRequestException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { MindmapsService } from "../src/mindmaps/mindmaps.service";

const mindmapId = "507f1f77bcf86cd799439011";
const ownerId = "owner-1";

const updatedAt = new Date("2026-08-28T10:00:00.000Z");

const storedMindmap = {
  _id: mindmapId,
  ownerId,
  title: "Roadmap",
  nodes: [{ id: "root", title: "Roadmap", x: 0, y: 0 }],
  edges: [],
  updatedAt,
};

function query<T>(value: T) {
  return { exec: vi.fn().mockResolvedValue(value) };
}

describe("MindmapsService", () => {
  const model = {
    create: vi.fn(),
    find: vi.fn(),
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    findOneAndDelete: vi.fn(),
  };
  const events = { emitMindmapChanged: vi.fn() };
  let service: MindmapsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new MindmapsService(model as never, events as never);
  });

  it("creates every map with a root node owned by the session user", async () => {
    model.create.mockResolvedValue(storedMindmap);

    await expect(service.create(ownerId, "Roadmap")).resolves.toBe(
      storedMindmap,
    );
    expect(model.create).toHaveBeenCalledWith({
      ownerId,
      title: "Roadmap",
      nodes: [{ id: "root", title: "Roadmap", x: 0, y: 0 }],
      edges: [],
    });
    expect(events.emitMindmapChanged).toHaveBeenCalledWith(ownerId, {
      mindmapId,
      updatedAt: updatedAt.toISOString(),
    });
  });

  it("lists only the owner's maps newest first", async () => {
    const exec = vi.fn().mockResolvedValue([storedMindmap]);
    const sort = vi.fn().mockReturnValue({ exec });
    model.find.mockReturnValue({ sort });

    await expect(service.findAllByOwner(ownerId)).resolves.toEqual([
      storedMindmap,
    ]);
    expect(model.find).toHaveBeenCalledWith({ ownerId });
    expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
  });

  it("scopes individual reads by owner", async () => {
    model.findOne.mockReturnValue(query(storedMindmap));

    await expect(service.findOne(ownerId, mindmapId)).resolves.toBe(
      storedMindmap,
    );
    expect(model.findOne).toHaveBeenCalledWith({ _id: mindmapId, ownerId });
  });

  it("returns the same 404 for malformed and missing ids", async () => {
    await expect(
      service.findOne(ownerId, "not-an-object-id"),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(model.findOne).not.toHaveBeenCalled();

    model.findOne.mockReturnValue(query(null));
    await expect(service.findOne(ownerId, mindmapId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("updates a complete valid graph without an extra read", async () => {
    const input = {
      nodes: [
        { id: "root", title: "Roadmap", x: 0, y: 0 },
        { id: "topic", title: "Ship", x: 0, y: 100 },
      ],
      edges: [{ id: "root-topic", source: "root", target: "topic" }],
    };
    const updated = { ...storedMindmap, ...input };
    model.findOneAndUpdate.mockReturnValue(query(updated));

    await expect(service.update(ownerId, mindmapId, input)).resolves.toBe(
      updated,
    );
    expect(model.findOne).not.toHaveBeenCalled();
    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: mindmapId, ownerId },
      input,
      { new: true },
    );
    expect(events.emitMindmapChanged).toHaveBeenCalledWith(ownerId, {
      mindmapId,
      updatedAt: updatedAt.toISOString(),
    });
  });

  it("validates a one-sided graph patch against the stored half", async () => {
    const nodes = [
      ...storedMindmap.nodes,
      { id: "topic", title: "Ship", x: 0, y: 100 },
    ];
    model.findOne.mockReturnValue(query(storedMindmap));
    model.findOneAndUpdate.mockReturnValue(query({ ...storedMindmap, nodes }));

    await expect(
      service.update(ownerId, mindmapId, { nodes }),
    ).resolves.toMatchObject({
      nodes,
    });
    expect(model.findOne).toHaveBeenCalledWith({ _id: mindmapId, ownerId });
  });

  it("rejects an invalid graph before writing it", async () => {
    const input = {
      nodes: [{ id: "topic", title: "No root", x: 0, y: 0 }],
      edges: [{ id: "loop", source: "topic", target: "topic" }],
    };

    await expect(
      service.update(ownerId, mindmapId, input),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
    expect(events.emitMindmapChanged).not.toHaveBeenCalled();
  });

  it("scopes deletion by owner and rejects malformed ids without a query", async () => {
    model.findOneAndDelete.mockReturnValue(query(storedMindmap));

    await expect(service.remove(ownerId, mindmapId)).resolves.toBeUndefined();
    expect(model.findOneAndDelete).toHaveBeenCalledWith({
      _id: mindmapId,
      ownerId,
    });
    // A deletion is announced with a null updatedAt — there is no post-write
    // document to stamp it from, and null is what tells the client the map is
    // gone rather than changed.
    expect(events.emitMindmapChanged).toHaveBeenCalledWith(ownerId, {
      mindmapId,
      updatedAt: null,
    });

    vi.clearAllMocks();
    await expect(service.remove(ownerId, "bad-id")).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(model.findOneAndDelete).not.toHaveBeenCalled();
    expect(events.emitMindmapChanged).not.toHaveBeenCalled();
  });
});
