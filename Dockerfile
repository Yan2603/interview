FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/
RUN pnpm install

FROM deps AS build
COPY packages ./packages
ENV NODE_ENV=production
RUN pnpm build:client && pnpm build:server
RUN mkdir -p packages/server/public && cp -r packages/client/dist/* packages/server/public/

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/server/dist ./dist
COPY --from=build /app/packages/server/public ./public
COPY --from=build /app/packages/server/package.json ./package.json
EXPOSE 3000
CMD ["node", "dist/main.js"]
