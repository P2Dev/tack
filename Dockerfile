FROM node:24-alpine AS build

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN BETTER_AUTH_SECRET=build-only-secret-at-least-32-characters \
    BETTER_AUTH_URL=http://localhost:3000 \
    pnpm build

ENV NODE_ENV=production
RUN chown -R node:node /app/.next
USER node
EXPOSE 3000

CMD ["sh", "-c", "node --import tsx scripts/migrate.ts && node --import tsx scripts/bootstrap-admin.ts && node node_modules/next/dist/bin/next start"]
