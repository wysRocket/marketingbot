# Force fresh build - timestamp 2026-06-16T12:42:00Z
FROM node:20-alpine
WORKDIR /app/dashboard
COPY dashboard/package.json dashboard/package-lock.json ./
RUN npm ci
COPY dashboard/ ./
RUN npm run build
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --retries=3 CMD wget -qO- http://localhost:${PORT}/api/health || exit 1
CMD ["node", "server.mjs"]
