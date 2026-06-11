FROM node:22-alpine

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app
COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/

RUN pnpm install --frozen-lockfile

COPY packages/shared/src packages/shared/src/
COPY packages/server/src packages/server/src/

WORKDIR /app/packages/server
ENV PORT=3001
CMD ["pnpm", "start"]
