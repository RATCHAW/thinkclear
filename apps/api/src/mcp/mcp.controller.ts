import { requireMcpAuth } from "@better-auth/mcp";
import { All, Controller, Inject, Post, Req, Res } from "@nestjs/common";
import {
  ApiExcludeEndpoint,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { Public } from "@thallesp/nestjs-better-auth";
import {
  toNodeHandler,
  type NodeMcpRequestHandler,
} from "@modelcontextprotocol/node";
import type { Request, Response } from "express";
import type { AuthInfo } from "@modelcontextprotocol/server";
import { MCP_SCOPES, parseScopeClaim } from "@thinkclear/shared";
import { APP_URL, auth, MCP_RESOURCE_URL } from "../auth";
import { McpService } from "./mcp.service";

/**
 * The MCP endpoint: `POST /api/mcp`, spoken by any agent client the user
 * points at it.
 *
 * Unlike every other route in this app, the caller here is not a browser
 * carrying a session cookie — it is a program holding an OAuth access token
 * the user granted it. `requireMcpAuth` is the whole of that check: it
 * verifies the bearer token against the authorization server's JWKS
 * (signature, issuer, audience, expiry), and answers an unauthenticated
 * request with the RFC 9728 `WWW-Authenticate` challenge that tells the client
 * where to go and authorize. That challenge is what makes `claude mcp add`
 * work with nothing but a URL: the 401 is the start of the flow, not a dead
 * end.
 *
 * Ownership never comes from the request body. It is read off the verified
 * token's `sub` and handed to the tool set, so a client cannot ask for someone
 * else's mindmap any more than a browser can.
 */
/**
 * `@Public()` exempts this route from the session guard every other route
 * runs under — it is not unprotected. An MCP client has no session cookie by
 * construction, so the guard would answer a bare 401 with nothing in it, and
 * the client would have no way to learn where to authorize. `requireMcpAuth`
 * below is the check that replaces it, and its 401 is the one that carries the
 * challenge.
 */
@Public()
@ApiTags("mcp")
@Controller("api/mcp")
export class McpController {
  private serve?: NodeMcpRequestHandler;

  constructor(@Inject(McpService) private readonly mcp: McpService) {}

  /**
   * Built on first use rather than at construction, so the JWKS address is
   * read when it is needed rather than when the module graph loads. Nest
   * instantiates controllers long before any request, and a deployment sets
   * that address in its environment.
   */
  private guarded(): NodeMcpRequestHandler {
    return (this.serve ??= toNodeHandler({
      fetch: requireMcpAuth(
        auth,
        (request, claims) => this.mcp.fetch(request, authInfoFrom(claims)),
        {
          // Must match `mcp({ resource })`: tokens are audience-bound to it,
          // and a token minted for a different resource is rejected here
          // rather than being allowed to act on this one.
          resource: MCP_RESOURCE_URL,
          // Read is the baseline every client is registered with. Requiring
          // it turns "connected with no useful grant" into a 403 naming the
          // scope to ask for, which a client can act on, instead of a
          // successful connection to an empty tool list, which it cannot.
          requiredScopes: ["mindmaps:read"],
          challengeScopes: MCP_SCOPES,
          jwksUrl: mcpJwksUrl(),
        },
      ),
    }));
  }

  /**
   * Streamable HTTP transport. Documented for completeness only — the payload
   * is JSON-RPC 2.0 as defined by the MCP specification, not an OpenAPI shape,
   * and no generated client speaks it.
   */
  @Post()
  @ApiProduces("application/json", "text/event-stream")
  @ApiOkResponse({
    description:
      "MCP JSON-RPC response. Streams as SSE when the exchange emits progress before its result.",
    schema: { type: "string" },
  })
  @ApiUnauthorizedResponse({
    description:
      "Missing or invalid access token. Carries the RFC 9728 WWW-Authenticate challenge pointing at the protected resource metadata.",
  })
  @ApiForbiddenResponse({
    description: "The token is valid but lacks a required scope",
  })
  post(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.handle(req, res);
  }

  /**
   * Session operations of the 2025-era protocol. Stateless serving holds
   * nothing between exchanges, so the handler answers these 405 — which is the
   * answer a client needs, and a better one than Nest's 404.
   */
  @All()
  @ApiExcludeEndpoint()
  all(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.handle(req, res);
  }

  /**
   * The body has already been read by the global JSON parser, so it is handed
   * over parsed — asking the adapter to read the stream again would hang.
   */
  private handle(req: Request, res: Response): Promise<void> {
    return this.guarded()(req, res, req.body);
  }
}

/**
 * Where this resource server fetches the keys it verifies access tokens with.
 *
 * It defaults to the authorization server's public address, which is right
 * whenever that address is reachable from here — the dev setup, and any deploy
 * where the app answers on one origin. It is overridable because that is not
 * universal: in the compose stack the API sits behind the web container, so
 * `APP_URL` resolves to nothing from inside it and verification would fail on
 * a network hop it never needed to make. Pointing this at the API's own
 * address keeps the check local.
 */
function mcpJwksUrl(): string {
  return process.env.MCP_JWKS_URL ?? `${APP_URL}/api/auth/jwks`;
}

/**
 * The claims of a verified access token that this resource server reads. Typed
 * structurally rather than as `jose`'s `JWTPayload` so the set of claims the
 * MCP endpoint actually depends on is stated in one place.
 */
interface AccessTokenClaims {
  sub?: string;
  scope?: unknown;
  client_id?: unknown;
  exp?: number;
}

/**
 * What the verified token proved, in the shape the MCP SDK passes through to
 * the server factory. `sub` is Better Auth's user id; it rides in `extra`
 * because `AuthInfo` has no first-class field for the resource owner.
 */
function authInfoFrom(claims: AccessTokenClaims): AuthInfo {
  return {
    // The SDK only passes this through; nothing downstream re-verifies it, and
    // the tools never see it.
    token: "",
    clientId: typeof claims.client_id === "string" ? claims.client_id : "",
    scopes: parseScopeClaim(claims.scope),
    expiresAt: claims.exp,
    extra: { userId: claims.sub },
  };
}
