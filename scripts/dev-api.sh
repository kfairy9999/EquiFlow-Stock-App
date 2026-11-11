#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p dist
if [ ! -f dist/index.html ]; then
  printf '%s\n' '<!doctype html><meta charset="utf-8"><title>EquiFlow API</title><p>During local development the dashboard is on port 3000. This process serves /api.</p>' > dist/index.html
fi
exec npx wrangler dev --port 8787
