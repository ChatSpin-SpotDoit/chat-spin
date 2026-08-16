FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV CI=true
RUN corepack enable

WORKDIR /app
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm --filter @chatspin/config build
RUN pnpm --filter @chatspin/shared build
RUN pnpm --filter @chatspin/protocol build
RUN pnpm --filter @chatspin/server build

EXPOSE 3001
CMD ["node", "apps/server/dist/index.js"]
