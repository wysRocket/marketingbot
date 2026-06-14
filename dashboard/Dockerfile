FROM node:20-bookworm-slim
WORKDIR /app
COPY dist/ ./dist/
COPY server.mjs ./
COPY package.json ./
ENV PORT=3000
EXPOSE 3000
CMD node server.mjs
