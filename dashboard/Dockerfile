FROM node:20-bookworm-slim AS builder
WORKDIR /build
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx vite build

FROM node:20-bookworm-slim
WORKDIR /app
COPY --from=builder /build/dist/ ./dist/
COPY server.mjs ./
ENV PORT=3000
EXPOSE 3000
CMD ["node", "server.mjs"]
