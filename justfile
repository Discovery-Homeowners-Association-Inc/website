set shell := ["bash", "-euo", "pipefail", "-c"]

# List available recipes
default:
    @just --list

# Install toolchain and dependencies
setup:
    mise install
    pnpm install --frozen-lockfile
    pnpm --filter @dhoa/site exec playwright install chromium firefox

# Format code in place
fmt:
    pnpm exec prettier --write .

# Lint and typecheck without modifying anything
lint:
    pnpm exec prettier --check .
    pnpm -r --if-present run lint

# Run the fast test suite
test *args:
    pnpm -r --if-present run test {{ args }}

# Audit dependencies for known vulnerabilities
security:
    pnpm audit --prod

# Build every workspace package
build:
    pnpm -r --if-present run build

# Browser tests for the public site and the admin app (needs a build)
e2e:
    pnpm -r --if-present run e2e

# Run the public site locally, reachable over the LAN and Tailscale
run:
    pnpm --filter @dhoa/site run dev --host 0.0.0.0

# Run the admin app locally on port 8787 (needs apps/admin/.dev.vars; see docs/RUNBOOK-admin.md)
run-admin:
    pnpm --filter @dhoa/admin-ui run build
    cd apps/admin && pnpm exec wrangler d1 migrations apply dhoa --local
    cd apps/admin && pnpm exec wrangler dev --ip 0.0.0.0 --port 8787

# Remove build output
clean:
    rm -rf apps/*/dist apps/*/.astro packages/*/dist apps/*/test-results apps/*/playwright-report

# Everything CI runs
ci: lint test security build e2e
