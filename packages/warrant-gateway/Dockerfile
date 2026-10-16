FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
COPY packages/warrant-gateway/package*.json ./packages/warrant-gateway/
COPY packages/warrant-siege/package*.json ./packages/warrant-siege/
COPY packages/alexa-client/package*.json ./packages/alexa-client/
RUN npm ci

COPY packages/warrant-gateway ./packages/warrant-gateway
RUN npm --workspace=@warrant/gateway run build

FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache curl
ENV NODE_ENV=production

COPY package*.json ./
COPY packages/warrant-gateway/package*.json ./packages/warrant-gateway/
RUN npm ci --omit=dev

COPY --from=builder /app/packages/warrant-gateway/dist ./packages/warrant-gateway/dist
COPY packages/warrant-gateway/src ./packages/warrant-gateway/src

RUN mkdir -p /app/data

EXPOSE 8000
CMD ["node", "packages/warrant-gateway/dist/index.js"]
