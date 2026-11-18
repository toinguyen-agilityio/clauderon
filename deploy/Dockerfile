# Images for the self-hosted stack (ADR 0005). Build from the repo root:
#   docker compose -f deploy/compose.yml build
# One install of the whole workspace serves both targets; packages export
# TypeScript source, so the Gateway and the migrate job run it with tsx.
FROM node:22-bookworm-slim AS workspace
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile

# Gateway; also runs migrations with `pnpm db:migrate`.
FROM workspace AS gateway
ENV NODE_ENV=production
EXPOSE 4000
CMD ["pnpm", "--filter", "@clauderon/gateway", "start"]

FROM workspace AS web
ENV NODE_ENV=production
RUN pnpm --filter @clauderon/web build
EXPOSE 3000
CMD ["pnpm", "--filter", "@clauderon/web", "start"]
