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

# Install Playwright browsers at startup by downloading directly
CMD ["sh", "-c", "\
  export PLAYWRIGHT_BROWSERS_PATH=/app/pw-browsers && \
  mkdir -p /app/pw-browsers && \
  if [ ! -f /app/pw-browsers/chromium-1208/chrome-linux64/chrome ]; then \
    echo 'Downloading Chrome for Testing (162MB)...' && \
    curl -L --retry 5 --max-time 600 -o /tmp/chrome-linux.zip https://cdn.playwright.dev/builds/cft/145.0.7632.6/linux64/chrome-linux.zip && \
    unzip -q /tmp/chrome-linux.zip -d /app/pw-browsers/chromium-1208 && \
    chmod +x /app/pw-browsers/chromium-1208/chrome-linux64/chrome && \
    rm -f /tmp/chrome-linux.zip && \
    echo 'Chrome OK'; \
  else \
    echo 'Chrome already present'; \
  fi && \
  npx ts-node src/index.patchright.ts"]
