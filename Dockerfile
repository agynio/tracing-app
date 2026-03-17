# syntax=docker/dockerfile:1.7
FROM --platform=$BUILDPLATFORM node:20-slim AS base

ENV PNPM_HOME=/pnpm \
    PNPM_STORE_PATH=/pnpm-store \
    PATH=/pnpm:$PATH

RUN corepack enable \
 && corepack prepare pnpm@10.5.0 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN pnpm fetch

FROM base AS build

ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY . .

RUN pnpm install --offline --frozen-lockfile

RUN pnpm build

FROM nginx:1.27-alpine AS runtime

COPY docker/default.conf.template /etc/nginx/templates/default.conf.template

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 3000
