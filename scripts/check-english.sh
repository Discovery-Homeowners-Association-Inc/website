#!/usr/bin/env bash
# American English, everywhere: code identifiers, comments, docs and site copy.
#
# The association and its residents are in Maryland, and British spelling in a
# volunteer board's public documents reads as though someone else wrote them.
#
# The two meetings migrations are excluded: one is the record of a value that
# was created with the wrong spelling, and the other necessarily names that value
# in the expression that rewrites it. Both must contain it to do their job.
#
# Deliberately not listed: `aria-labelledby`, which is an HTML attribute rather
# than a spelling; upstream package names such as @img/colour in the lockfile;
# and license text quoted verbatim from its author.
set -euo pipefail
cd "$(dirname "$0")/.."

# Word stems that only exist in British spelling. Kept narrow on purpose: a
# false positive here blocks a commit, so anything ambiguous is left out.
british='materialis|organis|recognis|optimis|normalis|rasteris|prioritis|summaris|apologis|customis|standardis|utilis|specialis|authoris|realis|minimis|maximis|criticis|behaviour|colour|favour|honour|artefact|neighbour|\bcentre\b|\bgrey\b|\bplough|\bwhilst\b|\bamongst\b|\banalyse|\blicence\b|\bdefence\b|\bprogramme\b|\bpractise\b|\btravelled\b|\bcancelled\b'

hits=$(
  git grep -nIE "$british" -- \
    ':!pnpm-lock.yaml' ':!*.txt' ':!*LICENSE*' ':!scripts/check-english.sh' \
    ':!apps/admin/worker-configuration.d.ts' \
    ':!apps/admin/migrations/0002_app.sql' \
    ':!apps/admin/migrations/0006_canceled_spelling.sql' \
  | grep -v 'aria-labelledby' || true
)

if [ -z "$hits" ]; then
  echo "American English: clean"
else
  echo "British spellings found — this project uses American English:" >&2
  echo "$hits" >&2
  exit 1
fi
