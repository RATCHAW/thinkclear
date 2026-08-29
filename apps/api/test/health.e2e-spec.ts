import type { INestApplication } from "@nestjs/common";
import { getConnectionToken } from "@nestjs/mongoose";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { HealthController } from "../src/health/health.controller";

// A container probe and Coolify both read this route, so what it is worth
// asserting is the status code — the thing that decides whether a rollout is
// reported as succeeded.
const connection = { readyState: 1 };

describe("health HTTP API", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: getConnectionToken(), useValue: connection }],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("answers 200 while Mongo is connected", async () => {
    connection.readyState = 1;

    const response = await request(app.getHttpServer()).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: "ok",
      database: "connected",
    });
    expect(response.body.uptime).toBeTypeOf("number");
  });

  it("answers 503 when Mongo is not connected, naming the state", async () => {
    connection.readyState = 0;

    const response = await request(app.getHttpServer()).get("/api/health");

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      status: "degraded",
      database: "disconnected",
    });
  });

  it("reports an unrecognised readyState rather than omitting it", async () => {
    connection.readyState = 42;

    const response = await request(app.getHttpServer()).get("/api/health");

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({ database: "unknown" });
  });
});
