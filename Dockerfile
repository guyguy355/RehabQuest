# syntax=docker/dockerfile:1
# Single image: builds the web app and the API, serves both from one Node process.
# Build:  docker build -t rehabquest .
# Run:    docker run -p 3000:3000 --env-file server/.env -e CLIENT_DIST_DIR=/app/client/dist rehabquest
# Migrations run on every start (prisma migrate deploy), then the API listens on $PORT.

# --- web app ---------------------------------------------------------------------
FROM node:24-bookworm-slim AS client-build
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY client/ ./
# The API serves the app from the same origin; the client calls /api.
ENV VITE_API_URL=/api
RUN npm run build

# --- API -----------------------------------------------------------------------
FROM node:24-bookworm-slim AS server-build
WORKDIR /app/server
RUN apt-get update && apt-get install -y --no-install-recommends openssl python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY server/package.json server/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY server/ ./
RUN npx prisma generate && npm run build

# --- runtime -------------------------------------------------------------------
FROM node:24-bookworm-slim
ENV NODE_ENV=production \
    PORT=3000 \
    CLIENT_DIST_DIR=/app/client/dist \
    WORKER_IN_PROCESS=true \
    TRUST_PROXY=true
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app/server
COPY --from=server-build --chown=node:node /app/server/node_modules ./node_modules
COPY --from=server-build --chown=node:node /app/server/dist ./dist
COPY --from=server-build --chown=node:node /app/server/prisma ./prisma
COPY --from=server-build --chown=node:node /app/server/package.json ./package.json
# Sources and scripts stay available for operator tasks (npx tsx scripts/create-therapist.ts).
COPY --from=server-build --chown=node:node /app/server/src ./src
COPY --from=server-build --chown=node:node /app/server/scripts ./scripts
COPY --from=server-build --chown=node:node /app/server/tsconfig.json ./tsconfig.json
COPY --from=client-build --chown=node:node /app/client/dist /app/client/dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 CMD curl -fsS http://localhost:${PORT}/health || exit 1
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
