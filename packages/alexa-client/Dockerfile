FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
COPY packages/alexa-client/package*.json ./packages/alexa-client/
RUN npm ci

COPY packages/alexa-client ./packages/alexa-client
RUN npm --workspace=@warrant/alexa-client run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY packages/alexa-client/package*.json ./packages/alexa-client/
RUN npm ci --omit=dev

COPY --from=builder /app/packages/alexa-client/.next ./packages/alexa-client/.next
COPY --from=builder /app/packages/alexa-client/public ./packages/alexa-client/public
COPY packages/alexa-client ./packages/alexa-client

EXPOSE 3000
CMD ["npm", "--workspace=@warrant/alexa-client", "start"]
