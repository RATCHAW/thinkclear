import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { setupSwagger } from "../src/swagger";

// The docs enumerate every route on a public host, so "who can read them" is a
// security control and gets asserted like one.
const USER = "docs-user";
const PASSWORD = "docs:password-with-a-colon";

let app: INestApplication | undefined;

async function createApp(credentials?: {
  user: string;
  password: string;
}): Promise<INestApplication> {
  if (credentials) {
    process.env.DOCS_USER = credentials.user;
    process.env.DOCS_PASSWORD = credentials.password;
  } else {
    delete process.env.DOCS_USER;
    delete process.env.DOCS_PASSWORD;
  }

  const moduleRef = await Test.createTestingModule({}).compile();

  app = moduleRef.createNestApplication({ logger: false });
  setupSwagger(app);
  await app.init();

  return app;
}

afterEach(async () => {
  await app?.close();
  app = undefined;
  delete process.env.DOCS_USER;
  delete process.env.DOCS_PASSWORD;
});

describe("Swagger docs", () => {
  it("challenges an anonymous request so a browser can ask for credentials", async () => {
    const server = (
      await createApp({ user: USER, password: PASSWORD })
    ).getHttpServer() as Parameters<typeof request>[0];

    const response = await request(server).get("/docs");

    expect(response.status).toBe(401);
    expect(response.headers["www-authenticate"]).toContain("Basic");
  });

  it("serves the UI to a caller with the configured credentials", async () => {
    const server = (
      await createApp({ user: USER, password: PASSWORD })
    ).getHttpServer() as Parameters<typeof request>[0];

    const response = await request(server).get("/docs").auth(USER, PASSWORD);

    expect(response.status).toBe(200);
  });

  // The raw spec is a sibling of the UI path, not a child, so it needs guarding
  // in its own right — protecting /docs alone would leave the document open.
  it("guards the raw document beside the UI", async () => {
    const server = (
      await createApp({ user: USER, password: PASSWORD })
    ).getHttpServer() as Parameters<typeof request>[0];

    expect((await request(server).get("/docs-json")).status).toBe(401);
    expect((await request(server).get("/docs-yaml")).status).toBe(401);

    const authorized = await request(server)
      .get("/docs-json")
      .auth(USER, PASSWORD);

    expect(authorized.status).toBe(200);
    expect(authorized.body.openapi).toBeTypeOf("string");
  });

  it("rejects a wrong password and a wrong user alike", async () => {
    const server = (
      await createApp({ user: USER, password: PASSWORD })
    ).getHttpServer() as Parameters<typeof request>[0];

    expect((await request(server).get("/docs").auth(USER, "nope")).status).toBe(
      401,
    );
    expect(
      (await request(server).get("/docs").auth("nope", PASSWORD)).status,
    ).toBe(401);
  });

  // Failing closed: a deployment that forgets the variables loses its docs,
  // which gets noticed, rather than publishing them, which does not.
  it("does not mount the docs at all when the credentials are unset", async () => {
    const server = (await createApp()).getHttpServer() as Parameters<
      typeof request
    >[0];

    expect((await request(server).get("/docs")).status).toBe(404);
    expect((await request(server).get("/docs-json")).status).toBe(404);
  });
});
