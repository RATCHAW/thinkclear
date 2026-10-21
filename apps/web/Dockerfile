# The web app ships to Vercel in production — this image exists so
# `docker compose --profile full up` runs the whole app on one origin the way a
# deployment does, and so the container scan in .github/workflows/security.yml
# has something to scan. Keep it working; it is the local stand-in for Vercel's
# rewrites (see vercel.json), and the nginx config here and that file describe
# the same routing.

FROM node:22-alpine@sha256:ce8d97f7cfc7c5386421eb932df20a29df99b1a7f469f6157d5c9956702ffadc AS build
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

FROM nginx:alpine@sha256:72ba65eb42c10344912a84ff42408db7d34f2feb642204570ab8fc5ffd29f1d3
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
