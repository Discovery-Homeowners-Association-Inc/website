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
#
# `centre` and `metre` carry no word boundary at all, deliberately: the first
# spelling to get past this list was "Centres", the second a whole script
# written in "metres", and the third a `toMetres` that the boundary could not
# see inside. No American word contains either stem, in any case. `labelled` and `labelling` carry one at each end
# so that `aria-labelledby` is not caught by them.
#
# The match is case-insensitive. It was not, which meant a British spelling at
# the start of a sentence -- "Centres", "Colour" -- was never looked at.
british='materialis|organis|recognis|optimis|normalis|rasteris|prioritis|summaris|apologis|customis|standardis|utilis|specialis|authoris|realis|minimis|maximis|criticis|behaviour|colour|favour|honour|artefact|neighbour|centre|metre|judgement|skilful|instalment|sceptic|manoeuvr|\benrol\b|\blearnt\b|\blabell(ed|ing)\b|\bmodell(ed|ing)\b|\btravell(ed|ing)\b|\bcancell(ed|ing)\b|\bgrey\b|\bplough|\bwhilst\b|\bamongst\b|\banalyse|\blicence\b|\bdefence\b|\bprogramme\b|\bpractise\b'

hits=$(
  git grep -nIiE "$british" -- \
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
