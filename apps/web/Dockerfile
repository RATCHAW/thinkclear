# The web app ships to Vercel in production — this image exists so
# `docker compose --profile full up` runs the whole app on one origin the way a
# deployment does, and so the container scan in .github/workflows/security.yml
# has something to scan. Keep it working; it is the local stand-in for Vercel's
# rewrites (see vercel.json), and the nginx config here and that file describe
# the same routing.

FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS build
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter @mindmap/web...

COPY packages/shared packages/shared
COPY apps/web apps/web
RUN pnpm --filter @mindmap/shared build && pnpm --filter @mindmap/web build

FROM nginx:alpine@sha256:db35bfc6b2951e7f8a72db5db120288c127ffaeeb4a6d4b95a26fead017d5913
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
