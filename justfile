set shell := ["bash", "-euo", "pipefail", "-c"]

# List available recipes
default:
    @just --list

# Install toolchain and dependencies
setup:
    mise install
    pnpm install --frozen-lockfile
    # Browsers are installed once, through the site package; both apps pin the
    # same @playwright/test version, which `lint` checks.
    pnpm --filter @dhoa/site exec playwright install chromium firefox

# Format code in place
fmt:
    pnpm exec prettier --write .

# Lint and typecheck without modifying anything
lint:
    pnpm exec prettier --check .
    pnpm -r --if-present run lint
    # Both apps must run the same Playwright, or one of them tests with browsers the other installed.
    test "$(jq -r '.devDependencies["@playwright/test"]' apps/site/package.json)" = "$(jq -r '.devDependencies["@playwright/test"]' apps/admin-ui/package.json)"

# American English everywhere; see the script for what it does not flag
check-english:
    ./scripts/check-english.sh

# Re-derive where the parks are from the board's drawing into the seed. Needs
# the sibling tools repository for the street survey, and the network once for
# the aerial photograph. See the script's header for how it works.
park-positions:
    node apps/site/scripts/park-positions.mjs --write
    pnpm exec prettier --write apps/admin/seed/settings.json

# The seed must stay safe to apply twice; see the script for why
seed-check:
    ./scripts/check-seed-stable.sh

# Run the fast test suite
test *args:
    pnpm -r --if-present run test {{ args }}

# Secrets, vulnerable dependencies, and workflow problems. Fails on any finding.
security:
    gitleaks git --no-banner --redact
    gitleaks dir --no-banner --redact .
    osv-scanner scan --lockfile pnpm-lock.yaml
    actionlint
    zizmor --min-severity medium .github/workflows/

# Build every workspace package
build:
    pnpm -r --if-present run build

# Browser tests for the public site and the admin app (needs a build)
e2e:
    pnpm -r --if-present run e2e

# Run the public site locally, reachable over the LAN and Tailscale
run:
    pnpm --filter @dhoa/site run dev --host 0.0.0.0

# Serve the built public site (no dev-server flashes), reachable over the LAN and Tailscale
preview:
    pnpm --filter @dhoa/site run build
    pnpm --filter @dhoa/site exec astro preview --host 0.0.0.0 --port 4323

# Run the admin app locally on port 8787 (needs apps/admin/.dev.vars; see docs/RUNBOOK-admin.md)
# The UI is built into its own folder, so `just build` or `just ci` cannot pull it out from under the server.
run-admin:
    pnpm --filter @dhoa/admin-ui exec astro build --outDir .dev-dist
    cd apps/admin && pnpm exec wrangler d1 migrations apply dhoa --local
    cd apps/admin && pnpm exec wrangler dev --ip 0.0.0.0 --port 8787 --assets ../admin-ui/.dev-dist

# Fill the local admin database with the site's starting content (idempotent)
seed-local:
    cd apps/admin && node scripts/seed.ts
    cd apps/admin && pnpm exec wrangler d1 migrations apply dhoa --local
    cd apps/admin && pnpm exec wrangler d1 execute dhoa --local --file seed/seed.sql
    cd apps/admin && bash seed/kv.sh --local

# Save what the admin app currently publishes into apps/site/content/, which the site builds from
snapshot url="http://127.0.0.1:8787":
    node scripts/snapshot.ts {{ url }}

# Remove build output
clean:
    rm -rf apps/*/dist apps/*/.astro packages/*/dist apps/*/test-results apps/*/playwright-report

# Everything CI runs
ci: lint check-english seed-check test security build e2e
