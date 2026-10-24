#!/bin/sh
# Rebuild the harness bundle and the PNG carrier html_preview inlines.
cd "$(dirname "$0")/.." && bunx vite build --config .kbs1/build.config.mjs > .kbs1/vite.log 2>&1 && node .kbs1/pack.mjs
