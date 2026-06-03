FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json turbo.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

RUN npm ci
RUN cd packages/db && npx prisma generate
RUN npm run build --workspace=apps/api

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json ./package.json

EXPOSE 3001
CMD ["node", "dist/index.js"]
