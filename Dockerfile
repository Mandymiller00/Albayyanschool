FROM node:22-bookworm-slim AS dependencies

WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM node:22-bookworm-slim AS builder

WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public" \
    DIRECT_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public" \
    npm run build

FROM builder AS admin-bootstrap

CMD ["./node_modules/.bin/tsx", "scripts/bootstrap-admin.ts"]

FROM dependencies AS migrate

WORKDIR /app
COPY prisma ./prisma
CMD ["npm", "run", "db:migrate"]

FROM node:22-bookworm-slim AS runner

WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
