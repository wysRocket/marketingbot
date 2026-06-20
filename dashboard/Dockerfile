FROM node:20-slim

WORKDIR /app

COPY dashboard/package.json dashboard/package-lock.json ./
RUN npm ci

COPY dashboard/ .
RUN npm run build

ENV PORT=3000
CMD ["npm", "start"]
