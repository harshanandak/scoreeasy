# Home v2 evidence (2026-11-09)

Real app, not a mock. `bun run build` of this branch and of `origin/master` 818b16a, each served with
`vite preview`, captured in the T3 integrated browser (light theme) as a guest, with localStorage seeded
per state. Both builds used the same local app config.

States:

- `first`: nothing saved.
- `inprog`: 2 matches in progress (volleyball Royals 1 v Strikers 12-9, kabaddi Royals 2 v Strikers 12-9), 0 finished.
- `mixed`: the same 2 in progress plus 3 finished (volleyball 3-1, cricket 164/6 v 158/9, kabaddi 38-31).
- `*-recent-*`: the `mixed` screen scrolled to the Recent section.

Sizes: 390x844 and 360x640. `before-first-*` and `after-first-*` should look the same (first run is unchanged).
Not captured: dark theme (the app has no dark theme), a signed-in Home.
