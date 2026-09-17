#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
pnpm exec wrangler kv key put --binding FILES "$@" 'ca31cd1c8538c24ae40b118214f5f07c' --path 'seed/files/discovery-community-site-plan.pdf'
pnpm exec wrangler kv key put --binding FILES "$@" 'a94beee059406b4d0150c1a030eedb00' --path 'seed/files/recreation-center-rental-contract.pdf'
pnpm exec wrangler kv key put --binding FILES "$@" '096058e42391006b924ecd1db1eb6d10' --path 'seed/files/rv-lot-policy-update-2025.pdf'
pnpm exec wrangler kv key put --binding FILES "$@" '1c54027af5fed87474380142de3396b4' --path 'seed/files/rv-lot-registration-form.pdf'
pnpm exec wrangler kv key put --binding FILES "$@" 'dd8c5356d604b99ce8e22e063e1248db' --path 'seed/files/water-main-phase-1-plans.pdf'
