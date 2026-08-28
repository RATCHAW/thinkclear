# CLAUDE.md

Guidance for Claude Code working in this repository.

## Commands

```bash
pnpm install
docker compose up -d mongo          # MongoDB on :27017 (required for api + auth)
cp apps/api/.env.example apps/api/.env   # then set BETTER_AUTH_SECRET
pnpm dev                            # turbo: api :3000, web :5173
pnpm build                          # all workspaces
pnpm typecheck                      # the only automated check in the repo
pnpm openapi                        # regenerate openapi.json + web api-types.d.ts
```

There is **no test suite and no linter** — `pnpm lint` resolves to no tasks.
`pnpm typecheck` is what verifies a change. Run it from the root so turbo builds
`@mindmap/shared` first; `apps/api` and `apps/web` both consume it from `dist/`,
so editing `packages/shared` and typechecking a single app in isolation will
check against a stale build.

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
- `apps/web` — Vite + React 19, Tailwind v4, shadcn/ui, React Flow, React Query, zustand
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

### Auth and ownership

Better Auth is mounted by `AuthModule.forRoot({ auth })` from
`@thallesp/nestjs-better-auth`; `apps/api/src/auth.ts` configures it against the
same Mongo database via its own `MongoClient`. `main.ts` creates the app with
`bodyParser: false` because Better Auth needs the raw body — the auth module
re-adds parsers for everything else. Don't re-enable the global body parser.

Every resource route takes `@Session() session: UserSession` and passes
`session.user.id` into the service. In `MindmapsService`, **every query is scoped
by `ownerId`** and a miss goes through `orNotFound()`, so another user's document
and a nonexistent one are both a 404. Invalid ObjectIds short-circuit there too
(otherwise Mongoose's CastError becomes a 500). Follow that shape for new
resources — no service method should read a document by `_id` alone.

### Web state split

- **Server state → React Query.** `apps/web/src/hooks/use-mindmaps.ts` owns all
  mindmap fetching/mutation. Rename and delete are optimistic with rollback;
  the canvas autosave writes the response straight into the list cache instead
  of invalidating, since it fires on a debounce.
- **UI-only state → zustand** (`stores/ui-store.ts`). Nothing fetched belongs
  here. `selectedMindmapId` is intentionally never reconciled against the
  server — `useActiveMindmap()` resolves it against the fetched list, so a
  deleted mindmap's id is inert rather than a dangling reference.

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
