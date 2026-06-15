FROM node:20-alpine
WORKDIR /app
COPY dashboard/package*.json ./dashboard/
RUN cd dashboard && npm ci
COPY dashboard/ ./
RUN cd dashboard && npm run build
EXPOSE 3000
CMD ["node", "dashboard/server.mjs"]
