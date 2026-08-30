import type { INestApplication } from "@nestjs/common";
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
import { MindmapsController } from "../src/mindmaps/mindmaps.controller";
import { MindmapsService } from "../src/mindmaps/mindmaps.service";

const ownerId = "user-123";
const mindmapId = "507f1f77bcf86cd799439011";
const mindmap = {
  _id: mindmapId,
  ownerId,
  title: "Roadmap",
  nodes: [{ id: "root", title: "Roadmap", x: 0, y: 0 }],
  edges: [],
  createdAt: "2026-08-28T10:00:00.000Z",
  updatedAt: "2026-08-28T10:00:00.000Z",
};

describe("mindmap HTTP API", () => {
  const service = {
    findAllByOwner: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [MindmapsController],
      providers: [{ provide: MindmapsService, useValue: service }],
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

  it("lists and reads maps using the session owner", async () => {
    service.findAllByOwner.mockResolvedValue([mindmap]);
    service.findOne.mockResolvedValue(mindmap);

    const listResponse = await request(app.getHttpServer()).get(
      "/api/mindmaps",
    );
    const detailResponse = await request(app.getHttpServer()).get(
      `/api/mindmaps/${mindmapId}`,
    );

    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toEqual([mindmap]);
    expect(detailResponse.status).toBe(200);
    expect(service.findAllByOwner).toHaveBeenCalledWith(ownerId);
    expect(service.findOne).toHaveBeenCalledWith(ownerId, mindmapId);
  });

  it("validates, normalizes, and creates a map", async () => {
    service.create.mockResolvedValue(mindmap);

    const response = await request(app.getHttpServer())
      .post("/api/mindmaps")
      .send({ title: "  Roadmap  " });

    expect(response.status).toBe(201);
    expect(response.body).toEqual(mindmap);
    expect(service.create).toHaveBeenCalledWith(ownerId, "Roadmap");
  });

  it("rejects invalid create and empty update bodies before the service", async () => {
    const createResponse = await request(app.getHttpServer())
      .post("/api/mindmaps")
      .send({ title: "   " });
    const updateResponse = await request(app.getHttpServer())
      .patch(`/api/mindmaps/${mindmapId}`)
      .send({});

    expect(createResponse.status).toBe(400);
    expect(createResponse.body).toMatchObject({ message: "Validation failed" });
    expect(updateResponse.status).toBe(400);
    expect(service.create).not.toHaveBeenCalled();
    expect(service.update).not.toHaveBeenCalled();
  });

  it("updates and deletes a map through the HTTP contract", async () => {
    service.update.mockResolvedValue({ ...mindmap, title: "Launch plan" });
    service.remove.mockResolvedValue(undefined);

    const updateResponse = await request(app.getHttpServer())
      .patch(`/api/mindmaps/${mindmapId}`)
      .send({ title: "Launch plan" });
    const deleteResponse = await request(app.getHttpServer()).delete(
      `/api/mindmaps/${mindmapId}`,
    );

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.title).toBe("Launch plan");
    expect(service.update).toHaveBeenCalledWith(ownerId, mindmapId, {
      title: "Launch plan",
    });
    expect(deleteResponse.status).toBe(204);
    expect(deleteResponse.text).toBe("");
    expect(service.remove).toHaveBeenCalledWith(ownerId, mindmapId);
  });
});
