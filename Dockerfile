FROM node:20-bookworm-slim

# System dependencies required by Chromium (Patchright's patched browser)
RUN apt-get update && apt-get install -y --no-install-recommends \
      libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
      libdbus-1-3 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 \
      libxrandr2 libgbm1 libasound2 libpango-1.0-0 libcairo2 \
      libx11-6 libx11-xcb1 libxcb1 libxext6 libxi6 libxrender1 libxtst6 \
      unzip \
      fonts-liberation ca-certificates wget curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm install

# Bust cache for src/ layer on each build
ARG CACHE_BUST=1

COPY src/ ./src/
COPY mostlogin-extensions/ ./.extensions/
RUN npx ts-node src/scripts/pullExtensions.ts

ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/app/pw-browsers

# Conservative default for smaller Railway instances.
# Increase via env var if your service has enough RAM.
ENV CONCURRENCY=1
ENV BOT_SITE_PROFILE=guidenza
ENV SKIP_IP_CHECK=1

# Install Playwright browsers at startup
CMD ["sh", "-c", "set -x; export PLAYWRIGHT_BROWSERS_PATH=/app/pw-browsers; mkdir -p /app/pw-browsers; echo 'Checking Chrome...'; ls -la /app/pw-browsers/ 2>/dev/null || echo 'No pw-browsers dir'; echo 'Trying npx install...'; npx patchright install chromium 2>&1 || echo 'npx install failed'; echo 'Checking after install...'; find /app/pw-browsers -name chrome 2>/dev/null || echo 'No chrome found'; echo 'Trying curl...'; curl -v -L --max-time 60 -o /tmp/chrome-test.zip https://cdn.playwright.dev/builds/cft/145.0.7632.6/linux64/chrome-linux.zip 2>&1 | tail -5 || echo 'curl failed'; ls -la /tmp/chrome-test.zip 2>/dev/null || echo 'No zip file'; npx ts-node src/index.patchright.ts"]
