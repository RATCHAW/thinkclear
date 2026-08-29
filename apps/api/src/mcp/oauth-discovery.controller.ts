import { All, Controller, Req, Res } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { Public } from "@thallesp/nestjs-better-auth";
import { toNodeHandler } from "better-auth/node";
import type { Request, Response } from "express";
import { auth } from "../auth";

/**
 * OAuth discovery documents, served from the origin root.
 *
 * An MCP client bootstraps from nothing but the endpoint URL: it gets a 401
 * naming `{origin}/.well-known/oauth-protected-resource/api/mcp`, reads the
 * authorization server out of that, then reads *its* metadata at
 * `{origin}/.well-known/oauth-authorization-server/api/auth`. Both paths are
 * fixed by RFC 9728 and RFC 8414 — they sit at the root with the resource's
 * and issuer's own path appended, which is precisely the one place Better Auth
 * is not mounted, since it owns `/api/auth`.
 *
 * So the documents are not rebuilt here, only reached: the request is handed
 * to Better Auth's handler unchanged, and the MCP plugin's `onRequest` hook —
 * which matches on the raw pathname, before any base-path routing — answers
 * it. One source of truth for what the server advertises, and no second copy
 * of the metadata to drift.
 */
/**
 * Public by necessity, not by oversight: discovery is what a client reads
 * *before* it has any credentials, so a session check here would make the
 * documents unreachable to exactly the callers they exist for. They carry no
 * user data — only the endpoints and scopes this server offers, which are the
 * same for everyone.
 */
@Public()
@ApiExcludeController()
@Controller()
export class OAuthDiscoveryController {
  private readonly serve = toNodeHandler(auth);

  @All([
    ".well-known/oauth-protected-resource",
    ".well-known/oauth-protected-resource/*path",
    ".well-known/oauth-authorization-server",
    ".well-known/oauth-authorization-server/*path",
    ".well-known/openid-configuration",
  ])
  discovery(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.serve(req, res);
  }
}
