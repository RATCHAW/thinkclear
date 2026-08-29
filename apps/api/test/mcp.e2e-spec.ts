import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AuthModule } from "@thallesp/nestjs-better-auth";
import { exportJWK, generateKeyPair, SignJWT, type JWK } from "jose";
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
import { MindmapToolsService } from "../src/ai/mindmap-tools.service";
import { APP_URL, auth, MCP_RESOURCE_URL } from "../src/auth";
import { McpController } from "../src/mcp/mcp.controller";
import { McpService } from "../src/mcp/mcp.service";
import { OAuthDiscoveryController } from "../src/mcp/oauth-discovery.controller";

/**
 * The MCP endpoint at the HTTP boundary, with real Better Auth token
 * verification in front of it.
 *
 * The interesting behaviour is all in the credential check, so this suite
 * plays the authorization server: it stands up a JWKS the API is pointed at,
 * then mints tokens against it. That makes "a token this server would accept"
 * and "a token it must not" both constructible, and the difference between
 * them is the actual security boundary — signature, issuer, audience, scope —
 * rather than a mock of it.
 *
 * `mcp.service.spec.ts` covers what the tools do once a token is verified.
 */
describe("MCP HTTP API", () => {
  const tools = { forOwner: vi.fn(() => ({})) };
  const issuer = `${APP_URL}/api/auth`;
  let app: INestApplication;
  let jwks: Server;
  let signingKey: CryptoKey;
  let impostorKey: CryptoKey;

  beforeAll(async () => {
    const trusted = await generateKeyPair("EdDSA", { extractable: true });
    const impostor = await generateKeyPair("EdDSA", { extractable: true });
    signingKey = trusted.privateKey;
    impostorKey = impostor.privateKey;

    jwks = await serveJwks([
      { ...(await exportJWK(trusted.publicKey)), kid: "test", alg: "EdDSA" },
    ]);
    process.env.MCP_JWKS_URL = `http://127.0.0.1:${(jwks.address() as AddressInfo).port}/jwks`;

    const moduleRef = await Test.createTestingModule({
      // The real auth module, so its global session guard is in place. Both
      // routes here have to be reachable *without* a session — the guard's
      // bare 401 would leave a client with nowhere to go — and that only
      // holds if the guard is actually running.
      imports: [AuthModule.forRoot({ auth })],
      controllers: [McpController, OAuthDiscoveryController],
      providers: [
        McpService,
        { provide: MindmapToolsService, useValue: tools },
      ],
    }).compile();

    // The default body parser is on, which is what production ends up with
    // too: `main.ts` turns the global one off for Better Auth's sake and the
    // auth module re-adds it for every other route, `/api/mcp` included.
    app = moduleRef.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
    await new Promise((resolve) => jwks.close(resolve));
    delete process.env.MCP_JWKS_URL;
  });

  const token = (claims: Record<string, unknown>, key = signingKey) =>
    new SignJWT({ scope: "mindmaps:read mindmaps:write", ...claims })
      .setProtectedHeader({ alg: "EdDSA", kid: "test" })
      .setIssuer(issuer)
      .setAudience(MCP_RESOURCE_URL)
      .setSubject("user-123")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(key);

  const rpc = (bearer?: string) => {
    const call = request(app.getHttpServer())
      .post("/api/mcp")
      .set("accept", "application/json, text/event-stream");
    if (bearer) call.set("authorization", `Bearer ${bearer}`);
    return call.send({ jsonrpc: "2.0", id: 1, method: "tools/list" });
  };

  it("answers an unauthenticated client with a challenge it can authorize from", async () => {
    const response = await rpc();

    expect(response.status).toBe(401);
    const challenge = response.headers["www-authenticate"];
    expect(challenge).toContain("Bearer");
    // RFC 9728: the pointer that turns `claude mcp add <url>` into a login
    // flow instead of a dead end.
    expect(challenge).toContain(
      `resource_metadata="${new URL(MCP_RESOURCE_URL).origin}/.well-known/oauth-protected-resource/api/mcp"`,
    );
    expect(tools.forOwner).not.toHaveBeenCalled();
  });

  it("serves the tools to a client holding a token it can verify", async () => {
    const response = await rpc(await token({}));

    expect(response.status).toBe(200);
    // The owner comes from the token's subject, never from the request body.
    expect(tools.forOwner).toHaveBeenCalledWith("user-123");
  });

  it("rejects a token signed by a key that is not the authorization server's", async () => {
    const response = await rpc(await token({}, impostorKey));

    expect(response.status).toBe(401);
    expect(tools.forOwner).not.toHaveBeenCalled();
  });

  it("rejects a token minted for a different resource", async () => {
    const elsewhere = await new SignJWT({ scope: "mindmaps:read" })
      .setProtectedHeader({ alg: "EdDSA", kid: "test" })
      .setIssuer(issuer)
      .setAudience("https://someone-elses-app.example/mcp")
      .setSubject("user-123")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(signingKey);

    // RFC 8707 audience binding: a token the user granted to another service
    // is not a token for this one, however valid its signature.
    const response = await rpc(elsewhere);

    expect(response.status).toBe(401);
    expect(tools.forOwner).not.toHaveBeenCalled();
  });

  it("rejects an expired token", async () => {
    const stale = await new SignJWT({ scope: "mindmaps:read" })
      .setProtectedHeader({ alg: "EdDSA", kid: "test" })
      .setIssuer(issuer)
      .setAudience(MCP_RESOURCE_URL)
      .setSubject("user-123")
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(signingKey);

    const response = await rpc(stale);

    expect(response.status).toBe(401);
    expect(tools.forOwner).not.toHaveBeenCalled();
  });

  it("tells a client short of a scope which one to come back with", async () => {
    const response = await rpc(await token({ scope: "openid profile" }));

    expect(response.status).toBe(403);
    const challenge = response.headers["www-authenticate"];
    // RFC 6750 §3.1 — enough for the client to step up in one round trip
    // rather than guess.
    expect(challenge).toContain("insufficient_scope");
    expect(challenge).toContain("mindmaps:read");
    expect(tools.forOwner).not.toHaveBeenCalled();
  });

  it("publishes protected resource metadata at the path the challenge points to", async () => {
    const response = await request(app.getHttpServer()).get(
      "/.well-known/oauth-protected-resource/api/mcp",
    );

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      resource: MCP_RESOURCE_URL,
      // The client reads this to find where to authorize.
      authorization_servers: [issuer],
    });
    // Identity scopes belong to the authorization server, not to this
    // resource; only the mindmap scopes are the resource's to advertise.
    expect(response.body.scopes_supported).toEqual([
      "mindmaps:read",
      "mindmaps:write",
    ]);
  });

  it("publishes authorization server metadata with the endpoints a client needs", async () => {
    const response = await request(app.getHttpServer()).get(
      "/.well-known/oauth-authorization-server/api/auth",
    );

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      authorization_endpoint: expect.stringContaining("/oauth2/authorize"),
      token_endpoint: expect.stringContaining("/oauth2/token"),
      // Dynamic registration is what lets an agent client connect with
      // nothing configured ahead of time.
      registration_endpoint: expect.stringContaining("/oauth2/register"),
    });
    expect(response.body.scopes_supported).toEqual(
      expect.arrayContaining(["mindmaps:read", "mindmaps:write"]),
    );
    expect(response.body.code_challenge_methods_supported).toContain("S256");
  });
});

/** Stands in for the authorization server's `/jwks`, on an ephemeral port. */
function serveJwks(keys: JWK[]): Promise<Server> {
  const server = createServer((_req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ keys }));
  });
  return new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve(server)),
  );
}
