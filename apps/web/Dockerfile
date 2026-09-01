# The web app ships to Vercel in production — this image exists so
# `docker compose --profile full up` runs the whole app on one origin the way a
# deployment does, and so the container scan in .github/workflows/security.yml
# has something to scan. Keep it working; it is the local stand-in for Vercel's
# rewrites (see vercel.json), and the nginx config here and that file describe
# the same routing.

FROM node:26-alpine@sha256:2d984a15c9b54fd0aeb608b8e0d0d83529eb34d2966db27a1fb4f1edc3d298a3 AS build
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter @thinkclear/web...

COPY packages/shared packages/shared
COPY apps/web apps/web
RUN pnpm --filter @thinkclear/shared build && pnpm --filter @thinkclear/web build

FROM nginx:alpine@sha256:db35bfc6b2951e7f8a72db5db120288c127ffaeeb4a6d4b95a26fead017d5913
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
