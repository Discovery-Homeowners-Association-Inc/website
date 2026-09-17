set shell := ["bash", "-euo", "pipefail", "-c"]

# List available recipes
default:
    @just --list

# Install toolchain and dependencies
setup:
    mise install
    pnpm install --frozen-lockfile

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

# Run the public site locally, reachable over the LAN and Tailscale
run:
    pnpm --filter @dhoa/site run dev --host 0.0.0.0

# Remove build output
clean:
    rm -rf apps/*/dist apps/*/.astro packages/*/dist

# Everything CI runs
ci: lint test security build
