# Node 24.22.1 carries the CVE-2026-111497 Brotli decoder fix. Pinned by digest
# (multi-arch index, read 2026-10-23); the tag in front is documentation only.
FROM node:24.22.1-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53 AS base
WORKDIR /app

# Install production dependencies (includes native better-sqlite3 compilation)
FROM base AS deps
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev

# Build TypeScript
FROM base AS builder
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
RUN npm run build

# Production runner
FROM base AS runner
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 api
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

USER api
EXPOSE 3001
CMD ["node", "dist/index.js"]
