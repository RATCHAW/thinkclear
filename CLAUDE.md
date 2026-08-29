# CLAUDE.md

Guidance for Claude Code working in this repository.

## Commands

```bash
pnpm install
docker compose up -d mongo          # MongoDB on :27017 (required for api + auth)
cp apps/api/.env.example apps/api/.env   # then set BETTER_AUTH_SECRET
pnpm dev                            # turbo: api :3000, web :5173
pnpm build                          # all workspaces
pnpm lint                           # ESLint, including type-aware promise rules
pnpm lint:fix                       # apply safe ESLint fixes
pnpm format                         # write Prettier formatting
pnpm format:check                   # check formatting without writing
pnpm typecheck                      # source type checks
pnpm test                           # all Vitest spec + end-to-end projects
pnpm test:spec                      # shared, API, and web unit specs
pnpm test:e2e                       # API HTTP + Chromium browser flows
pnpm test:watch                     # interactive Vitest watch mode
pnpm test:coverage                  # whole-repo coverage report
pnpm test:install-browser           # install Chromium for browser tests
pnpm openapi                        # regenerate openapi.json + web api-types.d.ts
```

Vitest is split into named projects: `shared:spec`, `api:spec`, `web:spec`,
`api:e2e`, and `web:e2e`. The browser project uses headless Chromium through
Vitest Browser Mode. Install it once with `pnpm test:install-browser`
if the local Playwright cache is empty. ESLint and Prettier are configured once
at the repository root; formatting rules are disabled inside ESLint so the two
tools do not compete. Run type checks from the root so turbo builds
`@mindmap/shared` first;
`apps/api` and `apps/web` both consume it from `dist/`, so editing
`packages/shared` and typechecking a single app in isolation will check against
a stale build.

Single-workspace commands: `pnpm --filter @mindmap/api <script>` (likewise
`@mindmap/web`, `@mindmap/shared`).

## Dev servers

Several Conductor workspaces share this machine and the fixed ports (api :3000,
web :5173), so treat servers as a checked-out resource:

- **Before starting anything**, check what's already listening:
  `lsof -nP -iTCP:3000 -iTCP:5173 -sTCP:LISTEN`. If the ports are taken, reuse
  the running servers (nest/vite hot-reload code edits automatically) — don't
  kill another workspace's servers without asking.
- **If you start servers for a task** (verification, browser testing), stop
  them when the task is done and confirm the ports are free again. Don't leave
  background dev servers running at the end of a turn.
- The `mindmap-mongo` Docker container is shared infra: leave it running if it
  is already up, and leave it up even after stopping the app servers.

## Architecture

Turborepo + pnpm workspaces, three packages:

- `apps/api` — NestJS 11, Mongoose, Better Auth, Swagger, Vercel AI SDK
- `apps/web` — Vite + React 19, Tailwind v4, shadcn/ui, React Flow, React Query
- `packages/shared` — zod schemas + types imported by both

### The API contract is generated, in two hops

1. Nest controllers + `@Api*` decorators + DTO classes → `apps/api/openapi.json`
   (`generate-openapi.ts` boots the app without listening and writes the spec)
2. `openapi.json` → `apps/web/src/lib/api-types.d.ts` via `openapi-typescript`

Both files are committed. **Never hand-edit `api-types.d.ts`** — change the API
and run `pnpm openapi`. Any change to a route, DTO, or response shape is
incomplete until that regeneration is committed alongside it.

### Request shapes are described twice, on purpose

- `packages/shared/src/*.ts` — zod schemas that actually **validate** requests,
  via `new ZodValidationPipe(schema)` on the `@Body()` param. The web app imports
  the same schemas, so both ends agree on what is valid.
- `apps/api/src/mindmaps/mindmap.dto.ts` — Nest DTO classes that exist only to
  **document** the shape for Swagger/OpenAPI (and therefore the web types).

They are not linked. Adding a field means editing the zod schema *and* the DTO
class, then regenerating. A DTO that drifts from its schema produces web types
that lie.

### MCP is the second transport over the same tools

`POST /api/mcp` (apps/api/src/mcp) serves the Model Context Protocol to
outside agent clients. It defines **no tools of its own**: `McpService` adapts
the AI SDK tool set from `MindmapToolsService.forOwner()` into MCP
registrations, so the chat panel and a connected agent call the same objects
and a tool added for one appears in the other. `packages/shared/src/mcp.ts`
derives each tool's required scope from `MUTATING_CHAT_TOOLS`, so a new write
tool cannot become callable with a read-only token by omission.

Serving is per-request and stateless (`createMcpHandler` with
`legacy: "stateless"`, which keeps 2025-era clients working — `reject` would
validate but nothing shipping could connect). The factory builds a fresh
`McpServer` per request from that request's verified token, which is what lets
the token decide the owner and the tool list. Scopes are enforced by
**omission**: an ungranted tool is not registered, so it is "no such tool"
rather than "denied".

