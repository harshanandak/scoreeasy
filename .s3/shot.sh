#!/bin/sh
# usage: .s3/shot.sh -> rebuild the harness bundle + carrier PNG
cd "$(dirname "$0")/.." && bunx vite build --config .s3/build.vite.mjs > .s3/vite.log 2>&1 && node .s3/pack.mjs
