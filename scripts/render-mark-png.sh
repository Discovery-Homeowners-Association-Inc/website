#!/usr/bin/env bash
# Rasterises the association mark to a square PNG.
#
# Google's OAuth consent screen wants a square logo, 120 by 120 for best
# results, under 1 MB. The mark is drawn at 100 x 100.64, so it is rendered to
# height and centred on a square canvas rather than stretched to fit.
#
#   scripts/render-mark-png.sh [size]
#
# Needs librsvg (rsvg-convert) and ImageMagick, both OS packages:
#   sudo dnf install librsvg2-tools ImageMagick
set -euo pipefail
cd "$(dirname "$0")/.."

size="${1:-120}"
# A tenth of the canvas each side: Google draws the logo small, and a mark that
# runs to the edge reads as cropped.
inner=$(( size * 8 / 10 ))
out="packages/design/dhoa-mark-${size}.png"

rsvg-convert -h "$inner" -b white packages/design/dhoa-mark.svg \
  | magick png:- -gravity center -background white -extent "${size}x${size}" "$out"

printf '%s — %s, %s\n' "$out" "$(magick identify -format '%wx%h' "$out")" \
  "$(du -h "$out" | cut -f1)"
