# 默认国内 DaoCloud；CI（GitHub Actions）通过 build-arg 覆盖为官方镜像
ARG NODE_IMAGE=docker.m.daocloud.io/library/node:20-slim

FROM ${NODE_IMAGE} AS base
RUN npm install -g pnpm
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/
RUN echo "node-linker=hoisted" >> .npmrc
# 只装 server 及其依赖，避免把 ant-design-vue 等前端包打进 app 镜像
RUN pnpm install --filter @interview/server... --frozen-lockfile

FROM deps AS build
COPY packages/server ./packages/server
ENV NODE_ENV=production
RUN pnpm --filter @interview/server build

# 运行时只要 production 依赖（去掉 nest cli / typescript / vitest 等）
FROM base AS prod-deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/
RUN echo "node-linker=hoisted" >> .npmrc
RUN pnpm install --filter @interview/server... --frozen-lockfile --prod

FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/packages/server/dist ./dist
COPY --from=build /app/packages/server/package.json ./package.json
EXPOSE 3000
CMD ["node", "dist/main.js"]
