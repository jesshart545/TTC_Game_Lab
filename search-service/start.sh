#!/bin/sh
set -eu
mkdir -p /tmp/searxng-data
export SEARXNG_SECRET="$(head -c 32 /dev/urandom | base64)"
export GRANIAN_PORT="${PORT:-80}"
exec /usr/local/searxng/.venv/bin/granian searx.webapp:app
