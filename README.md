# Mindmap

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
mindmap canvas, with the library sheet behind the trigger in the top-left.

## Testing

The whole monorepo uses Vitest. Fast specs cover shared domain rules and API
services; end-to-end projects exercise the Nest HTTP boundary and the React app
in real headless Chromium. Browser tests use an in-memory API boundary, so the
suite does not require MongoDB or running dev servers.

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

- API docs (Swagger UI): http://localhost:3000/docs
- Regenerate the OpenAPI spec + web API types: `pnpm openapi`
  (writes `apps/api/openapi.json` and `apps/web/src/lib/api-types.d.ts`)

## Full docker stack

Builds the api and web images and runs everything in containers:

```bash
docker compose --profile full up --build
# web on http://localhost:5173, api on http://localhost:3000
```

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
