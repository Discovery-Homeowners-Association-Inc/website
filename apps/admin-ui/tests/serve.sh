#!/usr/bin/env bash
# Starts the admin Worker for the browser tests with a fresh, throwaway database.
set -euo pipefail
cd "$(dirname "$0")/../../admin"
state="$(mktemp -d)"
trap 'rm -rf "$state"' EXIT
pnpm exec wrangler d1 migrations apply dhoa --local --persist-to "$state" >/dev/null
node scripts/seed.ts >/dev/null
pnpm exec wrangler d1 execute dhoa --local --persist-to "$state" --file seed/seed.sql >/dev/null
bash seed/kv.sh --local --persist-to "$state" >/dev/null 2>&1
pnpm exec wrangler dev --ip 127.0.0.1 --port 8788 --persist-to "$state" \
  --env-file ../admin-ui/tests/e2e.env --show-interactive-dev-session=false
