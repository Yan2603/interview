# 构建阶段：使用 Node.js 环境构建前端
FROM docker.m.daocloud.io/library/node:20-slim AS builder

# 设置工作目录
WORKDIR /app

# 复制依赖配置文件
COPY package*.json pnpm-lock.yaml ./

# 安装 pnpm 并安装依赖
RUN npm install -g pnpm && pnpm install

# 复制全部源码
COPY . .

# 构建前端（根据您的项目结构）
RUN pnpm --filter @interview/client build

# 运行阶段：使用 Nginx 托管静态资源
FROM docker.m.daocloud.io/library/nginx:alpine

# 从构建阶段复制生成的 dist 文件
COPY --from=builder /app/packages/client/dist /usr/share/nginx/html

# 复制自定义 Nginx 配置（如果存在）
COPY nginx.conf /etc/nginx/nginx.conf

# 暴露 80 端口
EXPOSE 80

# 启动 Nginx
CMD ["nginx", "-g", "daemon off;"]
