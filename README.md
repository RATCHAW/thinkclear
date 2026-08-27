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
docker compose up -d mongo        # start MongoDB
cp apps/api/.env.example apps/api/.env   # then set BETTER_AUTH_SECRET
pnpm dev                          # api on :3000, web on :5173
```

Open http://localhost:5173 — sign up, then you'll see “Welcome {email}”.

- API docs (Swagger UI): http://localhost:3000/docs
- Regenerate the OpenAPI spec + web API types: `pnpm openapi`
  (writes `apps/api/openapi.json` and `apps/web/src/lib/api-types.d.ts`)

## Full docker stack

Builds the api and web images and runs everything in containers:

```bash
docker compose --profile full up --build
# web on http://localhost:5173, api on http://localhost:3000
```

## Adding shadcn components

`components.json` is set up, so from `apps/web`:

```bash
pnpm dlx shadcn@latest add <component>
```
