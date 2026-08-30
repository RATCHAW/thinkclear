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
import { MeController } from "../src/me/me.controller";
import { MeService } from "../src/me/me.service";

const ownerId = "user-123";

describe("me HTTP API", () => {
  const service = {
    findPreferences: vi.fn(),
    updatePreferences: vi.fn(),
  };
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [MeController],
      providers: [{ provide: MeService, useValue: service }],
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

  it("answers with the profile, what this deployment offers, and the person's settings", async () => {
    service.findPreferences.mockResolvedValue({ layoutDirection: "right" });

    const response = await request(app.getHttpServer()).get("/api/me");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      user: { id: ownerId, email: "ada@example.com", name: "Ada" },
      // Empty because the test environment configures no provider
      // credentials — which is the same answer a self-hosted instance gives,
      // and what makes the account screen hide the button rather than offer
      // one that cannot work.
      socialProviders: [],
      preferences: { layoutDirection: "right" },
    });
    expect(service.findPreferences).toHaveBeenCalledWith(ownerId);
  });

  it("saves a preference against the session owner", async () => {
    service.updatePreferences.mockResolvedValue({ layoutDirection: "right" });

    const response = await request(app.getHttpServer())
      .patch("/api/me/preferences")
      .send({ layoutDirection: "right" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ layoutDirection: "right" });
    expect(service.updatePreferences).toHaveBeenCalledWith(ownerId, {
      layoutDirection: "right",
    });
  });

  // The stored value decides how every one of this person's maps is drawn, so
  // a direction the canvas has no layout for must not reach the database.
  it("rejects a direction it cannot lay out, and an empty patch", async () => {
    const unknown = await request(app.getHttpServer())
      .patch("/api/me/preferences")
      .send({ layoutDirection: "diagonal" });
    const empty = await request(app.getHttpServer())
      .patch("/api/me/preferences")
      .send({});

    expect(unknown.status).toBe(400);
    expect(empty.status).toBe(400);
    expect(service.updatePreferences).not.toHaveBeenCalled();
  });
});
