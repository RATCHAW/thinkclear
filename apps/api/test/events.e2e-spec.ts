import http from "node:http";
import type { AddressInfo } from "node:net";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { NextFunction, Request, Response } from "express";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { EventsController } from "../src/events/events.controller";
import { EventsService } from "../src/events/events.service";

const ownerId = "user-123";

/**
 * Exercised over a real listening socket rather than supertest: an SSE
 * response never ends, and what is under test is exactly the part supertest
 * abstracts away — that frames arrive while the connection stays open.
 */
describe("events SSE stream", () => {
  let app: INestApplication;
  let events: EventsService;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [EventsController],
      providers: [EventsService],
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
    await app.listen(0);
    const { port } = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
    events = app.get(EventsService);
  });

  afterAll(async () => {
    await app.close();
  });

  it("streams the owner's changes and withholds everyone else's", async () => {
    const chunks: string[] = [];
    let response: http.IncomingMessage | undefined;
    const request = http.get(`${baseUrl}/api/events`, (res) => {
      response = res;
      res.setEncoding("utf8");
      res.on("data", (chunk: string) => chunks.push(chunk));
    });

    try {
      // The subscription is only live once the response headers are out, and
      // there is no signal for that moment — so emit until a frame lands.
      // Repeats are harmless: the assertions are about content, not count.
      await vi.waitFor(
        () => {
          events.emitMindmapChanged("someone-else", {
            mindmapId: "map-theirs",
            updatedAt: "2026-08-28T10:00:00.000Z",
          });
          events.emitMindmapChanged(ownerId, {
            mindmapId: "map-mine",
            updatedAt: "2026-08-28T10:00:00.000Z",
          });
          events.emitMindmapChanged(ownerId, {
            mindmapId: "map-deleted",
            updatedAt: null,
          });
          expect(chunks.join("")).toContain("map-deleted");
        },
        { timeout: 5000 },
      );

      expect(response?.statusCode).toBe(200);
      expect(response?.headers["content-type"]).toContain("text/event-stream");
      const stream = chunks.join("");
      expect(stream).toContain("event: mindmap");
      expect(stream).toContain(
        '"mindmapId":"map-mine","updatedAt":"2026-08-28T10:00:00.000Z"',
      );
      expect(stream).toContain('"mindmapId":"map-deleted","updatedAt":null');
      // The other owner's write was emitted on every retry above; the filter
      // is server-side, so it must never have reached this stream.
      expect(stream).not.toContain("map-theirs");
    } finally {
      request.destroy();
    }
  });
});
