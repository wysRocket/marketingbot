FROM node:20-alpine
WORKDIR /app/dashboard
COPY dashboard/package*.json ./
RUN npm ci
COPY dashboard/ ./
RUN npm run build
EXPOSE 3000
CMD ["node", "server.mjs"]
