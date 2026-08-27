FROM node:22-alpine AS build
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @mindmap/api...

COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @mindmap/shared build && pnpm --filter @mindmap/api build

EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]
