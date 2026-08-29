# The image Coolify runs on the VPS. Two stages, for one reason: the API is
# compiled TypeScript, so the toolchain that compiles it (the Nest CLI,
# typescript, @types/*) has no business being in the thing that serves traffic.
# The runtime stage installs the production graph from the same lockfile and
# takes nothing from `build` but the two `dist` directories.

FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS build
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo

# Manifests first, so a source-only change reuses the install layer.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @mindmap/api...

COPY packages/shared packages/shared
COPY apps/api apps/api
# `apps/api` consumes @mindmap/shared from its `dist`, so shared builds first.
RUN pnpm --filter @mindmap/shared build && pnpm --filter @mindmap/api build

FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS runtime
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    NODE_ENV=production \
    PORT=3000
WORKDIR /repo

# The same manifests and the same lockfile as the build stage — `--prod` is the
# only difference, so what ships is a subset of what was compiled against, never
# a different resolution.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN corepack enable \
  && pnpm install --frozen-lockfile --prod --filter @mindmap/api... \
  # Nothing in the image installs packages after this line, and both of these
  # are network-facing tools running as root in a container that should have
  # neither.
  && corepack disable \
  && rm -rf \
    /root/.cache \
    /root/.local/share/pnpm \
    /usr/local/lib/node_modules/corepack \
    /usr/local/lib/node_modules/npm

# pnpm has already linked apps/api/node_modules/@mindmap/shared at the workspace
# directory; this is the build output that link resolves into.
COPY --from=build /repo/packages/shared/dist packages/shared/dist
COPY --from=build /repo/apps/api/dist apps/api/dist

# The `node` user ships with the image. Nothing here writes to disk, so it needs
# no ownership of /repo — only the right to read it.
USER node

EXPOSE 3000

# What Coolify's container probe reads. `/api/health` answers 503 while Mongo is
# unreachable, so a rollout that cannot reach its database is reported as failed
# rather than rolled out.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/api/dist/main.js"]
