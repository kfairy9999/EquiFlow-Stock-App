#!/usr/bin/env bash
# Builds the dashboard and deploys the Worker plus static assets.
# Requires `npx wrangler login` and `npx wrangler secret put GEMINI_API_KEY` first.
# This script is not run by CI.
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build
npx wrangler deploy
