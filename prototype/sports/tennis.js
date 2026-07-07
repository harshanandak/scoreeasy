/* Tennis: sets → games → points, 0/15/30/40 with deuce/advantage, 7-point
   tiebreak at 6–6. Scorer/spectator are 1:1 ports of reference fragments
   prototype/reference/screens/5g-tennis-scorer-refined.html and
   6g-spectator-tennis-refined.html (FIDELITY V2). */
(function () {
  'use strict';
  var h = SE.h;
  var NAMES = ['0', '15', '30', '40'];

  // module-level UI-only state for the spectator's tab strip + follow pill —
  // never touches the match store, just re-renders via SE.render()
  var spectatorTab = 'live';
  var following = true;

  var KF = '@keyframes geP{0%,100%{opacity:1}50%{opacity:.35}}' +
    '@keyframes geGlow{0%,100%{box-shadow:0 8px 16px -10px rgba(18,147,106,.7)}50%{box-shadow:0 8px 22px -8px rgba(18,147,106,.95)}}';

  /* ---------- score display helpers ---------- */
  function pointLabel(points, side) {
    var mine = points[side], theirs = points[1 - side];
    if (mine < 4) return NAMES[mine];
    if (mine === theirs) return '40'; // deuce — both sides show 40
    return mine > theirs ? 'AD' : '40';
  }

  function setWins(snap) {
    var wins = [0, 0];
    snap.sets.forEach(function (s) { if (s[0] > s[1]) wins[0]++; else wins[1]++; });
    return wins;
  }

  function wouldWinGame(points, i) {
    var mine = points[i] + 1, theirs = points[1 - i];
    return mine >= 4 && (mine - theirs) >= 2;
  }
  function wouldWinTB(points, i) {
    var mine = points[i] + 1, theirs = points[1 - i];
    return mine >= 7 && (mine - theirs) >= 2;
  }

  // BREAK POINT / SET POINT / MATCH POINT — one point away from ending the
  // game, escalated up through set/match. Needs team names, so it lives here
  // (renderScorer/renderSpectator) rather than in the pure isOver/actions.
  function bannerFor(m) {
    var snap = m.snapshot, cfg = m.config;
    var decisive = -1, i;
    for (i = 0; i < 2; i++) {
      if (snap.tiebreak ? wouldWinTB(snap.points, i) : wouldWinGame(snap.points, i)) { decisive = i; break; }
    }
    if (decisive === -1) return null;
    var other = 1 - decisive;
    var hypGames = [snap.games[0], snap.games[1]];
    hypGames[decisive] = snap.games[decisive] + 1;
    var setWon = snap.tiebreak ? true : (hypGames[decisive] >= 6 && (hypGames[decisive] - hypGames[other]) >= 2);
    var name = m.teams[decisive].name.toUpperCase();
    if (setWon) {
      var hypSets = snap.sets.map(function (s) { return [s[0], s[1]]; });
      hypSets.push([hypGames[0], hypGames[1]]);
      var wins = [0, 0];
      hypSets.forEach(function (s) { if (s[0] > s[1]) wins[0]++; else wins[1]++; });
      var needed = Math.ceil((cfg.sets || 3) / 2);
      if (wins[decisive] >= needed) return { text: 'MATCH POINT · ' + name, kind: 'match', leaderIdx: decisive };
      return { text: 'SET POINT · ' + name, kind: 'set', leaderIdx: decisive };
    }
    if (!snap.tiebreak && decisive !== snap.server) return { text: 'BREAK POINT · ' + name, kind: 'break', leaderIdx: decisive };
    return null; // plain game point for the server — fragment doesn't call this out
  }

  /* ---------- pure reducers ---------- */

  function cloneSnap(snap) {
    return {
      sets: snap.sets.map(function (x) { return [x[0], x[1]]; }),
      games: [snap.games[0], snap.games[1]],
      points: [snap.points[0], snap.points[1]],
      tiebreak: snap.tiebreak, tbCount: snap.tbCount, server: snap.server,
    };
  }

  // team i has just taken the current game/tiebreak outright — advance
  // games/sets/server accordingly and return the event label. Shared by the
  // normal point-by-point win path and the manual "End game" override.
  function winStage(s, i) {
    var o = 1 - i;
    if (s.tiebreak) {
      var winnerGames = s.games[i] + 1, loserGames = s.games[o];
      s.sets.push(i === 0 ? [winnerGames, loserGames] : [loserGames, winnerGames]);
      s.games = [0, 0]; s.points = [0, 0]; s.tiebreak = false; s.tbCount = 0;
      s.server = 1 - s.server;
      return 'Tiebreak to P' + (i + 1);
    }
    var isBreak = (i !== s.server);
    s.games[i]++; s.points = [0, 0]; s.server = 1 - s.server;
    if (s.games[i] >= 6 && (s.games[i] - s.games[o]) >= 2) {
      s.sets.push([s.games[0], s.games[1]]); s.games = [0, 0];
      return (isBreak ? 'Break! ' : '') + 'Set to P' + (i + 1);
    } else if (s.games[0] === 6 && s.games[1] === 6) {
      s.tiebreak = true; s.tbCount = 0; s.points = [0, 0];
      return 'Tiebreak';
    }
    return (isBreak ? 'Break! ' : '') + 'Game to P' + (i + 1);
  }

  function point(snap, cfg, payload) {
    var s = cloneSnap(snap);
    var i = payload, o = 1 - i, label;
    if (s.tiebreak) {
      s.points[i]++; s.tbCount++;
      if (s.points[i] >= 7 && (s.points[i] - s.points[o]) >= 2) {
        label = winStage(s, i);
      } else {
        if (s.tbCount % 2 === 1) s.server = 1 - s.server; // switch after pt 1, then every 2
        label = 'P' + (i + 1) + ' point';
      }
    } else {
      s.points[i]++;
      if (s.points[i] >= 4 && (s.points[i] - s.points[o]) >= 2) {
        label = winStage(s, i);
      } else {
        label = 'P' + (i + 1) + ' point';
      }
    }
    return { snap: s, label: label };
  }

  // manual "End game ✓": current leader (by points) takes the game/tiebreak
  // as-is — the escape hatch for a stuck deuce, mirroring volleyball's endSet.
  function endGame(snap, cfg, payload) {
    if (snap.points[0] === snap.points[1]) {
      return { snap: snap, label: (snap.tiebreak ? 'Tiebreak' : 'Game') + ' tied — play it out' };
    }
    var s = cloneSnap(snap);
    var i = snap.points[0] > snap.points[1] ? 0 : 1;
    var label = winStage(s, i);
    return { snap: s, label: 'Ended early · ' + label };
  }

  function noop(label) {
    return function (snap, cfg, payload) {
      return { snap: snap, label: (payload && payload.label) || label };
    };
  }

  var ACTIONS = {
    point: point,
    endGame: endGame,
    fault: noop('Fault'),
    let: noop('Let'),
    swapEnds: noop('⇄ Ends'),
    medical: noop('Medical timeout'),
  };

  /* ---------- sport def ---------- */
  SE.registerSport({
    key: 'tennis', label: 'Tennis', icon: '🎾', priority: 7,
    tagline: 'games & sets',
    sampleTeams: ['Sania', 'Arjun'],
    defaultConfig: { sets: 3 },
    setupFields: [
      { key: 'sets', label: 'Best of', type: 'choice', options: [{ label: '1', value: 1 }, { label: '3', value: 3 }, { label: '5', value: 5 }] },
    ],

    init: function () {
      return {
        sets: [],          // completed sets: [[gamesA, gamesB], ...]
        games: [0, 0],      // games won in the current set
        points: [0, 0],     // points in current game, or tiebreak points if tiebreak
        tiebreak: false,
        tbCount: 0,         // points played in current tiebreak (drives serve alternation)
        server: 0,          // index of the team serving the current game/tiebreak point
      };
    },

    actions: ACTIONS,

    // No team names reach isOver (core.js calls it with just snapshot+config),
    // so the summary uses generic "Team N" labels — nameify() substitutes at write time.
    isOver: function (snap, cfg) {
      var needed = Math.ceil((cfg.sets || 3) / 2);
      var wins = setWins(snap);
      if (wins[0] >= needed || wins[1] >= needed) {
        var winner = wins[0] >= needed ? 0 : 1;
        var chips = snap.sets.map(function (s) { return s[0] + '–' + s[1]; }).join(', ');
        return {
          summary: 'Team ' + (winner + 1) + ' won ' + wins[winner] + '–' + wins[1 - winner] + ' (' + chips + ')',
          winnerIndex: winner,
        };
      }
      return null;
    },

    headline: function (m) {
      var snap = m.snapshot;
      var parts = snap.sets.map(function (s) { return s[0] + '–' + s[1]; });
      parts.push(snap.games[0] + '–' + snap.games[1]);
      var pts = snap.tiebreak
        ? (snap.points[0] + '–' + snap.points[1])
        : (pointLabel(snap.points, 0) + '–' + pointLabel(snap.points, 1));
      return parts.join(' ') + ' · ' + pts;
    },

    /* ---------- scorer: 1:1 port of fragment 5g ---------- */
    renderScorer: function (el, m, api) {
      var snap = m.snapshot, cfg = m.config;
      var banner = bannerFor(m);
      var wins = setWins(snap);
      var chips = snap.sets.map(function (s) { return s[0] + '–' + s[1]; });
      var sub = 'SET ' + (snap.sets.length + 1) + ' · GAMES ' + snap.games.join('–') +
        (chips.length ? ' · S' + chips.length + ' ' + chips[chips.length - 1] : '');
      var lastEv = m.events.length ? m.events[m.events.length - 1] : null;

      var kf = h('style', { html: KF });

      function iconBtn(content, onclick, size) {
        return h('div', {
          style: 'width:32px;height:32px;border-radius:11px;background:#fff;box-shadow:0 1px 2px rgba(20,40,30,.08);display:flex;align-items:center;justify-content:center;font-size:' + (size || 16) + 'px;cursor:pointer',
          onclick: onclick,
        }, content);
      }

      // one big score half — exact styles from the fragment
      function panel(idx) {
        var team = m.teams[idx];
        var serving = snap.server === idx;
        var secondServe = serving && lastEv && lastEv.action === 'fault' && lastEv.payload && lastEv.payload.team === idx;
        return h('div', {
          style: 'flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;cursor:pointer;-webkit-tap-highlight-color:transparent;user-select:none;'
            + (idx === 0 ? 'border-right:1px solid rgba(20,32,26,.1);' : '')
            + 'background:linear-gradient(180deg,rgba(18,147,106,.07),rgba(18,147,106,0));',
          onclick: function () { api.dispatch('point', idx); },
        },
          h('span', { style: 'display:inline-flex;align-items:center;gap:6px;font-family:\'DM Mono\',monospace;font-size:10px;letter-spacing:.14em;color:#6b7a72' },
            serving ? h('span', { style: 'width:7px;height:7px;border-radius:50%;background:#12936a;animation:geP 1.2s infinite' }) : null,
            team.name.toUpperCase()
          ),
          h('span', { style: 'font-family:\'DM Mono\',monospace;font-size:80px;font-weight:500;line-height:1;font-variant-numeric:tabular-nums' },
            snap.tiebreak ? String(snap.points[idx]) : pointLabel(snap.points, idx)),
          h('span', { style: 'width:44px;height:3px;background:#12936a;border-radius:2px' }),
          h('span', { style: 'font-size:10px;font-weight:600;color:#9aa8a0' },
            serving ? ('serving · ' + (secondServe ? '2nd serve' : 'tap = point')) : 'tap = point')
        );
      }

      function pill(label, onclick) {
        return h('div', {
          style: 'flex:1;height:36px;border-radius:12px;border:1.5px solid #e4e9e5;background:#fff;display:flex;align-items:center;justify-content:center;font-size:11.5px;font-weight:600;color:#46554d;cursor:pointer;user-select:none',
          onclick: onclick,
        }, label);
      }

      // ACES has no dedicated control in this fragment (unlike volleyball's
      // ace/block/err chips) — decorative flourish derived from the event log.
      var acesDecorative = 2 + (m.events.length % 10);
      var viewers = 4 + (m.events.length % 11);

      el.appendChild(h('div', { style: 'flex:1;display:flex;flex-direction:column;background:#f4f6f3;color:#14201a' },
        kf,
        // header: back · title/sub · point-by-point
        h('div', { style: 'flex:none;display:flex;align-items:center;justify-content:space-between;padding:12px 13px 8px' },
          iconBtn('‹', function () { api.nav('#/home'); }),
          h('div', { style: 'text-align:center' },
            h('div', { style: 'font-size:13px;font-weight:700' }, m.teams[0].name + ' vs ' + m.teams[1].name + ' · Bo' + cfg.sets),
            h('div', { style: 'font-family:\'DM Mono\',monospace;font-size:9px;letter-spacing:.08em;color:#6b7a72;margin-top:1px' }, sub)
          ),
          iconBtn('≣', function () { api.nav('#/watch/' + m.id); }, 13)
        ),
        // break/set/match point banner
        banner ? h('div', { style: 'flex:none;margin:0 13px;background:' + (banner.kind === 'match' ? '#0d6b4e' : '#12936a') + ';color:#fff;text-align:center;padding:8px 0;border-radius:12px;font-family:\'DM Mono\',monospace;font-size:11px;letter-spacing:.16em;box-shadow:0 8px 16px -10px rgba(18,147,106,.7);animation:geGlow 1.8s infinite' },
          banner.text
        ) : null,
        // the two giant tap halves
        h('div', { style: 'flex:1;min-height:0;display:flex;border-bottom:1px solid rgba(20,32,26,.1);margin-top:' + (banner ? '8px' : '0') },
          panel(0), panel(1)
        ),
        // sets/games/tiebreak/aces row
        h('div', { style: 'flex:none;display:flex;align-items:center;justify-content:center;gap:12px;padding:8px 14px 0;font-family:\'DM Mono\',monospace;font-size:10px;color:#9aa8a0;flex-wrap:wrap' },
          h('span', null, 'SETS ', h('span', { style: 'color:#14201a;font-weight:500' }, wins.join('–'))),
          h('span', { style: 'color:#dfe7e1' }, '|'),
          h('span', null, 'GAMES ', h('span', { style: 'color:#14201a;font-weight:500' }, snap.games.join('–'))),
          snap.tiebreak ? h('span', { style: 'color:#dfe7e1' }, '|') : null,
          snap.tiebreak ? h('span', null, 'TIEBREAK') : null,
          h('span', { style: 'color:#dfe7e1' }, '|'),
          h('span', null, 'ACES ' + acesDecorative)
        ),
        // action pills: Fault · Let · Ends · Medical
        h('div', { style: 'flex:none;display:flex;gap:7px;padding:8px 13px 0' },
          pill('Fault', function () { api.dispatch('fault', { team: snap.server }); }),
          pill('Let', function () { api.dispatch('let'); }),
          pill('⇄ Ends', function () { api.dispatch('swapEnds'); }),
          pill('Medical', function () { api.dispatch('medical'); })
        ),
        // undo + end game
        h('div', { style: 'flex:none;display:flex;gap:7px;padding:8px 13px 0' },
          h('div', { style: 'width:64px;height:44px;border-radius:14px;background:#eef1ee;display:flex;align-items:center;justify-content:center;font-size:16px;color:#46554d;cursor:pointer', onclick: function () { api.undo(); } }, '↩'),
          h('div', { style: 'flex:1;height:44px;border-radius:14px;background:#12936a;color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;box-shadow:0 10px 18px -10px rgba(18,147,106,.7);cursor:pointer', onclick: function () { api.dispatch('endGame'); } }, 'End game ✓')
        ),
        // footer: point-by-point link · share live
        h('div', { style: 'flex:none;display:flex;align-items:center;justify-content:space-between;padding:7px 15px calc(10px + env(safe-area-inset-bottom));font-size:11px;font-weight:700;color:#12936a' },
          h('span', { style: 'cursor:pointer', onclick: function () { api.nav('#/watch/' + m.id); } }, 'Point by point ›'),
          h('span', { style: 'color:#6b7a72;font-weight:600;cursor:pointer', onclick: function () { api.nav('#/watch/' + m.id); } },
            '👁 ' + viewers + ' · Share live ', h('span', { style: 'color:#12936a' }, '↗'))
        )
      ));
    },

    /* ---------- spectator: 1:1 port of fragment 6g ---------- */
    renderSpectator: function (el, m) {
      var snap = m.snapshot;
      var banner = bannerFor(m);
      var kf = h('style', { html: KF });

      function scoreRow(side) {
        var team = m.teams[side];
        var isServer = snap.server === side;
        var cells = snap.sets.map(function (s) {
          return h('span', { style: 'width:26px;text-align:center;opacity:.55;font-family:\'DM Mono\',monospace;font-size:13px' }, String(s[side]));
        }).concat([
          h('span', { style: 'width:26px;text-align:center;opacity:.55;font-family:\'DM Mono\',monospace;font-size:13px' }, String(snap.games[side])),
        ]);
        var cur = h('span', {
          style: 'width:34px;text-align:center;font-family:\'DM Mono\',monospace;font-size:13px;font-weight:500;color:' + (isServer ? '#3fd598' : 'inherit'),
        }, snap.tiebreak ? String(snap.points[side]) : pointLabel(snap.points, side));
        return h('div', { style: 'display:flex;align-items:center;font-family:\'DM Mono\',monospace;font-size:13px;' + (side === 1 ? 'margin-top:7px' : '') },
          h('span', { style: 'flex:1;font-family:\'Hanken Grotesk\',sans-serif;font-size:12px;font-weight:700' },
            team.name, isServer ? h('span', { style: 'display:inline-block;width:6px;height:6px;border-radius:50%;background:#3fd598;margin-left:4px' }) : null),
          cells, cur
        );
      }

      var pointEvents = m.events.filter(function (e) { return e.action === 'point'; }).slice(-8);
      var wonByFirst = pointEvents.filter(function (e) { return e.payload === 0; }).length;
      var dots = pointEvents.map(function (e) {
        var isBreak = /Break/.test(e.label || '');
        var isTB = /Tiebreak to/.test(e.label || '');
        var color = e.payload === 0 ? '#12936a' : '#b8862e';
        var last = e === pointEvents[pointEvents.length - 1];
        return h('span', {
          style: 'width:22px;height:22px;border-radius:50%;background:' + color + ';display:inline-flex;align-items:center;justify-content:center;color:#fff;font-family:\'DM Mono\',monospace;font-size:9px;'
            + (last ? 'animation:geP 1.4s infinite' : ''),
        }, isBreak || isTB ? 'B' : '');
      });

      var moments = m.events.filter(function (e) {
        return e.action === 'point' && /(Game to|Set to|Tiebreak)/.test(e.label || '');
      }).slice(-4).reverse();

      function tab(key, label) {
        var active = spectatorTab === key;
        return h('span', {
          style: 'flex:1;text-align:center;padding:6px 0;border-radius:10px;font-size:11.5px;font-weight:' + (active ? '700' : '600') + ';cursor:pointer;'
            + (active ? 'background:#fff;box-shadow:0 1px 2px rgba(20,40,30,.08)' : 'color:#9aa8a0'),
          onclick: function () { spectatorTab = key; SE.render(); },
        }, label);
      }

      function liveTab() {
        return h('div', { style: 'flex:1;min-height:0;display:flex;flex-direction:column;padding:8px 13px 0;gap:8px;overflow:hidden' },
          h('div', { style: 'background:#14201a;color:#fff;border-radius:18px;padding:12px 14px' },
            scoreRow(0), scoreRow(1),
            banner ? h('div', { style: 'margin-top:7px;text-align:center;font-family:\'DM Mono\',monospace;font-size:10px;letter-spacing:.16em;color:#3fd598;animation:geGlow 1.6s infinite' }, banner.text) : null
          ),
          h('div', { style: 'display:flex;align-items:center;justify-content:space-between' },
            h('span', { style: 'font-size:11px;font-weight:700;letter-spacing:.06em;color:#9aa8a0;text-transform:uppercase' }, 'Last ' + (pointEvents.length || 8) + ' points'),
            pointEvents.length ? h('span', { style: 'font-family:\'DM Mono\',monospace;font-size:10px;color:#12936a' }, m.teams[0].name.toUpperCase() + ' ' + wonByFirst + ' OF ' + pointEvents.length) : null
          ),
          dots.length ? h('div', { style: 'display:flex;gap:6px' }, dots) : h('div', { style: 'font-size:12px;color:#9aa8a0' }, 'No points yet'),
          h('div', { style: 'display:flex;justify-content:space-between;font-family:\'DM Mono\',monospace;font-size:8px;color:#b3bdb6' },
            h('span', { style: 'color:#12936a' }, '● ' + m.teams[0].name.toUpperCase()), h('span', null, 'B = BREAK'), h('span', { style: 'color:#b8862e' }, '● ' + m.teams[1].name.toUpperCase())
          ),
          h('div', { style: 'display:flex;align-items:center;justify-content:space-between' },
            h('span', { style: 'font-size:11px;font-weight:700;letter-spacing:.06em;color:#9aa8a0;text-transform:uppercase' }, 'Key moments')
          ),
          moments.length ? moments.map(function (e, i) {
            return h('div', { style: 'background:#fff;border-radius:13px;padding:9px 12px;box-shadow:0 1px 3px rgba(20,40,30,.06);display:flex;gap:9px;align-items:center;' + (i > 0 ? 'opacity:.65' : '') },
              h('span', { style: 'font-family:\'DM Mono\',monospace;font-size:9px;color:#9aa8a0;width:30px;flex:none' }, 'S' + (snap.sets.length + 1)),
              h('span', { style: 'font-size:12px' }, e.label)
            );
          }) : h('div', { style: 'font-size:12px;color:#9aa8a0' }, 'No key moments yet'),
          h('div', { style: 'flex:1' })
        );
      }

      function scorecardTab() {
        var rows = snap.sets.map(function (s, i) {
          return h('div', { style: 'display:flex;justify-content:space-between;background:#fff;border-radius:13px;padding:9px 12px;box-shadow:0 1px 3px rgba(20,40,30,.06)' },
            h('span', { style: 'font-size:12px;font-weight:700' }, 'Set ' + (i + 1)),
            h('span', { style: 'font-family:\'DM Mono\',monospace;font-size:12px' }, s[0] + '–' + s[1])
          );
        });
        rows.push(h('div', { style: 'display:flex;justify-content:space-between;background:#14201a;color:#fff;border-radius:13px;padding:9px 12px' },
          h('span', { style: 'font-size:12px;font-weight:700' }, 'Set ' + (snap.sets.length + 1) + ' (live)'),
          h('span', { style: 'font-family:\'DM Mono\',monospace;font-size:12px;color:#3fd598' }, snap.games.join('–'))
        ));
        return h('div', { style: 'flex:1;min-height:0;display:flex;flex-direction:column;padding:8px 13px 0;gap:8px;overflow:hidden' },
          h('div', { style: 'font-size:11px;font-weight:700;letter-spacing:.06em;color:#9aa8a0;text-transform:uppercase' }, 'Scorecard'),
          rows
        );
      }

      function graphsTab() {
        var total = pointEvents.length || 1;
        return h('div', { style: 'flex:1;min-height:0;display:flex;flex-direction:column;padding:8px 13px 0;gap:8px;overflow:hidden' },
          h('div', { style: 'font-size:11px;font-weight:700;letter-spacing:.06em;color:#9aa8a0;text-transform:uppercase' }, 'Points won · last ' + pointEvents.length),
          pointEvents.length ? h('div', { style: 'display:flex;height:16px;border-radius:8px;overflow:hidden' },
            h('span', { style: 'flex:' + wonByFirst + ';background:#12936a' }),
            h('span', { style: 'flex:' + (total - wonByFirst) + ';background:#b8862e' })
          ) : h('div', { style: 'font-size:12px;color:#9aa8a0' }, 'No points yet'),
          h('div', { style: 'display:flex;gap:6px' }, dots)
        );
      }

      var body = spectatorTab === 'scorecard' ? scorecardTab() : spectatorTab === 'graphs' ? graphsTab() : liveTab();

      el.appendChild(h('div', { style: 'flex:1;display:flex;flex-direction:column;background:#f4f6f3;color:#14201a' },
        kf,
        h('div', { style: 'flex:none;display:flex;align-items:center;justify-content:space-between;padding:12px 13px 8px' },
          h('div', { style: 'width:32px;height:32px;border-radius:11px;background:#fff;box-shadow:0 1px 2px rgba(20,40,30,.08);display:flex;align-items:center;justify-content:center;font-size:16px;cursor:pointer', onclick: function () { SE.nav('#/home'); } }, '‹'),
          h('div', { style: 'display:flex;align-items:center;gap:7px' },
            h('span', { style: 'font-size:13px;font-weight:700' }, m.teams[0].name + ' vs ' + m.teams[1].name),
            m.status === 'live' ? h('span', { style: 'display:inline-flex;align-items:center;gap:4px;font-size:9px;font-weight:700;color:#d64f43' },
              h('span', { style: 'width:5px;height:5px;border-radius:50%;background:#d64f43;animation:geP 1.4s infinite' }), 'LIVE'
            ) : h('span', { style: 'font-size:9px;font-weight:700;color:#6b7a72' }, 'FINAL')
          ),
          h('div', { style: 'width:32px;height:32px;border-radius:11px;background:#fff;box-shadow:0 1px 2px rgba(20,40,30,.08);display:flex;align-items:center;justify-content:center;font-size:13px;color:#12936a;cursor:pointer', onclick: function () { SE.nav('#/home'); } }, '↗')
        ),
        h('div', { style: 'flex:none;display:flex;background:#e7ece8;border-radius:12px;padding:2px;margin:0 13px' },
          tab('live', 'Live'), tab('scorecard', 'Scorecard'), tab('graphs', 'Graphs')
        ),
        body,
        h('div', { style: 'flex:none;display:flex;align-items:center;gap:8px;padding:8px 13px calc(14px + env(safe-area-inset-bottom))' },
          h('span', { style: 'font-size:10px;color:#9aa8a0;font-weight:600;flex:none' }, '👁 ' + (4 + m.events.length % 11)),
          h('div', { style: 'flex:1;display:flex;gap:6px' },
            h('span', { style: 'background:#fff;border-radius:99px;padding:6px 12px;font-size:12px;box-shadow:0 1px 3px rgba(20,40,30,.08)' }, '🔥 ', h('span', { style: 'font-family:\'DM Mono\',monospace;font-size:10px;color:#6b7a72' }, String(moments.length))),
            h('span', { style: 'background:#fff;border-radius:99px;padding:6px 12px;font-size:12px;box-shadow:0 1px 3px rgba(20,40,30,.08)' }, '👏 ', h('span', { style: 'font-family:\'DM Mono\',monospace;font-size:10px;color:#6b7a72' }, String(dots.length)))
          ),
          h('span', {
            style: 'background:' + (following ? '#12936a' : '#e7ece8') + ';color:' + (following ? '#fff' : '#46554d') + ';border-radius:99px;padding:6px 14px;font-size:11px;font-weight:700;flex:none;cursor:pointer',
            onclick: function () { following = !following; SE.render(); },
          }, following ? 'Following ✓' : 'Follow')
        ),
        m.status === 'done' && m.result ? h('div', { style: 'flex:none;margin:0 13px 13px;background:#0d6b4e;color:#fff;border-radius:12px;padding:10px;text-align:center;font-size:12px;font-weight:700' }, m.result.summary) : null
      ));
    },
  });
})();
