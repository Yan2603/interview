FROM docker.m.daocloud.io/library/node:20-slim
WORKDIR /app
COPY package*.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --prod
COPY . .
EXPOSE 3000
CMD ["pnpm", "run", "dev:server"]
