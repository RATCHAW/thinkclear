import createClient from "openapi-fetch";
import type { paths } from "./api-types";

// Typed against the generated OpenAPI schema (`pnpm generate:types`).
// Same-origin requests so the better-auth session cookie rides along.
export const api = createClient<paths>({ baseUrl: "/" });
