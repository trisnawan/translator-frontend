# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Stage 1 - build the Angular production bundle.
# ---------------------------------------------------------------------------
FROM node:24-alpine AS build

WORKDIR /app

ENV NODE_OPTIONS=--max-old-space-size=1024
# Dependencies first, so this layer stays cached while only sources change.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

# `npm run build` = build:css + `ng build` (production is the default
# configuration, see angular.json). The API origin is deliberately NOT baked
# in here - it is injected at container start-up from API_BASE_URL
# (docker/40-runtime-config.sh), so the same image runs against localhost,
# staging and production.
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 2 - serve the static bundle with nginx only (serverless friendly).
# ---------------------------------------------------------------------------
FROM nginx:alpine AS runtime

# PORT                  port nginx listens on. Serverless container platforms
#                       (Cloud Run, App Runner, Azure Container Apps, ...)
#                       inject their own value; docker compose takes it from `.env`.
# API_BASE_URL          origin of the Translator API as reachable FROM THE
#                       BROWSER (it must not be a Docker-internal hostname).
#                       Written into assets/env.js at start-up, never at build time.
# NGINX_ENVSUBST_FILTER restricts envsubst to ${PORT} only, so nginx's own
#                       $uri / $host / $request_uri variables survive the
#                       template rendering untouched.
ENV PORT=80 \
    API_BASE_URL=https://translator-api.iarfcindonesia.com \
    NGINX_ENVSUBST_FILTER=^PORT$

COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY docker/40-runtime-config.sh /docker-entrypoint.d/40-runtime-config.sh
# sed strips CRLF in case the files were checked out on Windows.
RUN sed -i 's/\r$//' /etc/nginx/templates/default.conf.template /docker-entrypoint.d/40-runtime-config.sh \
    && chmod +x /docker-entrypoint.d/40-runtime-config.sh

COPY --from=build /app/dist/translator-frontend/browser /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -q --spider "http://127.0.0.1:${PORT}/" || exit 1

# The image's default entrypoint renders the template with $PORT, runs the
# /docker-entrypoint.d scripts (our env.js writer), then starts nginx.
