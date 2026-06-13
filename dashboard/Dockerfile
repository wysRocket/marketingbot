FROM node:20-bookworm-slim

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy built assets
COPY dist/ ./dist/
COPY server.ts ./

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server.ts"]