Auth is OAuth 2.1, not the session cookie. `auth.ts` adds `jwt()` +
`mcp()` from `@better-auth/mcp`, which makes Better Auth the authorization
server; `requireMcpAuth` verifies the bearer token against its JWKS and answers
an unauthenticated call with the RFC 9728 challenge that bootstraps the whole
flow. Three things follow, and each is load-bearing:

- **`APP_URL` is the app's public origin, not the API's port.** The authorize
  endpoint redirects to `/sign-in` and `/consent`, which the *web* app serves,
  so the issuer has to be the origin those pages are on. `/api` is proxied
  there already.
- **Discovery lives at the origin root**, fixed by RFC 9728/8414, which is the
  one place Better Auth is not mounted. `OAuthDiscoveryController` forwards
  those paths into `auth.handler` unchanged — the plugin's `onRequest` hook
  matches on the raw pathname — so there is no second copy of the metadata.
  Both the vite proxy and `nginx.conf` must pass `/.well-known` through.
- **Both controllers are `@Public()`.** They are not unprotected: the module's
  global session guard would answer a bare 401 with no challenge in it, and a
  client with no cookie would have nowhere to go. `requireMcpAuth` is the check
  that replaces it. `mcp.e2e-spec.ts` imports the real `AuthModule` so removing
  `@Public()` fails the suite rather than silently breaking every client.

`MCP_JWKS_URL` overrides where tokens are verified against. It defaults to
`APP_URL`, which is right when that origin is reachable from the API — but in
the compose stack the API sits *behind* the web container, so it is set to the
API's own address there.

### Auth and ownership

Better Auth is mounted by `AuthModule.forRoot({ auth })` from
`@thallesp/nestjs-better-auth`; `apps/api/src/auth.ts` configures it against the
same Mongo database via its own `MongoClient`. `main.ts` creates the app with
`bodyParser: false` because Better Auth needs the raw body — the auth module
re-adds parsers for everything else. Don't re-enable the global body parser.

Better Auth is also the OAuth authorization server for MCP (see above), so
`auth.ts` carries the `jwt()` and `mcp()` plugins and `baseURL` is `APP_URL`.

Every resource route takes `@Session() session: UserSession` and passes
`session.user.id` into the service. In `MindmapsService` and
`ConversationsService`, **every query is scoped by `ownerId`** and a miss goes
through `orNotFound()`, so another user's document and a nonexistent one are
both a 404. Invalid ObjectIds short-circuit there too (otherwise Mongoose's
CastError becomes a 500). Follow that shape for new resources — no service
method should read a document by `_id` alone.

### The assistant is app-level, not canvas-level

