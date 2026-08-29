import { createHash, timingSafeEqual } from "node:crypto";
import { INestApplication, Logger } from "@nestjs/common";
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from "@nestjs/swagger";
import type { NextFunction, Request, Response } from "express";

/** Where the UI is served. The raw spec lands beside it, not under it. */
const DOCS_PATH = "docs";

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle("ThinkClear API")
    .setDescription("ThinkClear app API")
    .setVersion("0.0.1")
    .addCookieAuth("better-auth.session_token")
    .build();

  return SwaggerModule.createDocument(app, config);
}

/**
 * Compares a submitted credential against the expected one without leaking it
 * through how long the comparison takes. `timingSafeEqual` throws on unequal
 * lengths, so both sides are hashed to a fixed width first — which also keeps
 * the password's length out of the timing.
 */
function secretsMatch(received: string, expected: string): boolean {
  const digest = (value: string) => createHash("sha256").update(value).digest();

  return timingSafeEqual(digest(received), digest(expected));
}

function requireBasicAuth(user: string, password: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const challenge = () => {
      // Without the challenge a browser has no way to ask for the credentials,
      // and the docs become unreachable rather than protected.
      res.setHeader(
        "WWW-Authenticate",
        'Basic realm="ThinkClear API docs", charset="UTF-8"',
      );
      res.status(401).send("Authentication required");
    };

    const [scheme, encoded] = (req.headers.authorization ?? "").split(" ");
    if (scheme?.toLowerCase() !== "basic" || !encoded) {
      challenge();
      return;
    }

    const decoded = Buffer.from(encoded, "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator === -1) {
      challenge();
      return;
    }

    // Split on the *first* colon only: RFC 7617 allows one in the password.
    const submittedUser = decoded.slice(0, separator);
    const submittedPassword = decoded.slice(separator + 1);

    // Both compared every time — `&&` would short-circuit on a wrong user and
    // answer measurably faster than a wrong password does.
    const userMatches = secretsMatch(submittedUser, user);
    const passwordMatches = secretsMatch(submittedPassword, password);
    if (!userMatches || !passwordMatches) {
      challenge();
      return;
    }

    next();
  };
}

/**
 * Serves Swagger UI behind HTTP basic auth, or not at all.
 *
 * The docs describe every route on a public host, so they are credentialed
 * rather than open — and when `DOCS_USER` / `DOCS_PASSWORD` are missing they are
 * **not mounted**. Failing closed is the point: a deployment that forgets to set
 * them loses `/docs`, which is noticed, rather than publishing them, which is
 * not. `pnpm openapi` is unaffected either way — `generate-openapi.ts` calls
 * `buildOpenApiDocument` directly and never serves anything.
 */
export function setupSwagger(app: INestApplication): void {
  const user = process.env.DOCS_USER;
  const password = process.env.DOCS_PASSWORD;

  if (!user || !password) {
    new Logger("Swagger").warn(
      `Set DOCS_USER and DOCS_PASSWORD to serve the API docs; /${DOCS_PATH} is disabled.`,
    );
    return;
  }

  const guard = requireBasicAuth(user, password);

  // SwaggerModule also publishes the raw document at `${path}-json` and
  // `${path}-yaml`. Those are siblings of the UI path rather than children of
  // it, so guarding `/docs` alone would leave the whole spec readable.
  for (const path of [DOCS_PATH, `${DOCS_PATH}-json`, `${DOCS_PATH}-yaml`]) {
    app.use(`/${path}`, guard);
  }

  SwaggerModule.setup(DOCS_PATH, app, buildOpenApiDocument(app));
}
