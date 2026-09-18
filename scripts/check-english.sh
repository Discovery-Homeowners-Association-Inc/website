#!/usr/bin/env bash
# American English, everywhere: code identifiers, comments, docs and site copy.
#
# The association and its residents are in Maryland, and British spelling in a
# volunteer board's public documents reads as though someone else wrote them.
#
# Deliberately not listed: `aria-labelledby`, which is an HTML attribute rather
# than a spelling; upstream package names such as @img/colour in the lockfile;
# and license text quoted verbatim from its author.
set -euo pipefail
cd "$(dirname "$0")/.."

# Word stems that only exist in British spelling. Kept narrow on purpose: a
# false positive here blocks a commit, so anything ambiguous is left out.
british='materialis|organis|recognis|optimis|normalis|rasteris|prioritis|summaris|apologis|behaviour|colour|favour|honour|artefact|neighbour|\bcentre\b|\bwhilst\b|\bamongst\b'

hits=$(
  git grep -nIE "$british" -- \
    ':!pnpm-lock.yaml' ':!*.txt' ':!*LICENSE*' ':!scripts/check-english.sh' \
  | grep -v 'aria-labelledby' || true
)

if [ -z "$hits" ]; then
  echo "American English: clean"
else
  echo "British spellings found — this project uses American English:" >&2
  echo "$hits" >&2
  exit 1
fi
