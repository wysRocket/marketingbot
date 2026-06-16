FROM node:20-alpine
WORKDIR /app/dashboard
COPY dashboard/package*.json ./
RUN npm ci --omit=dev
COPY dashboard/ ./
RUN npm run build
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --retries=3 CMD wget -qO- http://localhost:3000/api/health || exit 1
CMD ["node", "server.mjs"]
