/* Badminton — rally point to target, win-by-2, hard cap at target+9, best-of-N games.
   Serve follows the rally winner; court side (right/left) comes from the server's own
   score parity. Reducers only see (snap, cfg, payload) — no team names — so labels/
   summaries carry a generic "Side N" fallback; renderScorer/renderSpectator use the
   real match.teams names for display. */
(function () {
  'use strict';
  var h = SE.h;

  /* ---------- pure rule helpers ---------- */
  function targetCap(cfg) {
    var target = cfg.target || 21;
    return { target: target, cap: target + 9 };
  }

  // first to target with a 2-point lead wins; sudden death at the hard cap
  function gameWinner(a, b, target, cap) {
    if (a >= target && a - b >= 2) return 0;
    if (b >= target && b - a >= 2) return 1;
    if (a >= cap) return 0;
    if (b >= cap) return 1;
    return null;
  }

  function gamesNeeded(cfg) { return Math.ceil((cfg.games || 3) / 2); }

  function gamesWon(snap) {
    var wins = [0, 0];
    snap.games.forEach(function (g) { wins[g.winner] += 1; });
    return wins;
  }

  // { gameSide, matchSide, contested } — contested = both sides one point from winning
  // (only possible at the hard-cap sudden-death edge, e.g. 29–29 to 30)
  function pointStatus(snap, cfg) {
    var tc = targetCap(cfg), target = tc.target, cap = tc.cap;
    var need = gamesNeeded(cfg);
    var wins = gamesWon(snap);
    var candidates = [];
    [0, 1].forEach(function (side) {
      var other = side === 0 ? 1 : 0;
      var s = snap.scores[side], o = snap.scores[other];
      var wouldWin = (s + 1 >= target && (s + 1) - o >= 2) || (s + 1 >= cap);
      if (wouldWin) candidates.push(side);
    });
    var contested = candidates.length === 2;
    var gameSide = candidates.length === 1 ? candidates[0] : null;
    var matchSide = gameSide != null && wins[gameSide] + 1 >= need ? gameSide : null;
    return { gameSide: gameSide, matchSide: matchSide, contested: contested, wins: wins, need: need };
  }

  function serveCourt(snap) { return snap.scores[snap.serve] % 2 === 0 ? 'RIGHT' : 'LEFT'; }

  function bannerText(st, teams) {
    if (st.matchSide != null) return 'MATCH POINT' + (teams ? ' · ' + teams[st.matchSide].name.toUpperCase() : '');
    if (st.gameSide != null) return 'GAME POINT' + (teams ? ' · ' + teams[st.gameSide].name.toUpperCase() : '');
    if (st.contested) return 'GAME POINT';
    return null;
  }

  /* ---------- sport def ---------- */
  SE.registerSport({
    key: 'badminton', label: 'Badminton', icon: '🏸', priority: 2,
    tagline: 'rally to 21',
    sampleTeams: ['Priya', 'Meera'],

    defaultConfig: { games: 3, target: 21 },
    setupFields: [
      { key: 'games', label: 'Best of', type: 'choice', options: [{ label: '1', value: 1 }, { label: '3', value: 3 }] },
      { key: 'target', label: 'Points', type: 'choice', options: [{ label: '21', value: 21 }, { label: '15', value: 15 }, { label: '11', value: 11 }] },
    ],

    init: function (config) {
      return { scores: [0, 0], games: [], serve: 0 };
    },

    actions: {
      // payload: { side: 0|1, name: <team name, for the event label only> }
      point: function (snap, cfg, payload) {
        var side = payload.side;
        var tc = targetCap(cfg);
        var scores = snap.scores.slice();
        scores[side] += 1;
        var winner = gameWinner(scores[0], scores[1], tc.target, tc.cap);
        var games = snap.games.slice();
        var next;
        if (winner != null) {
          games.push({ scores: scores, winner: winner });
          next = { scores: [0, 0], games: games, serve: winner };
        } else {
          next = { scores: scores, games: games, serve: side };
        }
        var who = payload.name || ('Side ' + (side + 1));
        return { snap: next, label: who + ' +1' + (winner != null ? ' · game ' + games.length + ' won' : '') };
      },
    },

    isOver: function (snap, cfg) {
      var need = gamesNeeded(cfg);
      var wins = gamesWon(snap);
      if (wins[0] < need && wins[1] < need) return null;
      var winnerIndex = wins[0] >= need ? 0 : 1;
      var loserIndex = winnerIndex === 0 ? 1 : 0;
      return {
        summary: 'Side ' + (winnerIndex + 1) + ' won ' + wins[winnerIndex] + '–' + wins[loserIndex],
        winnerIndex: winnerIndex,
        games: wins,
      };
    },

    headline: function (m) {
      var snap = m.snapshot, cfg = m.config;
      var st = pointStatus(snap, cfg);
      var tag = st.matchSide != null ? 'match point' : (st.gameSide != null || st.contested ? 'game point' : '');
      return snap.scores[0] + '–' + snap.scores[1] + ' · game ' + (snap.games.length + 1) + (tag ? ' · ' + tag : '');
    },

    renderScorer: function (el, match, api) {
      var snap = match.snapshot, cfg = match.config, teams = match.teams;
      var tc = targetCap(cfg);
      var st = pointStatus(snap, cfg);
      var gameNum = snap.games.length + 1;
      var lastGame = snap.games.length ? snap.games[snap.games.length - 1] : null;
      var sub = 'GAME ' + gameNum + (lastGame ? ' · G' + snap.games.length + ' ' + lastGame.scores[0] + '–' + lastGame.scores[1] + ' ' + teams[lastGame.winner].name.toUpperCase() : '');
      var banner = bannerText(st, teams);

      function tapPanel(idx) {
        var serving = snap.serve === idx;
        return h('div', {
          class: 'tapzone' + (serving ? ' leading' : ''),
          style: 'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:26px 8px',
          onclick: function () { api.dispatch('point', { side: idx, name: teams[idx].name }); },
        },
          h('span', { class: 'mono row', style: 'font-size:10px;letter-spacing:.14em;color:var(--ink-muted);gap:6px' },
            serving ? h('span', { style: 'width:7px;height:7px;border-radius:50%;background:var(--accent);animation:se-pulse 1.2s infinite' }) : null,
            teams[idx].name.toUpperCase()
          ),
          h('span', { class: 'bignum', style: 'font-size:76px' }, String(snap.scores[idx])),
          h('span', { style: 'font-size:10px;font-weight:600;color:var(--ink-faint)' }, serving ? 'serving · tap +1' : 'tap +1')
        );
      }

      el.appendChild(h('div', { class: 'screen' },
        SE.topbar({
          title: teams[0].name + ' vs ' + teams[1].name, sub: sub, back: '#/home',
          right: h('a', { class: 'chip', href: '#/watch/' + match.id }, '👁'),
        }),
        banner ? h('div', { class: 'banner' + (st.matchSide != null ? ' hot' : '') }, banner) : null,
        h('div', { class: 'row', style: 'flex:1;gap:10px' }, tapPanel(0), tapPanel(1)),
        h('div', { class: 'center mono muted', style: 'font-size:10px' },
          'SERVE FROM ' + serveCourt(snap) + ' COURT (' + (snap.scores[snap.serve] % 2 === 0 ? 'even' : 'odd') + ') · TO ' + tc.target + ' · CAP ' + tc.cap
        ),
        snap.games.length ? h('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap' },
          snap.games.map(function (g, i) { return h('span', { class: 'chip' }, 'G' + (i + 1) + ' ' + g.scores[0] + '–' + g.scores[1]); })
        ) : null,
        h('button', { class: 'btn ghost block', onclick: function () { api.undo(); } }, '↩ Undo')
      ));
    },

    renderSpectator: function (el, match) {
      var snap = match.snapshot, cfg = match.config, teams = match.teams;
      var st = pointStatus(snap, cfg);
      var lastGame = snap.games.length ? snap.games[snap.games.length - 1] : null;
      var banner = bannerText(st, teams);
      var recent = match.events.slice(-10);

      el.appendChild(h('div', { class: 'screen' },
        SE.topbar({
          title: teams[0].name + ' vs ' + teams[1].name,
          sub: (match.status === 'live' ? 'LIVE · ' : '') + 'GAME ' + (snap.games.length + 1),
          back: '#/home',
        }),
        h('div', { style: 'background:var(--ink);color:#fff;border-radius:18px;padding:12px 14px' },
          h('div', { class: 'row' },
            h('div', null,
              h('div', { style: 'font-size:10px;color:rgba(255,255,255,.6);font-weight:600' }, teams[0].name.toUpperCase()),
              h('div', { class: 'bignum', style: 'font-size:28px' }, String(snap.scores[0]))
            ),
            h('div', { class: 'grow center' },
              h('div', { class: 'mono', style: 'font-size:10px;letter-spacing:.1em;color:rgba(255,255,255,.5)' }, 'GAME ' + (snap.games.length + 1)),
              lastGame ? h('div', { class: 'mono', style: 'font-size:9px;color:rgba(255,255,255,.5);margin-top:3px' }, 'G' + snap.games.length + ' ' + lastGame.scores[0] + '–' + lastGame.scores[1] + ' ' + teams[lastGame.winner].name.toUpperCase()) : null
            ),
            h('div', { style: 'text-align:right' },
              h('div', { style: 'font-size:10px;color:rgba(255,255,255,.6);font-weight:600' }, teams[1].name.toUpperCase()),
              h('div', { class: 'bignum', style: 'font-size:28px' }, String(snap.scores[1]))
            )
          ),
          banner ? h('div', { class: 'mono', style: 'margin-top:7px;text-align:center;font-size:10px;letter-spacing:.16em;color:#3fd598' }, banner) : null
        ),
        recent.length ? h('div', { class: 'row' },
          h('span', { class: 'microlabel' }, 'RALLY FEED'),
          h('span', { class: 'spacer' }),
          h('span', { class: 'mono muted', style: 'font-size:10px' }, recent.length + ' shown')
        ) : null,
        recent.length ? h('div', { class: 'row', style: 'gap:5px;flex-wrap:wrap' },
          recent.map(function (ev, i) {
            var side = ev.payload && ev.payload.side === 1 ? 1 : 0;
            var last = i === recent.length - 1;
            return h('span', {
              style: 'width:19px;height:19px;border-radius:50%;background:' + (side === 0 ? 'var(--amber)' : 'var(--accent)') +
                (last ? ';animation:se-pulse 1.2s infinite' : ''),
            });
          })
        ) : null,
        h('div', { style: 'display:flex;flex-direction:column;gap:8px' },
          recent.slice(-5).reverse().map(function (ev) {
            return h('div', { class: 'card row', style: 'padding:9px 12px' },
              h('span', { class: 'mono muted', style: 'font-size:9px' }, snap.scores[0] + '–' + snap.scores[1]),
              h('span', { style: 'font-size:12px' }, ev.label)
            );
          })
        )
      ));
    },
  });
})();