`POST /api/chat` (apps/api/src/ai) streams an AI SDK UI-message response from
`streamText` with tools. The tools live in `MindmapToolsService` and call
`MindmapsService`, so the assistant does the **whole mindmap CRUD surface** —
list, read, create, rename, delete, plus topic edits — under the same
ownership scoping and `findMindmapGraphIssues` checks as the HTTP routes. That
is deliberate so a future MCP server can reuse the same service without the
chat transport. Tool errors are returned to the model as data
(`{ error, issues }`), not thrown, so it can repair a bad edit in one round
trip. Models are reached through LLM Gateway (`createGateway` from the `ai`
package, same wiring as vivace's coach): `LLM_GATEWAY_API_KEY` in
`apps/api/.env` is required (503 without it), the model comes from
`AI_CHAT_MODEL` written vendor/model (default `deepseek/deepseek-v4-flash`),
and `LLM_GATEWAY_URL` overrides the endpoint for a self-hosted gateway.

The open mindmap is **context, not scope**: `mindmapId` in the request body
only tells the system prompt what "this mindmap" resolves to. The assistant
works with nothing open.

The chat route is documented in Swagger but the web client calls it through
the AI SDK's `DefaultChatTransport` (plain fetch) — an SSE stream can't ride
the generated openapi-fetch client. `MUTATING_CHAT_TOOLS` in
`packages/shared/src/chat.ts` is the web ↔ api contract for which tool names
write to the database: the assistant panel invalidates the mindmap query when
one finishes, and the canvas reseeds via the `updatedAt` check below.

The canvas' seed-once rule has one exception for this: `MindmapEditor` tracks
the `updatedAt` it seeded from (advanced by its own saves) and, when the
fetched document carries an `updatedAt` it didn't produce, reseeds React Flow
state and drops any pending autosave — otherwise the debounced PATCH would
overwrite the server-side edit with the stale local graph.

### Chat history is a real resource

Conversations live in `apps/api/src/conversations` with full CRUD
(`/api/conversations`), and `conversationId` is **required** on `POST
/api/chat` — there is no such thing as an unsaved chat. The web client creates
the conversation (titled from the first message via
`conversationTitleFromMessage` in shared) before sending, so the id round trip
is a plain REST call rather than something smuggled through the stream.

The chat route writes twice per turn: the incoming messages up front, so a
failed or abandoned generation still leaves the question in the history, and
the whole turn again from `toUIMessageStream`'s `onEnd`. `messages` is stored
as opaque Mixed documents because the `UIMessage` shape belongs to the `ai`
package; `MAX_CONVERSATION_MESSAGES` bounds both what is stored and what
`chatRequestSchema` will accept, so history can always be replayed.

The list route projects `messages` away — `ConversationSummaryDto` vs
`ConversationDto` — and sorts by `updatedAt`, which every turn bumps.

`components/assistant-panel.tsx` (AI SDK Elements from
`components/ai-elements/`, vendored via the shadcn registry, restyled with the
design-system tokens) stays mounted so the conversation survives closing the
panel. It never remounts `useChat`; switching conversations calls
`setMessages` from the fetched document, tracked by a `seededId` so the
conversation adopted mid-send is not reseeded over its own live stream.
`components/assistant-history.tsx` is a layer *over* the chat rather than a
replacement for it, for the same reason. Both editable lists — the library and
history — share `components/list-row.tsx`.

### Web state split

- **Server state → React Query.** `apps/web/src/hooks/use-mindmaps.ts` owns all
  mindmap fetching/mutation, `hooks/use-conversations.ts` all chat history.
  Rename and delete are optimistic with rollback; the canvas autosave writes
  the response straight into the list cache instead of invalidating, since it
  fires on a debounce. `conversationKeys.list` and `conversationKeys.detail`
  are deliberately siblings, not parent and child — every finished turn
  invalidates the list, and a detail nested under that prefix would refetch on
  the same beat and race the live `useChat` messages.
- **UI state → the URL.** There is no client-side UI store; `window.location`
  is it. `lib/workspace-route.ts` is the whole grammar — `/mindmaps/<id>` for
  the canvas, `?library`, `?assistant` / `?assistant=history`, and `?chat=<id>`
  for the conversation the assistant holds whether or not the panel is open —
  and `hooks/use-workspace-route.ts` binds it to React with
  `useSyncExternalStore` over `popstate`. Nothing mirrors the URL, so Back, a
  reload, and a pasted link all land in the same place, and a caller that can
  only write a URL (the point: assistant-driven navigation) can drive the app.
  Navigate through the named transitions in that hook file rather than writing
  `history.pushState` — they hold the rules about what closes what, and keep a
  move that changes two things (open a mindmap, close the library) to one
  history entry. Invariants that *can* be expressed as grammar are: the
  serializer can't write history without the panel, which is what makes
  "closing the assistant puts history away" impossible to get wrong.
- The ids in the URL are intentionally never reconciled against the server —
  `useActiveMindmap()` resolves the mindmap id against the fetched list, so a
  deleted mindmap's or conversation's id, or a stale link to one, is inert
  rather than a dangling reference to clean up.

The canvas (`components/mindmap-canvas.tsx`) is keyed by mindmap id so switching
maps remounts the editor; React Flow state is seeded once from the fetched
document and then owned locally, which is what stops background refetches from
clobbering an in-progress edit.

All web requests go to the current origin — Vite proxies `/api` to :3000 (nginx
does it in the docker image) so the session cookie stays first-party. Don't
point the client at `http://localhost:3000` directly.

## Design system

`DESIGN.md` is the source of truth for the visual system, and its
**Implementation Map** section maps every `{token}` to the Tailwind utility that
implements it — read it before writing UI. Tokens live in
`apps/web/src/index.css`.

- Reference tokens (`text-display-md`, `bg-cloud`, `shadow-soft-lift`,
  `rounded-xl`), never raw hex or px.
- Dark bands use the `surface-ink` class. There is no dark theme; the `dark:`
  variant is class-gated so it can never fire from `prefers-color-scheme`.
- Use `cn()` from `lib/utils.ts` for class merging — it registers the custom
  token scales with tailwind-merge, without which `text-body-md` is treated as
  a color and silently dropped.
- Motion rules (easings, ≤300ms, transform/opacity/color only, no `ease-in`)
  are in DESIGN.md › Motion, derived from the `emil-design-eng` skill.
- The React Flow canvas deliberately deviates: it uses a roadmap.sh-style
  yellow-on-blue palette because it is content, not app chrome.

New shadcn components: `pnpm dlx shadcn@latest add <component>` from `apps/web`.
They inherit the system via the semantic aliases, but expect to fix radii and
type — generated defaults use `text-sm`/`rounded-md`.
