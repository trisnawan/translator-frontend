#!/bin/sh
#
# Runs on every container start via the nginx image's /docker-entrypoint.d
# hook, BEFORE nginx. Turns the API_BASE_URL environment variable into
# `assets/env.js`, which `src/environments/environment.production.ts` reads at
# boot. Doing this at runtime (instead of build time) is what makes a single
# image deployable to any environment.
#
set -eu

# The app concatenates request paths onto this origin, so drop a trailing slash.
api_base_url="${API_BASE_URL:-}"
api_base_url="${api_base_url%/}"

printf 'window.__env = { apiBaseUrl: "%s" };\n' "$api_base_url" \
  > /usr/share/nginx/html/assets/env.js

echo "runtime-config: assets/env.js -> apiBaseUrl='${api_base_url}'"
