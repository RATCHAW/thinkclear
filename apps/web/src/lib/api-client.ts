import createClient from "openapi-fetch";
import type { paths } from "./api-types";

// Typed against the generated OpenAPI schema (`pnpm generate:types`).
// Same-origin requests so the better-auth session cookie rides along.
// The tiny forwarding function intentionally looks up `fetch` per request.
// That keeps browser instrumentation, test doubles, and future polyfills from
// being frozen to whichever implementation existed when this module loaded.
export const api = createClient<paths>({
  baseUrl: "/",
  fetch: (...args) => globalThis.fetch(...args),
});
