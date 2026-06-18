FROM node:20-alpine

# Install Chrome dependencies
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    python3 \
    make \
    g++ \
    chromium-chromedriver

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    PLAYWRIGHT_BROWSERS_PATH=/pw-browsers \
    NODE_ENV=production

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    PLAYWRIGHT_BROWSERS_PATH=/pw-browsers

# Install Playwright browsers
RUN npx playwright install chromium --with-deps 2>/dev/null || true

ENV BOT_SITE_PROFILE=guidenza \
    BOT_ENABLED=1 \
    CONCURRENCY=1 \
    TOTAL_ROUNDS=1 \
    ROUND_TIMEOUT_MS=120000 \
    RAILWAY_REPLICA_ID=local

CMD ["npx", "ts-node", "--transpile-only", "src/index.patchright.ts"]