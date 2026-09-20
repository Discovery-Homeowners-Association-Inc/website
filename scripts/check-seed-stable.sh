#!/usr/bin/env bash
# The seed must be safe to apply twice.
#
# Every row it writes is keyed on something stable -- items on (kind, slug),
# committees on slug -- so `insert or ignore` makes a second run a no-op. People
# were the exception: they were inserted with a fresh uuid each run, so a second
# run duplicated the whole board. `just seed-local` says it is idempotent and
# apps/admin/README.md tells you to run the same seed against production.
#
# This generates the seed twice and checks that the ids it hands out do not
# move. Timestamps do move, and are meant to, so they are not compared.
set -euo pipefail
cd "$(dirname "$0")/../apps/admin"

ids() {
  node scripts/seed.ts >/dev/null
  grep -oE "into (people|items) \(id[^)]*\) values \('[^']+'" seed/seed.sql \
    | grep -oE "'[^']+'$" | sort
}

first=$(ids)
second=$(ids)

if [ "$first" = "$second" ]; then
  printf 'seed is stable: %s ids unchanged across two runs\n' "$(wc -l <<<"$first")"
else
  echo "SEED IS NOT STABLE — applying it twice would duplicate rows:" >&2
  diff <(echo "$first") <(echo "$second") | head -20 >&2
  exit 1
fi
