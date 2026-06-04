FROM node:22-slim AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY index.html ./
COPY tsconfig.json ./
COPY public ./public
COPY src ./src
RUN npm run build

FROM node:22-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app
COPY server.mjs ./
COPY --from=build /app/dist ./dist

CMD ["node", "server.mjs"]
