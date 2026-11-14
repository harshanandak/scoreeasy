#!/bin/sh
# check-concept-style.sh: keep a concept page on the shipped Kit look.
#
# Usage:  scripts/check-concept-style.sh page.html [more.html ...]
# Exit:   0 every page passes, 1 any page fails, 2 no file given.
#
# A concept page may style itself only with CSS that is a verbatim copy of a
# shipped file. It wraps each copy between two marker comments, each alone on
# its own line, inside a <style> block:
#
#   /* shipped:src/index.css */
#   ...the whole file, unchanged...
#   /* /shipped */
#
# The script then checks two things for every page:
#   1. Each marked block equals the named file on disk. The path is relative to
#      the git top level. Only a leading and trailing run of blank lines and
#      carriage returns are ignored. Anything else that differs fails.
#   2. CSS inside <style> blocks but outside marked blocks does not set
#      color, background, background-color, background-image, font-family,
#      border-radius, box-shadow, border, border-color or the four
#      border-top/right/bottom/left forms (with or without -color).
#      Layout properties are fine. Custom properties such as --x-color are fine.
#
# Failures print as  file:line: reason.
#
# Limits, so nobody reads more into a pass than is true:
#   - Only <style> blocks are read. style="..." attributes, linked stylesheets
#     and CSS written by scripts are not checked.
#   - A <style ...> opening tag must fit on one line.
#   - It checks that the copied text matches the file, not that the page uses
#     the classes well. The independent check still reads the page.
#   - Nothing runs this script automatically. It is not wired into CI or a hook.
#
# POSIX sh plus awk, tr, cmp, diff and git. Works in Git Bash on Windows.

if [ "$#" -eq 0 ]; then
  echo "usage: $0 page.html [more.html ...]" >&2
  exit 2
fi

root=$(git rev-parse --show-toplevel 2>/dev/null) || root=$(pwd)
tmp=$(mktemp -d 2>/dev/null) || { echo "check-concept-style: cannot make a temp dir" >&2; exit 1; }
trap 'rm -rf "$tmp"' EXIT HUP INT TERM

# Drop carriage returns and the leading and trailing blank lines.
norm() {
  tr -d '\r' < "$1" | awk '
    { a[NR] = $0 }
    END {
      s = 1
      while (s <= NR && a[s] ~ /^[ \t]*$/) s++
      e = NR
      while (e >= s && a[e] ~ /^[ \t]*$/) e--
      for (i = s; i <= e; i++) print a[i]
    }'
}

status=0

for page in "$@"; do
  if [ ! -r "$page" ]; then
    echo "$page:0: cannot read file"
    status=1
    continue
  fi

  rm -rf "$tmp/blk" && mkdir "$tmp/blk"
  : > "$tmp/manifest"

  # Pass 1: find banned properties in unmarked CSS, and cut out marked blocks.
  PAGE="$page" BLKDIR="$tmp/blk" MANIFEST="$tmp/manifest" awk '
    function strip_comments(t,   out, s, e) {
      out = ""
      while (t != "") {
        if (incmt) {
          e = index(t, "*/")
          if (!e) return out
          t = substr(t, e + 2); incmt = 0
        } else {
          s = index(t, "/*")
          if (!s) { out = out t; return out }
          out = out substr(t, 1, s - 1)
          t = substr(t, s + 2); incmt = 1
        }
      }
      return out
    }
    function scan(seg, ln,   t, p) {
      t = strip_comments(seg)
      if (match(t, /(^|[^A-Za-z0-9_.#-])(color|background(-color|-image)?|font-family|border-radius|box-shadow|border(-(top|right|bottom|left))?(-color)?)[ \t]*:/)) {
        p = substr(t, RSTART, RLENGTH)
        gsub(/^[^A-Za-z]+/, "", p); gsub(/[ \t]*:$/, "", p)
        printf "%s:%d: page sets \"%s\" outside a shipped block\n", page, ln, p
        bad = 1
      }
    }
    BEGIN { page = ENVIRON["PAGE"]; dir = ENVIRON["BLKDIR"]; manifest = ENVIRON["MANIFEST"]; ins = 0; ship = 0; nb = 0; incmt = 0; bad = 0 }
    {
      line = $0; sub(/\r$/, "", line)

      if (line ~ /^[ \t]*\/\*[ \t]*shipped:[^ \t*]+[ \t]*\*\/[ \t]*$/) {
        if (ship) { printf "%s:%d: shipped block opened inside another shipped block\n", page, NR; bad = 1; next }
        if (!ins) { printf "%s:%d: shipped marker outside a <style> block\n", page, NR; bad = 1; next }
        p = line
        sub(/^[ \t]*\/\*[ \t]*shipped:/, "", p); sub(/[ \t]*\*\/[ \t]*$/, "", p)
        nb++; ship = 1; cur = dir "/" nb
        printf "" > cur
        printf "%d\t%d\t%s\n", nb, NR, p >> manifest
        close(manifest)
        next
      }
      if (line ~ /^[ \t]*\/\*[ \t]*\/shipped[ \t]*\*\/[ \t]*$/) {
        if (!ship) { printf "%s:%d: end marker without a start marker\n", page, NR; bad = 1; next }
        close(cur); ship = 0
        next
      }
      if (ship) {
        if (index(line, "</style")) {
          printf "%s:%d: <style> closed inside an open shipped block\n", page, NR; bad = 1
          ship = 0; close(cur); ins = 0
          next
        }
        print line >> cur
        next
      }

      rem = line
      while (rem != "") {
        if (!ins) {
          i = index(rem, "<style")
          if (!i) break
          rem = substr(rem, i)
          g = index(rem, ">")
          if (!g) { rem = ""; break }
          rem = substr(rem, g + 1)
          ins = 1
        } else {
          e = index(rem, "</style")
          if (e) { seg = substr(rem, 1, e - 1); rem = substr(rem, e + 7); ins = 0 }
          else   { seg = rem; rem = "" }
          scan(seg, NR)
        }
      }
    }
    END {
      if (ship) { printf "%s:%d: shipped block never closed\n", page, NR; bad = 1 }
      exit bad ? 1 : 0
    }
  ' "$page" > "$tmp/out"
  awk_status=$?
  cat "$tmp/out"
  [ "$awk_status" -ne 0 ] && status=1

  # Pass 2: each marked block must equal the shipped file it names.
  while IFS='	' read -r idx line path; do
    [ -n "$idx" ] || continue
    src="$root/$path"
    if [ ! -f "$src" ]; then
      echo "$page:$line: shipped file not found: $path"
      status=1
      continue
    fi
    norm "$tmp/blk/$idx" > "$tmp/a"
    norm "$src" > "$tmp/b"
    if ! cmp -s "$tmp/a" "$tmp/b"; then
      echo "$page:$line: block differs from $path (first differences, page vs file):"
      diff "$tmp/a" "$tmp/b" | head -6 | sed 's/^/    /'
      status=1
    fi
  done < "$tmp/manifest"
done

if [ "$status" -eq 0 ]; then
  echo "check-concept-style: ok ($# file(s))"
fi
exit "$status"
