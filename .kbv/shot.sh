#!/bin/sh
# usage: .kbv/shot.sh -> rebuild bundle + carrier (then html_preview the page from page.mjs).
# Needs .kbv/fonts-inline.css (untracked): copy it from the #210 harness, .worktrees/feat-kabaddi-raid-board/.kbe/.
cd "$(dirname "$0")/.." && bunx vite build --config .kbv/build.config.mjs > .kbv/build.log 2>&1 && node .kbv/pack.mjs
