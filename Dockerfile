# 默认国内 DaoCloud；CI（GitHub Actions）通过 build-arg 覆盖为官方镜像
ARG NODE_IMAGE=docker.m.daocloud.io/library/node:20-slim
ARG NGINX_IMAGE=docker.m.daocloud.io/library/nginx:alpine

FROM ${NODE_IMAGE} AS builder
WORKDIR /app
RUN npm install -g pnpm

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/client/package.json packages/client/
COPY packages/server/package.json packages/server/
RUN pnpm install --filter @interview/client...

COPY packages/client ./packages/client
RUN pnpm --filter @interview/client build

FROM ${NGINX_IMAGE}
COPY --from=builder /app/packages/client/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
