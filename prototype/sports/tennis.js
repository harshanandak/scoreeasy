/* Tennis: sets → games → points, 0/15/30/40 with deuce/advantage, 7-point
   tiebreak at 6–6. Reference: prototype/reference/screens/5g-tennis-scorer-refined.html
   and 6g-spectator-tennis-refined.html. */
(function () {
  'use strict';
  var h = SE.h;
  var NAMES = ['0', '15', '30', '40'];

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
      if (wins[decisive] >= needed) return { text: 'MATCH POINT · ' + name, hot: true };
      return { text: 'SET POINT · ' + name, hot: true };
    }
    if (!snap.tiebreak && decisive !== snap.server) return { text: 'BREAK POINT · ' + name, hot: false };
    return null; // plain game point for the server — fragment doesn't call this out
  }

  function injectStyle() {
    if (document.getElementById('tn-style')) return;
    var st = document.createElement('style');
    st.id = 'tn-style';
    st.textContent = '@keyframes tnPulse{50%{opacity:.35}}' +
      '.tn-dot{width:7px;height:7px;border-radius:50%;background:var(--accent);display:inline-block;animation:tnPulse 1.2s infinite}';
    document.head.appendChild(st);
  }

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

    actions: {
      point: function (snap, cfg, payload) {
        var s = {
          sets: snap.sets.map(function (x) { return [x[0], x[1]]; }),
          games: [snap.games[0], snap.games[1]],
          points: [snap.points[0], snap.points[1]],
          tiebreak: snap.tiebreak, tbCount: snap.tbCount, server: snap.server,
        };
        var i = payload, o = 1 - i, label;

        if (s.tiebreak) {
          s.points[i]++; s.tbCount++;
          if (s.points[i] >= 7 && (s.points[i] - s.points[o]) >= 2) {
            var winnerGames = s.games[i] + 1, loserGames = s.games[o];
            s.sets.push(i === 0 ? [winnerGames, loserGames] : [loserGames, winnerGames]);
            s.games = [0, 0]; s.points = [0, 0]; s.tiebreak = false; s.tbCount = 0;
            s.server = 1 - s.server;
            label = 'Tiebreak to P' + (i + 1);
          } else {
            if (s.tbCount % 2 === 1) s.server = 1 - s.server; // switch after pt 1, then every 2
            label = 'P' + (i + 1) + ' point';
          }
        } else {
          s.points[i]++;
          if (s.points[i] >= 4 && (s.points[i] - s.points[o]) >= 2) {
            var isBreak = (i !== s.server);
            s.games[i]++; s.points = [0, 0]; s.server = 1 - s.server;
            if (s.games[i] >= 6 && (s.games[i] - s.games[o]) >= 2) {
              s.sets.push([s.games[0], s.games[1]]); s.games = [0, 0];
              label = (isBreak ? 'Break! ' : '') + 'Set to P' + (i + 1);
            } else if (s.games[0] === 6 && s.games[1] === 6) {
              s.tiebreak = true; s.tbCount = 0; s.points = [0, 0];
              label = 'Tiebreak';
            } else {
              label = (isBreak ? 'Break! ' : '') + 'Game to P' + (i + 1);
            }
          } else {
            label = 'P' + (i + 1) + ' point';
          }
        }
        return { snap: s, label: label };
      },
    },

    // No team names reach isOver (core.js calls it with just snapshot+config),
    // so the summary uses generic "Team N" labels — see report for detail.
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

    renderScorer: function (el, m, api) {
      injectStyle();
      var snap = m.snapshot, cfg = m.config;
      var banner = bannerFor(m);
      var chips = snap.sets.map(function (s) { return s[0] + '–' + s[1]; });
      var sub = 'SET ' + (snap.sets.length + 1) + ' · GAMES ' + snap.games.join('–') +
        (chips.length ? ' · S' + chips.length + ' ' + chips[chips.length - 1] : '');

      function teamPanel(side) {
        var team = m.teams[side];
        var isServer = snap.server === side;
        return h('div', {
          class: 'tapzone' + (isServer ? ' leading' : ''),
          style: 'flex:1;padding:22px 8px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:190px',
          onclick: function () { api.dispatch('point', side); },
        },
          h('div', { class: 'row', style: 'gap:6px;align-items:center;justify-content:center' },
            isServer ? h('span', { class: 'tn-dot' }) : null,
            h('span', { class: 'microlabel' }, team.name.toUpperCase())
          ),
          h('div', { class: 'bignum', style: 'font-size:64px' },
            snap.tiebreak ? String(snap.points[side]) : pointLabel(snap.points, side)),
          h('div', { style: 'width:40px;height:3px;background:var(--accent);border-radius:2px' }),
          h('div', { class: 'muted', style: 'font-size:10px;font-weight:600' }, 'tap = point')
        );
      }

      el.appendChild(h('div', { class: 'screen' },
        SE.topbar({
          title: m.teams[0].name + ' vs ' + m.teams[1].name + ' · Bo' + cfg.sets,
          sub: sub, back: '#/home',
          right: h('a', { class: 'chip', href: '#/watch/' + m.id }, '👁'),
        }),
        banner ? h('div', { class: 'banner' + (banner.hot ? ' hot' : '') }, banner.text) : null,
        h('div', { class: 'row', style: 'gap:0;border-radius:16px;overflow:hidden;box-shadow:var(--shadow-card)' },
          teamPanel(0), teamPanel(1)
        ),
        h('div', { class: 'row', style: 'justify-content:center;gap:10px' },
          h('span', { class: 'chip' }, 'SETS ' + setWins(snap).join('–')),
          h('span', { class: 'chip' }, 'GAMES ' + snap.games.join('–')),
          snap.tiebreak ? h('span', { class: 'chip accent' }, 'TIEBREAK') : null
        ),
        h('div', { class: 'spacer', style: 'flex:1' }),
        h('button', { class: 'btn ghost block', onclick: function () { api.undo(); } }, '↩ Undo')
      ));
    },

    renderSpectator: function (el, m) {
      injectStyle();
      var snap = m.snapshot;

      function scoreRow(side) {
        var team = m.teams[side];
        var isServer = snap.server === side;
        var cells = snap.sets.map(function (s) {
          return h('span', { style: 'width:26px;text-align:center;opacity:.55;font-family:var(--font-num);font-size:13px' }, String(s[side]));
        });
        var cur = h('span', {
          style: 'width:34px;text-align:center;font-family:var(--font-num);font-size:13px;font-weight:500;color:' + (isServer ? '#3fd598' : 'inherit'),
        }, snap.tiebreak ? String(snap.points[side]) : pointLabel(snap.points, side));
        return h('div', { class: 'row', style: 'align-items:center' },
          h('span', { class: 'grow', style: 'font-size:12px;font-weight:700' },
            team.name, isServer ? h('span', { style: 'display:inline-block;width:6px;height:6px;border-radius:50%;background:#3fd598;margin-left:4px' }) : null),
          cells, cur
        );
      }

      var banner = bannerFor(m);
      var pointEvents = m.events.filter(function (e) { return e.action === 'point'; }).slice(-8);
      var wonByFirst = pointEvents.filter(function (e) { return e.payload === 0; }).length;
      var dots = pointEvents.map(function (e) {
        var isBreak = /Break/.test(e.label || '');
        var color = e.payload === 0 ? 'var(--accent)' : 'var(--amber)';
        return h('span', {
          style: 'width:22px;height:22px;border-radius:50%;background:' + color + ';display:inline-flex;align-items:center;justify-content:center;color:#fff;font-family:var(--font-num);font-size:9px',
        }, isBreak ? 'B' : '');
      });

      var moments = m.events.filter(function (e) {
        return e.action === 'point' && /(Game to|Set to|Tiebreak)/.test(e.label || '');
      }).slice(-4).reverse();

      el.appendChild(h('div', { class: 'screen' },
        SE.topbar({ title: m.teams[0].name + ' vs ' + m.teams[1].name, sub: m.status === 'live' ? 'LIVE' : 'FINAL', back: '#/home' }),

        h('div', { style: 'background:var(--ink);color:#fff;border-radius:18px;padding:12px 14px;display:flex;flex-direction:column;gap:7px' },
          scoreRow(0), scoreRow(1),
          banner ? h('div', { style: 'text-align:center;font-family:var(--font-num);font-size:10px;letter-spacing:.16em;color:#3fd598;margin-top:2px' }, banner.text) : null
        ),

        pointEvents.length ? h('div', { style: 'display:flex;flex-direction:column;gap:8px' },
          h('div', { class: 'row', style: 'justify-content:space-between' },
            h('span', { class: 'microlabel' }, 'LAST ' + pointEvents.length + ' POINTS'),
            h('span', { class: 'mono', style: 'font-size:10px;color:var(--accent)' },
              m.teams[0].name.toUpperCase() + ' ' + wonByFirst + ' OF ' + pointEvents.length)
          ),
          h('div', { class: 'row', style: 'gap:6px' }, dots)
        ) : null,

        moments.length ? h('div', { style: 'display:flex;flex-direction:column;gap:8px' },
          h('div', { class: 'microlabel' }, 'KEY MOMENTS'),
          moments.map(function (e) {
            return h('div', { class: 'card row', style: 'padding:9px 12px' }, h('span', { style: 'font-size:12px' }, e.label));
          })
        ) : null
      ));
    },
  });
})();
