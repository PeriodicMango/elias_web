# ---------------------------------------------------------------------------
# Elias Web Console — Docker image
# ---------------------------------------------------------------------------
# Build:
#   docker build -t elias-web -f platforms/web/Dockerfile .
#   (run from the monorepo root so both eliasCore/ and platforms/ are in context)
#
# Run:
#   docker run -p 3457:3457 --env-file platforms/web/.env -v elias-data:/data elias-web
# ---------------------------------------------------------------------------

FROM node:22-alpine AS builder
WORKDIR /app

# Copy package files
COPY platforms/web/package*.json ./
RUN npm ci

# Copy source
COPY platforms/web/tsconfig.json ./
COPY platforms/web/src ./src
COPY eliasCore ./eliasCore

# Type check
RUN npx tsc --noEmit

# ---------------------------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app

# Copy built artifacts from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/eliasCore ./eliasCore
COPY platforms/web/package*.json ./
COPY platforms/web/tsconfig.json ./

# Data volume for sessions.db, persona files, elias_data
VOLUME ["/data"]

ENV NODE_ENV=production
ENV WEB_PORT=3457

EXPOSE 3457

USER node
CMD ["npx", "tsx", "src/server.ts"]
