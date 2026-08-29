# ThinkClear

AI mindmap app monorepo — Turborepo + pnpm.

## Stack

- **apps/api** — NestJS 11, Mongoose (`@nestjs/mongoose`), Better Auth (`@thallesp/nestjs-better-auth`), Swagger/OpenAPI, Vercel AI SDK, zod
- **apps/web** — Vite + React 19, Tailwind CSS v4, shadcn/ui, Better Auth client, React Flow (`@xyflow/react`), zod
- **packages/shared** — zod schemas shared between api and web
- **MongoDB** — via Docker

## Development

```bash
pnpm install
pnpm test:install-browser          # once, for browser end-to-end tests
docker compose up -d mongo        # start MongoDB
cp apps/api/.env.example apps/api/.env   # then set BETTER_AUTH_SECRET
pnpm dev                          # api on :3000, web on :5173
```

Open http://localhost:5173 — sign up, then you land in the workspace: the
mindmap canvas, with the library sheet behind the trigger in the top-left. The
footer of that sheet leads to **Account**, which owns everything about the
person rather than their mindmaps — signing out, connecting Google, and the
setup guide for pointing an agent client at your maps.

To offer Google as well as a password, set `GOOGLE_CLIENT_ID` and
`GOOGLE_CLIENT_SECRET` in `apps/api/.env` with
`http://localhost:5173/api/auth/callback/google` as the authorized redirect URI.
Without them the API reports no providers and the button is not rendered.

## Testing

The whole monorepo uses Vitest. Fast specs cover shared domain rules and API
services; end-to-end projects exercise the Nest HTTP boundary and the React app
in real headless Chromium. Browser tests use an in-memory API boundary, so they
need no running dev servers.

One exception is worth knowing before you trust a green run: `api:e2e` needs
**MongoDB**, because `mcp.e2e-spec.ts` imports the real `AuthModule` and Better
Auth reaches the database for the keys and tokens it issues. Everything else
mocks its services. `docker compose up -d mongo` covers it — and since that
container tends to be running already, a suite that passes locally can still
fail on a machine without it.

```bash
pnpm test             # everything, once
pnpm test:spec        # shared, API, and web specs
pnpm test:e2e         # API HTTP + browser user flows
pnpm test:watch       # watch mode
pnpm test:coverage    # text, HTML, and lcov coverage
```

Code quality is enforced from the repository root:

```bash
pnpm lint             # ESLint, including React Hooks and typed promise rules
pnpm lint:fix         # apply safe ESLint fixes
pnpm format           # format supported files with Prettier
pnpm format:check     # verify formatting without changing files
```

## Mindmaps

A user owns any number of mindmaps. Every route is session-scoped, and every
query is filtered by `ownerId`, so another account's mindmap and one that never
existed both come back as a 404.

| Route | |
|---|---|
| `GET /api/mindmaps` | the signed-in user's mindmaps, newest first |
| `GET /api/mindmaps/:id` | one mindmap |
| `POST /api/mindmaps` | create |
| `PATCH /api/mindmaps/:id` | rename (partial; an empty body is a 400) |
| `DELETE /api/mindmaps/:id` | delete, 204 |

Bodies are validated by the zod schemas in `packages/shared`, which the web app
imports too, so both ends agree on what a valid title is.

On the client, `apps/web/src/hooks/use-mindmaps.ts` wraps these in React Query.
Rename and delete are optimistic and roll back on failure. The selected mindmap
id lives in the zustand UI store and is resolved against the fetched list by
`useActiveMindmap`, so deleting the open mindmap needs no cleanup — it simply
stops matching.

- API docs (Swagger UI): http://localhost:3000/docs, behind HTTP basic auth —
  `DOCS_USER` / `DOCS_PASSWORD` from `apps/api/.env`. Leave either unset and the
  docs are not served at all, so a deployment that forgets them cannot publish
  its whole route list by accident.
- Regenerate the OpenAPI spec + web API types: `pnpm openapi`
  (writes `apps/api/openapi.json` and `apps/web/src/lib/api-types.d.ts`)

## MCP — use your mindmaps from your own agent

The same tools the built-in assistant calls are exposed over the Model Context
Protocol at `POST /api/mcp`, so Claude Code (or any MCP client) can list, read,
create, rename, reorganize, and delete your mindmaps, and read and write the
markdown note on any topic. Add it with nothing but the URL:

