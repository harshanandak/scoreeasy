# App icon sources

Harsha approved the original hand-drawn ball on the Kit “Go green” tile on
2026-10-22. These seven SVGs are copied unchanged from the approved
`E:/tmp/logo-board/svg/` files. The external visual reference is
`E:/tmp/logo-board/logo-board.html`; regeneration does not need that directory.

From the repository root:

```sh
bun install --frozen-lockfile
bun run icons:generate
bun run build
bun run icons:verify
```

The renderer is pinned to Sharp 0.34.5 in `package.json` and `bun.lock`.
All PNGs are rendered from SVG at the destination size, rather than upscaling
another PNG. The script writes 37 platform PNGs, web SVGs, Android XML resources,
and a labeled contact sheet of all 37 PNGs at
`docs/plans/2026-10-22-app-icon/contact-sheet.png`. The adjacent
`generated-files.json` enumerates every PNG and its dimensions. PNG generation
has no timestamps or random inputs; contact-sheet font rendering depends on
the host's installed sans-serif font.

- Web and legacy Android launcher icons preserve the approved rounded tile.
- The maskable source supplies opaque PWA icons and the transparent Android
  adaptive foreground. Its white mark fits within the central 66% circle.
- Android adaptive icons use the approved solid core `#00662a` background and
  a vector translation of the same maskable mark. Both round and ordinary
  adaptive entries reference the new drawable resources.
- iOS AppIcon and the 180px Apple touch icon remove the tile's corner radius,
  flatten the background, and omit the alpha channel. iOS supplies its own mask.
  The existing universal 1024px AppIcon catalog entry remains in place.
- The 16px and 32px favicons use their separately simplified approved SVGs.
  The SVG favicon uses the 32px design.
- All Android and iOS Capacitor splash PNGs show the approved tile centered on
  `#fafafa`. Existing Android dimensions and iOS catalog mappings are retained.

`icons:verify` checks every generated PNG's dimensions, opacity for maskable,
Apple and splash assets, visible pixels against Android's circular safe zone,
and every built manifest icon (including shortcuts) and favicon/touch link.

The in-app header, Home, sport screens, and palette tokens are outside this
asset change.
