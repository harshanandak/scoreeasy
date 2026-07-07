/* Badminton — rally point to target, win-by-2, hard cap at target+9, best-of-N games.
   Serve follows the rally winner; court side (right/left) comes from the server's own
   score parity. Reducers only see (snap, cfg, payload) — no team names — so labels/
   summaries carry a generic "Side N" fallback; renderScorer/renderSpectator use the
   real match.teams names for display. Scorer/spectator are 1:1 ports of reference
   fragments 5f/6f (clean instrument), styled to match the volleyball exemplar. */
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

  /* ---------- reducers ---------- */

  // payload: { side: 0|1, name: <team name, for the event label only> }
  function point(snap, cfg, payload) {
    var side = payload.side;
    var tc = targetCap(cfg);
    var scores = snap.scores.slice();
    scores[side] += 1;
    var winner = gameWinner(scores[0], scores[1], tc.target, tc.cap);
    var games = snap.games.slice();
    var next;
    if (winner != null) {
      games.push({ scores: scores, winner: winner });
      next = { scores: [0, 0], games: games, serve: winner, swapped: snap.swapped };
    } else {
      next = { scores: scores, games: games, serve: side, swapped: snap.swapped };
    }
    var who = payload.name || ('Side ' + (side + 1));
    return { snap: next, label: who + ' +1' + (winner != null ? ' · game ' + games.length + ' won' : '') };
  }

  // manual game close (time-capped schoolyard games): leader takes the game as-is
  function endGame(snap, cfg, payload) {
    if (snap.scores[0] === snap.scores[1]) return { snap: snap, label: 'Game tied — play it out' };
    var leader = snap.scores[0] > snap.scores[1] ? 0 : 1;
    var games = snap.games.concat([{ scores: snap.scores, winner: leader }]);
    return {
      snap: { scores: [0, 0], games: games, serve: leader, swapped: snap.swapped },
      label: 'Game ' + games.length + ' ended early · ' + ((payload && payload.names) ? payload.names[leader] : 'Side ' + (leader + 1)) + ' takes it',
    };
  }

  function swapEnds(snap) {
    var next = Object.assign({}, snap, { swapped: !snap.swapped });
    return { snap: next, label: '⇄ Ends swapped' };
  }

  function noop(label) {
    return function (snap, cfg, payload) {
      return { snap: snap, label: (payload && payload.label) || label };
    };
  }

  var ACTIONS = {
    point: point,
    endGame: endGame,
    swapEnds: swapEnds,
    shuttle: noop('Shuttle changed'),
    injury: noop('Injury timeout'),
    serviceCall: noop('Service call reviewed'),
  };

  // replay events, keeping only the rally feed for the game still in progress
  function currentGameActivity(match) {
    var snap = { scores: [0, 0], games: [], serve: 0, swapped: false };
    var rallies = [];
    match.events.forEach(function (ev) {
      var fn = ACTIONS[ev.action];
      if (!fn) return;
      var beforeGames = snap.games.length;
      snap = fn(snap, match.config, ev.payload).snap;
      if (snap.games.length !== beforeGames) { rallies = []; return; }
      if (ev.action !== 'point' || !ev.payload) return;
      rallies.push({ side: ev.payload.side, score: snap.scores[0] + '–' + snap.scores[1], label: ev.label });
    });
    return rallies;
  }

  // last up to 10 rallies + which side leads them + the longest same-side scoring run
  // this game so far (stands in for the fragment's "longest rally" stat — we don't
  // track shot counts per rally, only which side won each point)
  function last10Summary(rallies) {
    var last = rallies.slice(-10);
    var count = [0, 0];
    last.forEach(function (r) { count[r.side] += 1; });
    var leadSide = count[0] >= count[1] ? 0 : 1;
    var runs = [];
    rallies.forEach(function (r, i) {
      if (runs.length && runs[runs.length - 1].side === r.side) runs[runs.length - 1].count += 1;
      else runs.push({ side: r.side, count: 1 });
      runs[runs.length - 1].lastIndex = i;
    });
    var longest = runs.reduce(function (m, r) { return r.count > m.count ? r : m; }, { side: 0, count: 0, lastIndex: -1 });
    return { last: last, leadSide: leadSide, leadCount: count[leadSide], longest: longest };
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
      return { scores: [0, 0], games: [], serve: 0, swapped: false };
    },

    actions: ACTIONS,

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

    /* ---------- scorer: 1:1 port of fragment 5f ---------- */
    renderScorer: function (el, match, api) {
      var snap = match.snapshot, cfg = match.config, teams = match.teams;
      var tc = targetCap(cfg);
      var st = pointStatus(snap, cfg);
      var gameNum = snap.games.length + 1;
      var lastGame = snap.games.length ? snap.games[snap.games.length - 1] : null;
      var sub = 'GAME ' + gameNum + (lastGame ? ' · G' + snap.games.length + ' ' + lastGame.scores[0] + '–' + lastGame.scores[1] + ' ' + teams[lastGame.winner].name.toUpperCase() : '');
      var banner = bannerText(st, teams);
      var court = serveCourt(snap);
      var parity = snap.scores[snap.serve] % 2 === 0 ? 'even' : 'odd';
      var intervalReached = Math.max(snap.scores[0], snap.scores[1]) >= Math.ceil(tc.target / 2);

      // fragment 5f's keyframes (geP serve pulse, geGlow banner glow)
      var kf = h('style', { html:
        '@keyframes geP{0%,100%{opacity:1}50%{opacity:.35}}' +
        '@keyframes geGlow{0%,100%{box-shadow:0 8px 16px -10px rgba(18,147,106,.7)}50%{box-shadow:0 8px 22px -8px rgba(18,147,106,.95)}}'
      });

      function iconBtn(content, onclick, size) {
        return h('div', {
          style: 'width:32px;height:32px;border-radius:11px;background:#fff;box-shadow:0 1px 2px rgba(20,40,30,.08);display:flex;align-items:center;justify-content:center;font-size:' + (size || 16) + 'px' + (onclick ? ';cursor:pointer' : ''),
          onclick: onclick,
        }, content);
      }

      var order = snap.swapped ? [1, 0] : [0, 1];

      // one big score half — exact styles from the fragment
      function half(idx) {
        var serving = snap.serve === idx;
        return h('div', {
          style: 'flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;cursor:pointer;-webkit-tap-highlight-color:transparent;user-select:none;'
            + (idx === order[0] ? 'border-right:1px solid rgba(20,32,26,.1);' : '')
            + (serving ? 'background:linear-gradient(180deg,rgba(18,147,106,.07),rgba(18,147,106,0));' : ''),
          onclick: function () { api.dispatch('point', { side: idx, name: teams[idx].name }); },
        },
          h('span', { style: 'display:inline-flex;align-items:center;gap:6px;font-family:\'DM Mono\',monospace;font-size:10px;letter-spacing:.14em;color:#6b7a72' },
            serving ? h('span', { style: 'width:7px;height:7px;border-radius:50%;background:#12936a;animation:geP 1.2s infinite' }) : null,
            teams[idx].name.toUpperCase()
          ),
          h('span', { style: 'font-family:\'DM Mono\',monospace;font-size:84px;font-weight:500;line-height:1;font-variant-numeric:tabular-nums' }, String(snap.scores[idx])),
          h('span', { style: 'width:44px;height:3px;background:' + (serving ? '#12936a' : 'transparent') + ';border-radius:2px' }),
          h('span', { style: 'font-size:10px;font-weight:600;color:#9aa8a0' }, serving ? 'serving · tap +1' : 'tap +1')
        );
      }

      function pill(label, onclick) {
        return h('div', {
          style: 'flex:1;height:36px;border-radius:12px;border:1.5px solid #e4e9e5;background:#fff;display:flex;align-items:center;justify-content:center;font-size:11.5px;font-weight:600;color:#46554d;cursor:pointer;user-select:none',
          onclick: onclick,
        }, label);
      }

      el.appendChild(h('div', { style: 'flex:1;display:flex;flex-direction:column;background:#f4f6f3;color:#14201a' },
        kf,
        // header: back · title/sub · rally history
        h('div', { style: 'flex:none;display:flex;align-items:center;justify-content:space-between;padding:12px 13px 8px' },
          iconBtn('‹', function () { api.nav('#/home'); }),
          h('div', { style: 'text-align:center' },
            h('div', { style: 'font-size:13px;font-weight:700' }, teams[0].name + ' vs ' + teams[1].name),
            h('div', { style: 'font-family:\'DM Mono\',monospace;font-size:9px;letter-spacing:.08em;color:#6b7a72;margin-top:1px' }, sub)
          ),
          iconBtn('≣', function () { api.nav('#/watch/' + match.id); }, 13)
        ),
        // game/match point banner
        banner ? h('div', { style: 'flex:none;margin:0 13px;background:' + (st.matchSide != null ? '#0d6b4e' : '#12936a') + ';color:#fff;text-align:center;padding:8px 0;border-radius:12px;font-family:\'DM Mono\',monospace;font-size:11px;letter-spacing:.16em;box-shadow:0 8px 16px -10px rgba(18,147,106,.7);animation:geGlow 1.8s infinite' }, banner) : null,
        // the two giant tap halves
        h('div', { style: 'flex:1;min-height:0;display:flex;border-bottom:1px solid rgba(20,32,26,.1);margin-top:' + (banner ? '8px' : '0') },
          half(order[0]), half(order[1])
        ),
        // serve court · interval · target/cap row
        h('div', { style: 'flex:none;display:flex;align-items:center;justify-content:center;gap:12px;padding:8px 14px 0;font-family:\'DM Mono\',monospace;font-size:10px;color:#9aa8a0;flex-wrap:wrap' },
          h('span', null, 'SERVE FROM ', h('span', { style: 'color:#14201a;font-weight:500' }, court + ' COURT'), ' (' + parity + ')'),
          h('span', { style: 'color:#dfe7e1' }, '|'),
          intervalReached ? h('span', { style: 'color:#12936a' }, 'INTERVAL ✓') : h('span', null, 'NO INTERVAL YET'),
          h('span', { style: 'color:#dfe7e1' }, '|'),
          h('span', null, 'TO ' + tc.target + ' · CAP ' + tc.cap)
        ),
        // action pills: Ends · Shuttle · Injury · Service
        h('div', { style: 'flex:none;display:flex;gap:7px;padding:8px 13px 0' },
          pill('⇄ Ends', function () { api.dispatch('swapEnds'); }),
          pill('Shuttle +1', function () { api.dispatch('shuttle'); }),
          pill('Injury', function () { api.dispatch('injury'); }),
          pill('Service ?', function () { api.dispatch('serviceCall'); })
        ),
        // undo + end game
        h('div', { style: 'flex:none;display:flex;gap:7px;padding:8px 13px 0' },
          h('div', { style: 'width:64px;height:44px;border-radius:14px;background:#eef1ee;display:flex;align-items:center;justify-content:center;font-size:16px;color:#46554d;cursor:pointer', onclick: function () { api.undo(); } }, '↩'),
          h('div', { style: 'flex:1;height:44px;border-radius:14px;background:#12936a;color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;box-shadow:0 10px 18px -10px rgba(18,147,106,.7);cursor:pointer', onclick: function () { api.dispatch('endGame', { names: [teams[0].name, teams[1].name] }); } }, 'End game ✓')
        ),
        // footer: rally history link · share live
        h('div', { style: 'flex:none;display:flex;align-items:center;justify-content:space-between;padding:7px 15px calc(10px + env(safe-area-inset-bottom));font-size:11px;font-weight:700;color:#12936a' },
          h('span', { style: 'cursor:pointer', onclick: function () { api.nav('#/watch/' + match.id); } }, 'Rally history ›'),
          h('span', { style: 'color:#6b7a72;font-weight:600;cursor:pointer', onclick: function () { api.nav('#/watch/' + match.id); } },
            '👁 ' + (3 + match.events.length % 9) + ' · Share live ', h('span', { style: 'color:#12936a' }, '↗'))
        )
      ));
    },

    /* ---------- spectator: 1:1 port of fragment 6f ---------- */
    renderSpectator: function (el, match) {
      var snap = match.snapshot, cfg = match.config, teams = match.teams;
      var st = pointStatus(snap, cfg);
      var lastGame = snap.games.length ? snap.games[snap.games.length - 1] : null;
      var banner = bannerText(st, teams);
      var rallies = currentGameActivity(match);
      var summary = last10Summary(rallies);
      var live = match.status === 'live';

      var kf = h('style', { html:
        '@keyframes geP{0%,100%{opacity:1}50%{opacity:.35}}' +
        '@keyframes geGlow{0%,100%{box-shadow:0 8px 16px -10px rgba(18,147,106,.7)}50%{box-shadow:0 8px 22px -8px rgba(18,147,106,.95)}}'
      });

      function iconBtn(content, onclick, size, color) {
        return h('div', {
          style: 'width:32px;height:32px;border-radius:11px;background:#fff;box-shadow:0 1px 2px rgba(20,40,30,.08);display:flex;align-items:center;justify-content:center;font-size:' + (size || 16) + 'px' + (color ? ';color:' + color : '') + (onclick ? ';cursor:pointer' : ''),
          onclick: onclick,
        }, content);
      }

      // decorative segmented control — this build only has the "Live" view, so
      // Scorecard/Graphs render inactive rather than link to screens that don't exist
      function tab(label, active) {
        return h('span', {
          style: 'flex:1;text-align:center;padding:6px 0;border-radius:10px;font-size:11.5px;font-weight:' + (active ? '700' : '600')
            + (active ? ';background:#fff;box-shadow:0 1px 2px rgba(20,40,30,.08)' : ';color:#9aa8a0'),
        }, label);
      }

      el.appendChild(h('div', { style: 'flex:1;display:flex;flex-direction:column;background:#f4f6f3;color:#14201a' },
        kf,
        // header: back · title + live badge · share
        h('div', { style: 'flex:none;display:flex;align-items:center;justify-content:space-between;padding:12px 13px 8px' },
          iconBtn('‹', function () { SE.nav('#/home'); }),
          h('div', { style: 'display:flex;align-items:center;gap:7px' },
            h('span', { style: 'font-size:13px;font-weight:700' }, teams[0].name + ' vs ' + teams[1].name),
            live
              ? h('span', { style: 'display:inline-flex;align-items:center;gap:4px;font-size:9px;font-weight:700;color:#d64f43' },
                  h('span', { style: 'width:5px;height:5px;border-radius:50%;background:#d64f43;animation:geP 1.4s infinite' }), 'LIVE')
              : h('span', { style: 'font-size:9px;font-weight:700;color:#6b7a72' }, 'FINAL')
          ),
          iconBtn('↗', null, 13, '#12936a')
        ),
        // Live / Scorecard / Graphs segmented control
        h('div', { style: 'flex:none;display:flex;background:#e7ece8;border-radius:12px;padding:2px;margin:0 13px' },
          tab('Live', true), tab('Scorecard', false), tab('Graphs', false)
        ),
        h('div', { style: 'flex:1;min-height:0;display:flex;flex-direction:column;padding:8px 13px 0;gap:8px;overflow:auto' },
          // score card
          h('div', { style: 'background:#14201a;color:#fff;border-radius:18px;padding:12px 14px' },
            h('div', { style: 'display:flex;align-items:center;justify-content:space-between' },
              h('div', null,
                h('div', { style: 'font-size:10px;color:rgba(255,255,255,.6);font-weight:600' }, teams[0].name.toUpperCase()),
                h('div', { style: 'font-family:\'DM Mono\',monospace;font-size:28px;font-weight:500;color:' + (snap.serve === 0 ? '#3fd598' : '#fff') }, String(snap.scores[0]))
              ),
              h('div', { style: 'text-align:center' },
                h('div', { style: 'font-family:\'DM Mono\',monospace;font-size:10px;letter-spacing:.1em;color:rgba(255,255,255,.5)' }, 'GAME ' + (snap.games.length + 1)),
                h('div', { style: 'font-family:\'DM Mono\',monospace;font-size:9px;color:rgba(255,255,255,.5);margin-top:3px' },
                  lastGame ? 'G' + snap.games.length + ' ' + lastGame.scores[0] + '–' + lastGame.scores[1] + ' ' + teams[lastGame.winner].name.toUpperCase() : '—')
              ),
              h('div', { style: 'text-align:right' },
                h('div', { style: 'font-size:10px;color:rgba(255,255,255,.6);font-weight:600' },
                  teams[1].name.toUpperCase(), snap.serve === 1 ? h('span', { style: 'display:inline-block;width:5px;height:5px;border-radius:50%;background:#3fd598;margin-left:3px' }) : null),
                h('div', { style: 'font-family:\'DM Mono\',monospace;font-size:28px;font-weight:500;color:' + (snap.serve === 1 ? '#3fd598' : '#fff') }, String(snap.scores[1]))
              )
            ),
            banner ? h('div', { style: 'margin-top:7px;text-align:center;font-family:\'DM Mono\',monospace;font-size:10px;letter-spacing:.16em;color:#3fd598;animation:geGlow 1.6s infinite' }, banner) : null
          ),
          // last 10 rallies
          h('div', { style: 'display:flex;align-items:center;justify-content:space-between' },
            h('span', { style: 'font-size:11px;font-weight:700;letter-spacing:.06em;color:#9aa8a0;text-transform:uppercase' }, 'Last 10 rallies'),
            summary.last.length ? h('span', { style: 'font-family:\'DM Mono\',monospace;font-size:10px;color:#12936a' }, teams[summary.leadSide].name.toUpperCase() + ' ' + summary.leadCount + ' OF ' + summary.last.length) : null
          ),
          summary.last.length ? h('div', { style: 'display:flex;gap:5px;flex-wrap:wrap' },
            summary.last.map(function (r, i) {
              var offset = rallies.length - summary.last.length;
              var idx = offset + i;
              var color = r.side === summary.leadSide ? '#12936a' : '#b8862e';
              var isLongest = idx === summary.longest.lastIndex && summary.longest.count > 1;
              var isLast = idx === rallies.length - 1;
              if (isLongest) {
                return h('span', { style: 'width:19px;height:19px;border-radius:50%;background:' + color + ';color:#fff;font-family:\'DM Mono\',monospace;font-size:8px;display:inline-flex;align-items:center;justify-content:center' }, String(summary.longest.count));
              }
              return h('span', { style: 'width:19px;height:19px;border-radius:50%;background:' + color + (isLast && live ? ';animation:geP 1.4s infinite' : '') });
            })
          ) : h('div', { style: 'font-size:12px;color:#9aa8a0' }, 'No rallies yet this game'),
          summary.last.length ? h('div', { style: 'display:flex;justify-content:space-between;font-family:\'DM Mono\',monospace;font-size:8px;color:#b3bdb6' },
            h('span', { style: 'color:#12936a' }, '● ' + teams[summary.leadSide].name.toUpperCase()),
            h('span', null, summary.longest.count + ' = LONGEST RUN'),
            h('span', { style: 'color:#b8862e' }, '● ' + teams[1 - summary.leadSide].name.toUpperCase())
          ) : null,
          // key moments
          h('div', null, h('span', { style: 'font-size:11px;font-weight:700;letter-spacing:.06em;color:#9aa8a0;text-transform:uppercase' }, 'Key moments')),
          rallies.length
            ? rallies.slice(-2).reverse().map(function (r, i) {
                return h('div', { style: 'background:#fff;border-radius:13px;padding:9px 12px;box-shadow:0 1px 3px rgba(20,40,30,.06);display:flex;gap:9px;align-items:center' + (i === 1 ? ';opacity:.65' : '') },
                  h('span', { style: 'font-family:\'DM Mono\',monospace;font-size:9px;color:#9aa8a0;width:30px;flex:none' }, r.score),
                  h('span', { style: 'font-size:12px' }, r.label)
                );
              })
            : h('div', { style: 'font-size:12px;color:#9aa8a0' }, 'No key moments yet'),
          h('div', { style: 'flex:1' })
        ),
        // footer: viewers · reactions · follow
        h('div', { style: 'flex:none;display:flex;align-items:center;gap:8px;padding:8px 13px calc(14px + env(safe-area-inset-bottom))' },
          h('span', { style: 'font-size:10px;color:#9aa8a0;font-weight:600;flex:none' }, '👁 ' + (3 + match.events.length % 9)),
          h('div', { style: 'flex:1;display:flex;gap:6px' },
            h('span', { style: 'background:#fff;border-radius:99px;padding:6px 12px;font-size:12px;box-shadow:0 1px 3px rgba(20,40,30,.08)' }, '🔥 ', h('span', { style: 'font-family:\'DM Mono\',monospace;font-size:10px;color:#6b7a72' }, String(summary.longest.count || 0))),
            h('span', { style: 'background:#fff;border-radius:99px;padding:6px 12px;font-size:12px;box-shadow:0 1px 3px rgba(20,40,30,.08)' }, '👏 ', h('span', { style: 'font-family:\'DM Mono\',monospace;font-size:10px;color:#6b7a72' }, String(rallies.length)))
          ),
          h('span', { style: 'background:#12936a;color:#fff;border-radius:99px;padding:6px 14px;font-size:11px;font-weight:700;flex:none' }, 'Following ✓')
        ),
        match.status === 'done' && match.result ? h('div', { style: 'flex:none;margin:0 13px 10px;padding:10px;text-align:center;font-size:12px;font-weight:700;color:#0d6b4e;background:#e6f3ee;border-radius:12px' }, match.result.summary) : null
      ));
    },
  });
})();
