FROM node:20-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist/ ./dist/
COPY server.ts ./

ENV NODE_ENV=production
ENV PORT=3000
ENV TELEMETRY_DIR=/data/telemetry

EXPOSE 3000

CMD ["node", "server.ts"]