```bash
claude mcp add --transport http thinkclear http://localhost:5173/api/mcp
# deployed: your own origin, the one APP_URL names
claude mcp add --transport http thinkclear https://<your-app-origin>/api/mcp
```

The first call comes back `401` with an RFC 9728 `WWW-Authenticate` challenge;
the client follows it, registers itself, opens a browser, and you sign in and
approve the scopes on a consent screen. There is no API key to copy.

The app carries the same instructions for Claude Code, Codex, and anything else
under **Account › MCP** (`/?account=mcp`), with the endpoint filled in for the
origin you are actually on — and it is where a grant given on the consent screen
is taken back.

| Scope | |
|---|---|
| `mindmaps:read` | `list_mindmaps`, `read_mindmap`, `read_topic_note` |
| `mindmaps:write` | `create_mindmap`, `rename_mindmap`, `delete_mindmap`, `add_topics`, `rename_topic`, `move_topic`, `delete_topics`, `set_topic_note` |

Scopes are enforced by leaving tools out: a token without `mindmaps:write`
serves a tool list with no way to edit anything, so the client's model never
plans a call that was going to be refused. Every tool runs through
`MindmapsService` under the token owner's id, so an agent sees exactly the
mindmaps its user owns and writes are validated the same way the HTTP routes
validate them.

The tools are not restated for MCP — they are the assistant's, adapted — so
which scope a tool needs is derived from the same list the web app uses to know
which tools write. `set_topic_note` is also marked `destructiveHint` so a
client can confirm before an agent replaces a note you wrote.

Better Auth is the authorization server (`@better-auth/mcp`), which is why
`APP_URL` matters: the OAuth flow redirects to `/sign-in` and `/consent` in the
web app, and discovery is published at the origin root
(`/.well-known/oauth-protected-resource`, `/.well-known/oauth-authorization-server`).
Point `APP_URL` at the origin users actually reach the app on, not at the API's
port.

## Full docker stack

Builds the api and web images and runs everything in containers:

```bash
docker compose --profile full up --build
# web on http://localhost:5173, api on http://localhost:3000
```

This is the deployed topology in miniature: nginx serves the built SPA and
proxies `/api` and `/.well-known` to the API, so the whole app answers on one
origin the way it does in production.

## Deployment

[`DEPLOYMENT.md`](./DEPLOYMENT.md) is the guide. In short: the web app goes to
**Vercel**, the API to a **VPS through Coolify**, and Vercel's rewrites keep the
two on one origin — which the session cookie, Better Auth's OAuth redirects, and
MCP's root-level discovery all depend on. The API host is the one
per-deployment value in the repository, written literally in `vercel.json`
because Vercel does not interpolate environment variables into it.

| Workflow | |
|---|---|
| `.github/workflows/ci.yml` | format, lint, typecheck, tests, build, and a check that `openapi.json` / `api-types.d.ts` are not stale |
| `.github/workflows/deploy.yml` | the only thing that deploys the API — revalidates, pins Coolify to the tested commit, deploys, then verifies `/api/health` |
| `.github/workflows/security.yml` | secret, workflow, dependency, and container scans |

`GET /api/health` is the probe both Docker and Coolify read. It answers 503
while Mongo is unreachable, so a container that started without its database is
reported as a failed rollout rather than a working one.

## Design system

[`DESIGN.md`](./DESIGN.md) is the source of truth for the visual system — colors,
type scale, spacing, radii, elevation, and component specs. Its **Implementation
Map** section maps every `{token}` to the Tailwind utility that implements it.

Tokens live in `apps/web/src/index.css`. Reference tokens (`text-display-md`,
`bg-cloud`, `shadow-soft-lift`, `rounded-xl`) rather than hex/px values, and
build dark bands with the `surface-ink` class rather than ad-hoc colors.

## Adding shadcn components

`components.json` is set up, so from `apps/web`:

```bash
pnpm dlx shadcn@latest add <component>
```

New components inherit the design system automatically — the shadcn semantic
variables (`--background`, `--primary`, `--muted`, …) are aliased onto the
DESIGN.md tokens. Expect to still adjust radii and type on what you add, since
the generated defaults use `text-sm`/`rounded-md` conventions rather than the
token scale.

## License

[GNU AGPL v3.0](./LICENSE) — anyone may use, modify, share and sell this source
code, **but** derivatives must stay under the same license, and running a modified
version as a network service counts as distribution: its users have to be offered
the complete corresponding source (section 13). That network clause is what
separates the AGPL from the plain GPL, and it is the point of choosing it here.
