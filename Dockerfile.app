FROM docker.m.daocloud.io/library/node:20-slim AS base
RUN npm install -g pnpm
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/
RUN pnpm install --filter @interview/server...

FROM deps AS build
COPY packages/server ./packages/server
ENV NODE_ENV=production
RUN pnpm --filter @interview/server build

FROM docker.m.daocloud.io/library/node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/server/dist ./dist
COPY --from=build /app/packages/server/package.json ./package.json
EXPOSE 3000
CMD ["node", "dist/main.js"]
