#!/usr/bin/env bash
# Builds the two self-hosted WOFF2 files in app/fonts within the doc 12 budgets (display 35 KB, body 30 KB).
# Needs Python with fonttools and brotli: pip install fonttools brotli
# Re-run only when a font or the character set changes; the output files are committed.
set -euo pipefail
cd "$(dirname "$0")/.."
SRC="${FONT_SRC:-$(mktemp -d)}"
OUT=app/fonts
GF=https://github.com/google/fonts/raw/main/ofl
mkdir -p "$OUT"

fetch() { [ -f "$SRC/$2" ] || curl -sSfL -o "$SRC/$2" "$GF/$1"; }
fetch 'plusjakartasans/PlusJakartaSans%5Bwght%5D.ttf' jakarta.ttf
fetch 'plusjakartasans/OFL.txt' jakarta-OFL.txt
fetch 'bricolagegrotesque/BricolageGrotesque%5Bopsz,wdth,wght%5D.ttf' bricolage.ttf
fetch 'bricolagegrotesque/OFL.txt' bricolage-OFL.txt

# Basic Latin, Latin-1, quotes and dashes for content, bullet, ellipsis, naira, euro, minus, arrows, small triangles.
UNI='U+0000-00FF,U+0131,U+0152-0153,U+02C6,U+02DA,U+02DC,U+2013-2014,U+2018-201A,U+201C-201E,U+2022,U+2026,U+2039-203A,U+20A6,U+20AC,U+2122,U+2190-2193,U+2212,U+25B4-25BE'

# Body: keep the weight axis (400 to 800) so one file serves every body, label and price style.
fonttools varLib.instancer "$SRC/jakarta.ttf" wght=400:800 -q -o "$SRC/jakarta-cut.ttf"
pyftsubset "$SRC/jakarta-cut.ttf" --unicodes="$UNI" --layout-features='kern,liga,calt,tnum,lnum,case' --flavor=woff2 --output-file="$OUT/plus-jakarta-sans.woff2"

# Display: pin optical size and width, keep weights 600 to 800 (doc 12 budget note).
fonttools varLib.instancer "$SRC/bricolage.ttf" opsz=24 wdth=100 wght=600:800 -q -o "$SRC/bricolage-cut.ttf"
pyftsubset "$SRC/bricolage-cut.ttf" --unicodes="$UNI" --layout-features='kern,liga,calt,tnum,lnum' --flavor=woff2 --output-file="$OUT/bricolage-grotesque.woff2"

cp "$SRC/jakarta-OFL.txt" "$OUT/OFL-plus-jakarta-sans.txt"
cp "$SRC/bricolage-OFL.txt" "$OUT/OFL-bricolage-grotesque.txt"
ls -l "$OUT"
