# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# Copy manifests first to leverage layer caching
COPY package*.json ./
RUN npm ci --omit=dev

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine

# Add tini for proper PID-1 signal handling
RUN apk add --no-cache tini

WORKDIR /app

# Copy installed modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source
COPY package.json ./
COPY src/ ./src/

# Non-root user for security
RUN addgroup -S proxy && adduser -S proxy -G proxy
USER proxy

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# tini as PID 1 handles SIGTERM cleanly
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/index.js"]
