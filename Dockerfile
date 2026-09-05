FROM node:20-bookworm-slim

WORKDIR /app

COPY node/package*.json ./node/

RUN cd node && npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
ENV NODE_HOST=0.0.0.0
ENV NODE_PORT=3001

EXPOSE 3001

WORKDIR /app/node

CMD ["node", "server.js"]
