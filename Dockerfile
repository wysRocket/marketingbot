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

# Download Patchright's patched Chromium (cached in this image layer)
RUN npx patchright install chromium --with-deps

COPY src/ ./src/
RUN npx ts-node src/scripts/pullExtensions.ts

ENV NODE_ENV=production

# Conservative default for smaller Railway instances.
# Increase via env var if your service has enough RAM.
ENV CONCURRENCY=1
ENV BOT_SITE_PROFILE=eurocookflow
ENV SKIP_IP_CHECK=1

CMD ["npx", "ts-node", "src/index.patchright.ts"]
