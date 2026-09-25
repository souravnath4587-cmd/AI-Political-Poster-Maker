# Build context: repository root (the API depends on packages/shared).
#   docker build -f apps/api/Dockerfile -t poster-api .

FROM node:24-slim AS base
RUN npm install -g pnpm@11.22.0
WORKDIR /app
# Chrome is installed explicitly in the runtime stage, not by puppeteer's postinstall.
ENV PUPPETEER_SKIP_DOWNLOAD=true

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter @app/api...
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @app/api build

FROM base AS runtime
ENV NODE_ENV=production \
    PUPPETEER_CACHE_DIR=/app/.cache/puppeteer
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --prod --filter @app/api...
# Chrome matching the installed puppeteer version, plus the system libraries it needs.
RUN cd apps/api \
    && pnpm exec puppeteer browsers install chrome --install-deps \
    && rm -rf /var/lib/apt/lists/* \
    && chown -R node:node /app/.cache
COPY --from=build /app/apps/api/dist apps/api/dist

USER node
WORKDIR /app/apps/api
EXPOSE 4000
CMD ["node", "dist/server.js"]
