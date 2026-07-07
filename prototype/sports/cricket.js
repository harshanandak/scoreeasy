/* Cricket sport definition. Two-innings limited-overs game: team-level runs/wickets/overs
   only (no per-player roster — setup only collects two team names), so batsman/bowler
   figures and partnership ("P'SHIP") from the reference fragments are intentionally dropped
   — same simplification the original build made, kept through the fidelity pass.
   Scorer and spectator are 1:1 ports of fragments 5a/6a (see renderScorer/renderSpectator). */
(function () {
  'use strict';
  var h = SE.h;
  var BALLS_PER_OVER = 6;

  /* ---------- pure helpers ---------- */
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function maxWickets(cfg) { return cfg.players - 1; }
  function totalBalls(cfg) { return cfg.overs * BALLS_PER_OVER; }
  function oversStr(balls) { return Math.floor(balls / BALLS_PER_OVER) + '.' + (balls % BALLS_PER_OVER); }
  function runRate(runs, balls) { return balls ? (runs / (balls / BALLS_PER_OVER)).toFixed(2) : '0.00'; }
  function reqRunRate(target, runs, tBalls, balls) {
    var remaining = tBalls - balls;
    if (remaining <= 0) return '-';
    return Math.max(0, (target - runs) / (remaining / BALLS_PER_OVER)).toFixed(2);
  }

  function freshInnings(battingTeam) {
    return {
      battingTeam: battingTeam, runs: 0, wickets: 0, balls: 0,
      thisOver: [], overHistory: [], curOverRuns: 0, curOverWicket: false,
      fallOfWickets: [], extras: { wide: 0, noball: 0, bye: 0, legbye: 0 },
      closed: false,
    };
  }

  function chipLabel(runsScored, isWicket, extra) {
    if (extra === 'wide') return 'wd';
    if (extra === 'noball') return 'nb';
    if (extra === 'bye') return 'b';
    if (extra === 'legbye') return 'lb';
    if (isWicket) return 'W';
    return String(runsScored);
  }
  function ballLabel(runsScored, isWicket, extra) {
    if (extra === 'wide') return 'Wide +1';
    if (extra === 'noball') return 'No-ball +1';
    if (extra === 'bye') return 'Bye +1';
    if (extra === 'legbye') return 'Leg bye +1';
    if (isWicket) return 'WICKET!';
    if (runsScored === 4) return 'FOUR!';
    if (runsScored === 6) return 'SIX!';
    if (runsScored === 0) return 'Dot ball';
    return runsScored + (runsScored === 1 ? ' run' : ' runs');
  }

  // Applies one ball (runs / wicket / wide / no-ball / bye / leg-bye) to the current innings,
  // auto-starting innings 2 when innings 1 finishes. Never mutates the incoming snap.
  // wide/noball are illegal deliveries (ball doesn't count, +1 extra run); bye/legbye are
  // legal deliveries that add a run without it being scored off the bat.
  function applyBall(snap, cfg, runsScored, isWicket, extra) {
    var s = clone(snap);
    var idx = s.inningsIdx;
    var inn = s.innings[idx];
    var illegal = extra === 'wide' || extra === 'noball';
    var legal = !illegal;
    var runsAdded = illegal ? 1 + runsScored : runsScored;

    inn.runs += runsAdded;
    inn.curOverRuns += runsAdded;
    if (extra) inn.extras[extra] = (inn.extras[extra] || 0) + 1;
    if (isWicket) {
      inn.wickets += 1;
      inn.curOverWicket = true;
      inn.fallOfWickets.push({ score: inn.runs, overs: oversStr(inn.balls + (legal ? 1 : 0)) });
    }
    inn.thisOver.push(chipLabel(runsScored, isWicket, extra));
    if (legal) {
      inn.balls += 1;
      if (inn.balls % BALLS_PER_OVER === 0) {
        inn.overHistory.push({ runs: inn.curOverRuns, wicket: inn.curOverWicket });
        inn.thisOver = [];
        inn.curOverRuns = 0;
        inn.curOverWicket = false;
      }
    }

    var finished = inn.closed || inn.wickets >= maxWickets(cfg) || inn.balls >= totalBalls(cfg);
    if (finished && idx === 0) {
      s.target = inn.runs + 1;
      s.inningsIdx = 1;
      s.innings[1] = freshInnings(1);
    }
    return { snap: s, label: ballLabel(runsScored, isWicket, extra) };
  }

  function noop(label) {
    return function (snap, cfg, payload) {
      return { snap: snap, label: (payload && payload.label) || label };
    };
  }

  var ACTIONS = {
    runs: function (snap, cfg, payload) { return applyBall(snap, cfg, payload.runs, false, null); },
    wicket: function (snap, cfg) { return applyBall(snap, cfg, 0, true, null); },
    wide: function (snap, cfg) { return applyBall(snap, cfg, 0, false, 'wide'); },
    noball: function (snap, cfg) { return applyBall(snap, cfg, 0, false, 'noball'); },
    bye: function (snap, cfg) { return applyBall(snap, cfg, 1, false, 'bye'); },
    legbye: function (snap, cfg) { return applyBall(snap, cfg, 1, false, 'legbye'); },
    // Manual declare/close-out — forces the current innings to finish immediately.
    endInnings: function (snap, cfg) {
      var s = clone(snap);
      var idx = s.inningsIdx;
      s.innings[idx].closed = true;
      if (idx === 0) {
        s.target = s.innings[0].runs + 1;
        s.inningsIdx = 1;
        s.innings[1] = freshInnings(1);
      }
      return { snap: s, label: 'Innings closed' };
    },
    // No natural rule change (no per-player roster to track strike) — pure no-op so it
    // still lands in the event feed. See fragment 5a's "⇄ Strike" control.
    swapStrike: noop('⇄ Strike swapped'),
  };

  /* ---------- render helpers (raw fragment hex, not tokens.css vars — matches
     volleyball.js's exemplar porting style) ---------- */
  function ballChip(c) {
    var bg = '#fff', color = '#14201a', shadow = '0 1px 2px rgba(20,40,30,.08)', weight = 400, size = 10;
    if (c === 'W') { bg = '#fdeceb'; color = '#d64f43'; shadow = 'none'; weight = 700; size = 9; }
    else if (c === '4' || c === '6') { bg = '#e7f4ee'; color = '#12936a'; shadow = 'none'; weight = 700; }
    else if (c === 'wd' || c === 'nb' || c === 'b' || c === 'lb') { bg = '#f7efdb'; color = '#b98a1d'; shadow = 'none'; weight = 700; size = 9; }
    return h('span', {
      style: 'width:20px;height:20px;border-radius:50%;background:' + bg + ';color:' + color + ';box-shadow:' + shadow
        + ';display:inline-flex;align-items:center;justify-content:center;font-family:\'DM Mono\',monospace;font-size:' + size + 'px;font-weight:' + weight,
    }, c);
  }
  function emptyChip() {
    return h('span', { style: 'width:20px;height:20px;border-radius:50%;border:1px dashed #cfd8d1' });
  }

  // Per-over run history for the momentum chart, sourced straight from the live snapshot
  // (inn.overHistory) plus the in-progress over (rendered as the dashed "live" bar).
  function momentumBars(inn) {
    var bars = inn.overHistory.slice(-13).map(function (o) { return { runs: o.runs, wicket: o.wicket, current: false }; });
    if (inn.balls % BALLS_PER_OVER > 0) bars.push({ runs: inn.curOverRuns, wicket: inn.curOverWicket, current: true });
    return bars;
  }

  // Replays the match's own event log through this module's own reducers (same pattern as
  // volleyball.js's currentSetActivity) purely to recover the over.ball marker each boundary/
  // wicket happened at — never touches the stored snapshot.
  function keyMoments(match) {
    var snap = { inningsIdx: 0, target: null, innings: [freshInnings(0), null] };
    var out = [];
    match.events.forEach(function (ev) {
      var fn = ACTIONS[ev.action];
      if (!fn) return;
      var marker = oversStr(snap.innings[snap.inningsIdx].balls);
      var res = fn(snap, match.config, ev.payload);
      snap = res.snap;
      if (ev.action === 'wicket') out.push({ marker: marker, label: res.label, kind: 'wicket' });
      else if (ev.action === 'runs' && ev.payload && (ev.payload.runs === 4 || ev.payload.runs === 6)) {
        out.push({ marker: marker, label: res.label, kind: ev.payload.runs === 6 ? 'six' : 'four' });
      }
    });
    return out;
  }

  // per-match, session-local UI state for the spectator screen (view tab / reactions /
  // follow toggle) — deliberately NOT part of match.snapshot: it's decorative viewing state,
  // not scoring state, so it must never affect undo/replay.
  var spectatorTab = {};
  var spectatorReactions = {};
  var spectatorFollowed = {};

  SE.registerSport({
    key: 'cricket', label: 'Cricket', icon: '🏏', priority: 1,
    tagline: 'runs & wickets',
    sampleTeams: ['Reds', 'Blues'],
    defaultConfig: { overs: 5, players: 6 },
    setupFields: [
      { key: 'overs', label: 'Overs', type: 'choice', options: [
        { label: '2', value: 2 }, { label: '5', value: 5 }, { label: '10', value: 10 }, { label: '20', value: 20 }
      ] },
      { key: 'players', label: 'Players a side', type: 'choice', options: [
        { label: '2', value: 2 }, { label: '6', value: 6 }, { label: '11', value: 11 }
      ] },
    ],

    init: function () {
      return { inningsIdx: 0, target: null, innings: [freshInnings(0), null] };
    },

    actions: ACTIONS,

    isOver: function (snap, cfg) {
      if (snap.inningsIdx !== 1) return null; // innings 1 auto-transitions inside the reducer
      var inn2 = snap.innings[1];
      var maxW = maxWickets(cfg);

      if (inn2.runs >= snap.target) {
        var wktsInHand = maxW - inn2.wickets;
        return { summary: 'Won by ' + wktsInHand + ' wicket' + (wktsInHand === 1 ? '' : 's'), winnerIndex: 1 };
      }
      var finished = inn2.closed || inn2.wickets >= maxW || inn2.balls >= totalBalls(cfg);
      if (finished) {
        var diff = snap.innings[0].runs - inn2.runs;
        if (diff === 0) return { summary: 'Match tied', winnerIndex: null };
        if (diff > 0) return { summary: 'Won by ' + diff + ' run' + (diff === 1 ? '' : 's'), winnerIndex: 0 };
        return { summary: 'Won by ' + (-diff) + ' wicket' + (-diff === 1 ? '' : 's'), winnerIndex: 1 }; // defensive fallback
      }
      return null;
    },

    headline: function (m) {
      var s = m.snapshot, cfg = m.config;
      var inn = s.innings[s.inningsIdx];
      if (s.inningsIdx === 0) return inn.runs + '/' + inn.wickets + ' · ' + oversStr(inn.balls) + ' ov';
      var need = s.target - inn.runs;
      if (need <= 0) return m.teams[inn.battingTeam].name + ' won';
      return 'need ' + need + ' off ' + Math.max(0, totalBalls(cfg) - inn.balls);
    },

    /* ---------- scorer: 1:1 port of fragment 5a ---------- */
    renderScorer: function (el, match, api) {
      var s = match.snapshot, cfg = match.config;
      var idx = s.inningsIdx;
      var inn = s.innings[idx];
      var names = [match.teams[0].name, match.teams[1].name];
      var tBalls = totalBalls(cfg);
      var progressPct = Math.min(100, Math.round((100 * inn.balls) / tBalls));

      function iconBtn(content, onclick, size) {
        return h('div', {
          style: 'width:32px;height:32px;border-radius:11px;background:#fff;box-shadow:0 1px 2px rgba(20,40,30,.08);display:flex;align-items:center;justify-content:center;font-size:' + (size || 16) + 'px;cursor:pointer',
          onclick: onclick,
        }, content);
      }

      var header = h('div', { style: 'flex:none;display:flex;align-items:center;justify-content:space-between;padding:12px 13px 8px' },
        iconBtn('‹', function () { api.nav('#/home'); }),
        h('div', { style: 'text-align:center' },
          h('div', { style: 'font-size:13px;font-weight:700' }, names[0] + ' vs ' + names[1] + ' · ' + cfg.overs + '-over'),
          h('div', { style: 'font-family:\'DM Mono\',monospace;font-size:9px;letter-spacing:.08em;color:#6b7a72;margin-top:1px' },
            'OVER ' + oversStr(inn.balls) + (idx === 1 ? ' · CHASING ' + s.target : ''))
        ),
        iconBtn('≣', function () { api.nav('#/watch/' + match.id); }, 13)
      );

      var scoreCard = h('div', { style: 'flex:none;margin:0 13px;background:linear-gradient(160deg,#12936a,#0c6e50);border-radius:18px;color:#fff;padding:11px 14px;box-shadow:0 12px 22px -14px rgba(18,147,106,.6)' },
        h('div', { style: 'display:flex;align-items:flex-end;justify-content:space-between' },
          h('div', { style: 'display:flex;align-items:flex-end;gap:7px' },
            h('span', { style: 'font-family:\'DM Mono\',monospace;font-size:38px;font-weight:500;line-height:.82;font-variant-numeric:tabular-nums' },
              String(inn.runs), h('span', { style: 'opacity:.6;font-size:26px' }, '/' + inn.wickets)),
            h('span', { style: 'font-family:\'DM Mono\',monospace;font-size:11px;color:rgba(255,255,255,.75);margin-bottom:2px' }, '(' + oversStr(inn.balls) + ')')
          ),
          h('span', { style: 'font-family:\'DM Mono\',monospace;font-size:10.5px;color:rgba(255,255,255,.75);margin-bottom:2px' }, 'CRR ' + runRate(inn.runs, inn.balls))
        ),
        h('div', { style: 'margin-top:7px;height:4px;border-radius:99px;background:rgba(255,255,255,.22);overflow:hidden' },
          h('div', { style: 'width:' + progressPct + '%;height:100%;background:#fff' })
        ),
        idx === 1 ? h('div', { style: 'margin-top:7px;display:flex;align-items:baseline;justify-content:space-between;font-family:\'DM Mono\',monospace' },
          h('span', { style: 'font-size:11px;color:rgba(255,255,255,.75)' },
            'NEED ', h('span', { style: 'font-size:15px;font-weight:600;color:#fff' }, String(Math.max(0, s.target - inn.runs))),
            ' OFF ', h('span', { style: 'font-size:15px;font-weight:600;color:#fff' }, String(Math.max(0, tBalls - inn.balls)))),
          h('span', { style: 'font-size:11px;color:rgba(255,255,255,.75)' },
            'RRR ', h('span', { style: 'color:#fff;font-weight:600' }, reqRunRate(s.target, inn.runs, tBalls, inn.balls)))
        ) : null
      );

      var legalCount = inn.thisOver.filter(function (c) { return c !== 'wd' && c !== 'nb'; }).length;
      var empties = [];
      for (var i = 0; i < Math.max(0, BALLS_PER_OVER - legalCount); i++) empties.push(emptyChip());
      var lastWkt = inn.fallOfWickets.length ? inn.fallOfWickets[inn.fallOfWickets.length - 1] : null;

      var overRow = h('div', { style: 'flex:none;display:flex;align-items:center;gap:6px;padding:8px 15px 0;flex-wrap:wrap' },
        h('span', { style: 'font-size:9px;font-weight:700;letter-spacing:.06em;color:#9aa8a0;text-transform:uppercase' }, 'Over'),
        inn.thisOver.map(ballChip), empties,
        h('span', { style: 'flex:1' }),
        lastWkt ? h('span', { style: 'font-size:10px;color:#6b7a72' }, 'Last wkt · ' + lastWkt.score + ' (ov ' + lastWkt.overs + ')') : null
      );

      function runCell(n) {
        var boundary = n === 4 || n === 6;
        return h('div', {
          style: 'border-radius:14px;background:' + (boundary ? '#e7f4ee;color:#12936a;' : '#fff;box-shadow:0 1px 2px rgba(20,40,30,.08);')
            + 'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;cursor:pointer;user-select:none;-webkit-tap-highlight-color:transparent',
          onclick: function () { api.dispatch('runs', { runs: n }); },
        },
          h('span', { style: 'font-family:\'DM Mono\',monospace;font-size:20px;font-weight:600' }, String(n)),
          boundary ? h('span', { style: 'font-size:8px;font-weight:700;letter-spacing:.12em' }, n === 4 ? 'FOUR' : 'SIX') : null
        );
      }
      var runGrid = h('div', { style: 'flex:1;min-height:0;display:grid;grid-template-columns:repeat(3,1fr);grid-auto-rows:1fr;gap:7px;padding:8px 13px 0' },
        [0, 1, 2, 3, 4, 6].map(runCell)
      );

      var outRow = h('div', { style: 'flex:none;display:flex;gap:7px;padding:8px 13px 0' },
        h('div', {
          style: 'flex:1.6;height:40px;border-radius:13px;background:#fdeceb;color:#d64f43;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;cursor:pointer;user-select:none',
          onclick: function () { api.dispatch('wicket'); },
        }, 'OUT'),
        h('div', {
          style: 'flex:1;height:40px;border-radius:13px;border:1.5px solid #e4e9e5;background:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;color:#46554d;cursor:pointer;user-select:none',
          onclick: function () { api.dispatch('swapStrike'); },
        }, '⇄ Strike')
      );

      function extraCell(label, onclick) {
        return h('div', {
          style: 'flex:1;height:36px;border-radius:12px;border:1.5px solid #e4e9e5;background:#fff;display:flex;align-items:center;justify-content:center;font-size:11.5px;font-weight:600;color:#46554d;cursor:pointer;user-select:none',
          onclick: onclick,
        }, label);
      }
      // 5th cell replaces the fragment's static "5/7" sample with the innings' real
      // bye/leg-bye tally (derived, not a control — nothing to dispatch for a plain count).
      var extrasRow = h('div', { style: 'flex:none;display:flex;gap:7px;padding:8px 13px 0' },
        extraCell('Wide', function () { api.dispatch('wide'); }),
        extraCell('No-ball', function () { api.dispatch('noball'); }),
        extraCell('Bye', function () { api.dispatch('bye'); }),
        extraCell('LB', function () { api.dispatch('legbye'); }),
        h('div', { style: 'flex:1;height:36px;border-radius:12px;border:1.5px solid #e4e9e5;background:#fff;display:flex;align-items:center;justify-content:center;font-size:11.5px;font-weight:600;color:#9aa8a0' },
          inn.extras.bye + '/' + inn.extras.legbye)
      );

      var bottomRow = h('div', { style: 'flex:none;display:flex;gap:7px;padding:8px 13px 0' },
        h('div', { style: 'width:64px;height:44px;border-radius:14px;background:#eef1ee;display:flex;align-items:center;justify-content:center;font-size:16px;color:#46554d;cursor:pointer', onclick: function () { api.undo(); } }, '↩'),
        h('div', { style: 'flex:1;height:44px;border-radius:14px;background:#12936a;color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;box-shadow:0 10px 18px -10px rgba(18,147,106,.7);cursor:pointer', onclick: function () { api.dispatch('endInnings'); } }, 'End innings ⋯')
      );

      var footer = h('div', { style: 'flex:none;display:flex;align-items:center;justify-content:space-between;padding:7px 15px calc(10px + env(safe-area-inset-bottom));font-size:11px;font-weight:700;color:#12936a' },
        h('span', { style: 'cursor:pointer', onclick: function () { api.nav('#/watch/' + match.id); } }, 'Full scorecard ›'),
        h('span', { style: 'color:#6b7a72;font-weight:600;cursor:pointer', onclick: function () { api.nav('#/watch/' + match.id); } },
          '👁 ' + (8 + match.events.length % 15) + ' · Share live ', h('span', { style: 'color:#12936a' }, '↗'))
      );

      el.appendChild(h('div', { style: 'flex:1;display:flex;flex-direction:column;background:#f4f6f3;color:#14201a' },
        header, scoreCard, overRow, runGrid, outRow, extrasRow, bottomRow, footer
      ));
    },

    /* ---------- spectator: 1:1 port of fragment 6a ---------- */
    renderSpectator: function (el, match) {
      var s = match.snapshot, cfg = match.config;
      var idx = s.inningsIdx;
      var inn = s.innings[idx];
      var inn1 = s.innings[0], inn2 = s.innings[1];
      var live = match.status === 'live';
      var activeTab = spectatorTab[match.id] || 'live';

      var kf = h('style', { html: '@keyframes geP{0%,100%{opacity:1}50%{opacity:.35}}' });

      function setTab(tab) { return function () { spectatorTab[match.id] = tab; SE.render(); }; }
      function tabCell(label, key) {
        var on = activeTab === key;
        return h('span', {
          style: 'flex:1;text-align:center;padding:6px 0;border-radius:10px;font-size:11.5px;cursor:pointer;'
            + (on ? 'background:#fff;font-weight:700;box-shadow:0 1px 2px rgba(20,40,30,.08)' : 'font-weight:600;color:#9aa8a0'),
          onclick: setTab(key),
        }, label);
      }

      var header = h('div', { style: 'flex:none;display:flex;align-items:center;justify-content:space-between;padding:12px 13px 8px' },
        h('a', { href: '#/home', style: 'width:32px;height:32px;border-radius:11px;background:#fff;box-shadow:0 1px 2px rgba(20,40,30,.08);display:flex;align-items:center;justify-content:center;font-size:16px;color:#14201a;text-decoration:none' }, '‹'),
        h('div', { style: 'display:flex;align-items:center;gap:7px' },
          h('span', { style: 'font-size:13px;font-weight:700' }, match.teams[0].name + ' vs ' + match.teams[1].name),
          live
            ? h('span', { style: 'display:inline-flex;align-items:center;gap:4px;font-size:9px;font-weight:700;color:#d64f43' },
              h('span', { style: 'width:5px;height:5px;border-radius:50%;background:#d64f43;animation:geP 1.4s infinite' }), 'LIVE')
            : h('span', { style: 'font-size:9px;font-weight:700;color:#6b7a72' }, 'FINAL')
        ),
        // decorative — no share integration in the prototype, so intentionally not a control
        h('div', { style: 'width:32px;height:32px;border-radius:11px;background:#fff;box-shadow:0 1px 2px rgba(20,40,30,.08);display:flex;align-items:center;justify-content:center;font-size:13px;color:#12936a' }, '↗')
      );

      var tabs = h('div', { style: 'flex:none;display:flex;background:#e7ece8;border-radius:12px;padding:2px;margin:0 13px' },
        tabCell('Live', 'live'), tabCell('Scorecard', 'scorecard'), tabCell('Graphs', 'graphs')
      );

      var scoreBlock = h('div', { style: 'background:#14201a;color:#fff;border-radius:18px;padding:12px 14px' },
        h('div', { style: 'display:flex;align-items:center;justify-content:space-between' },
          h('div', null,
            h('div', { style: 'font-size:10px;color:rgba(255,255,255,.6);font-weight:600' }, match.teams[0].name.toUpperCase()),
            h('div', { style: 'font-family:\'DM Mono\',monospace;font-size:24px;font-weight:500' }, String(inn1.runs), h('span', { style: 'opacity:.5;font-size:16px' }, '/' + inn1.wickets))
          ),
          idx === 1 ? h('div', { style: 'text-align:center' },
            h('div', { style: 'font-family:\'DM Mono\',monospace;font-size:9px;letter-spacing:.12em;color:#3fd598' }, 'CHASING'),
            h('div', { style: 'font-size:10px;color:rgba(255,255,255,.6);margin-top:2px' },
              inn2.runs >= s.target ? 'target reached' : 'need ' + Math.max(0, s.target - inn2.runs) + ' off ' + Math.max(0, totalBalls(cfg) - inn2.balls))
          ) : null,
          h('div', { style: 'text-align:right' },
            h('div', { style: 'font-size:10px;color:rgba(255,255,255,.6);font-weight:600' }, match.teams[1].name.toUpperCase()),
            inn2
              ? h('div', { style: 'font-family:\'DM Mono\',monospace;font-size:24px;font-weight:500;color:#3fd598' }, String(inn2.runs), h('span', { style: 'opacity:.5;font-size:16px' }, '/' + inn2.wickets))
              : h('div', { style: 'font-size:12px;color:#9aa8a0' }, 'yet to bat')
          )
        )
      );

      function momentumChart(bars, barHeight) {
        var maxRuns = Math.max(12, bars.reduce(function (m, b) { return Math.max(m, b.runs); }, 0));
        return h('div', { style: 'display:flex;align-items:flex-end;gap:3px;height:' + (barHeight || 44) + 'px' },
          bars.length ? bars.map(function (b) {
            var pct = Math.max(15, Math.round((b.runs / maxRuns) * 100));
            var style = 'flex:1;border-radius:2px 2px 0 0;height:' + pct + '%;';
            if (b.current) style += 'background:#e7ece8;outline:1.5px dashed #12936a;outline-offset:-1.5px';
            else if (b.wicket) style += 'background:#d64f43';
            else if (b.runs >= 6) style += 'background:#12936a';
            else style += 'background:#cfd8d1';
            return h('div', { style: style });
          }) : h('span', { style: 'font-size:12px;color:#9aa8a0' }, 'No overs bowled yet')
        );
      }

      var bars = momentumBars(inn);
      var rrLabel = idx === 1
        ? 'RRR ' + reqRunRate(s.target, inn2.runs, totalBalls(cfg), inn2.balls) + ' vs CRR ' + runRate(inn.runs, inn.balls)
        : 'CRR ' + runRate(inn.runs, inn.balls);

      var moments = keyMoments(match).slice(-3).reverse();
      function momentCard(m, i) {
        var color = m.kind === 'wicket' ? '#d64f43' : '#12936a';
        var lead = m.kind === 'wicket' ? 'WICKET' : (m.kind === 'six' ? 'SIX!' : 'FOUR!');
        return h('div', { style: 'background:#fff;border-radius:13px;padding:9px 12px;box-shadow:0 1px 3px rgba(20,40,30,.06);display:flex;gap:9px;align-items:center' + (i > 0 ? ';opacity:.65' : '') },
          h('span', { style: 'font-family:\'DM Mono\',monospace;font-size:9px;color:#9aa8a0;width:30px;flex:none' }, m.marker),
          h('span', { style: 'font-size:12px' }, h('b', { style: 'color:' + color }, lead), ' ' + m.label)
        );
      }

      var liveContent = [
        scoreBlock,
        h('div', { style: 'display:flex;align-items:center;justify-content:space-between' },
          h('span', { style: 'font-size:11px;font-weight:700;letter-spacing:.06em;color:#9aa8a0;text-transform:uppercase' }, 'Momentum · runs per over'),
          h('span', { style: 'font-family:\'DM Mono\',monospace;font-size:10px;color:#12936a' }, rrLabel)
        ),
        momentumChart(bars, 44),
        h('span', { style: 'font-size:11px;font-weight:700;letter-spacing:.06em;color:#9aa8a0;text-transform:uppercase' }, 'Key moments'),
        moments.length ? moments.map(momentCard) : h('div', { style: 'font-size:12px;color:#6b7a72' }, 'No boundaries or wickets yet'),
        h('div', { style: 'flex:1' }),
      ];

      // Scorecard/Graphs tabs have no reference mock (fragment 6a only depicts "Live"
      // selected) — rather than invent new visual language, they reuse this file's own
      // card/microlabel tokens.css components and the same derived match data.
      function inningsRow(teamInn, teamIdx) {
        if (!teamInn) return h('div', { class: 'card' },
          h('div', { class: 'microlabel' }, match.teams[teamIdx].name.toUpperCase()),
          h('div', { style: 'font-size:12px;color:#6b7a72;margin-top:4px' }, 'Yet to bat')
        );
        return h('div', { class: 'card' },
          h('div', { style: 'display:flex;justify-content:space-between;align-items:baseline' },
            h('div', { class: 'microlabel' }, match.teams[teamIdx].name.toUpperCase()),
            h('span', { style: 'font-family:\'DM Mono\',monospace;font-size:11px;color:#6b7a72' }, oversStr(teamInn.balls) + ' ov')
          ),
          h('div', { style: 'font-family:\'DM Mono\',monospace;font-size:22px;font-weight:600;margin-top:2px' }, teamInn.runs + '/' + teamInn.wickets),
          teamInn.fallOfWickets.length ? h('div', { style: 'margin-top:6px;font-size:11px;color:#6b7a72' },
            'Fall: ' + teamInn.fallOfWickets.map(function (w) { return w.score + ' (' + w.overs + ')'; }).join(', ')
          ) : null
        );
      }
      var scorecardContent = [inningsRow(inn1, 0), inningsRow(inn2, 1), h('div', { style: 'flex:1' })];

      var graphsContent = [
        h('span', { style: 'font-size:11px;font-weight:700;letter-spacing:.06em;color:#9aa8a0;text-transform:uppercase' }, 'Run rate by over'),
        momentumChart(bars, 120),
        h('div', { style: 'font-family:\'DM Mono\',monospace;font-size:11px;color:#6b7a72' }, rrLabel),
        h('div', { style: 'flex:1' }),
      ];

      var body = activeTab === 'scorecard' ? scorecardContent : activeTab === 'graphs' ? graphsContent : liveContent;
      var content = h('div', { style: 'flex:1;min-height:0;display:flex;flex-direction:column;padding:8px 13px 0;gap:8px;overflow:hidden' }, body);

      // Reaction/follow taps are local, session-only UI state (see spectatorReactions/
      // spectatorFollowed above) — they never touch match.snapshot; re-rendering via
      // SE.render() keeps the spectator screen read-only w.r.t. the match store.
      function reactionChip(emoji, key) {
        var base = 4 + (match.events.length % 9);
        var extra = (spectatorReactions[match.id] && spectatorReactions[match.id][key]) || 0;
        return h('span', {
          style: 'background:#fff;border-radius:99px;padding:6px 12px;font-size:12px;box-shadow:0 1px 3px rgba(20,40,30,.08);cursor:pointer;user-select:none',
          onclick: function () {
            spectatorReactions[match.id] = spectatorReactions[match.id] || {};
            spectatorReactions[match.id][key] = ((spectatorReactions[match.id][key]) || 0) + 1;
            SE.render();
          },
        }, emoji + ' ', h('span', { style: 'font-family:\'DM Mono\',monospace;font-size:10px;color:#6b7a72' }, String(base + extra)));
      }

      var followed = spectatorFollowed[match.id] !== false; // default followed
      var bottomBar = h('div', { style: 'flex:none;display:flex;align-items:center;gap:8px;padding:8px 13px 14px' },
        h('span', { style: 'font-size:10px;color:#9aa8a0;font-weight:600;flex:none' }, '👁 ' + (8 + match.events.length % 24)),
        h('div', { style: 'flex:1;display:flex;gap:6px' }, reactionChip('🔥', 'fire'), reactionChip('👏', 'clap')),
        h('span', {
          style: 'background:' + (followed ? '#12936a' : '#fff') + ';color:' + (followed ? '#fff' : '#46554d') + ';border:' + (followed ? 'none' : '1.5px solid #e4e9e5') + ';border-radius:99px;padding:6px 14px;font-size:11px;font-weight:700;flex:none;cursor:pointer',
          onclick: function () { spectatorFollowed[match.id] = !followed; SE.render(); },
        }, followed ? 'Following ✓' : 'Follow')
      );

      el.appendChild(h('div', { style: 'flex:1;display:flex;flex-direction:column;background:#f4f6f3;color:#14201a' },
        kf, header, tabs, content, bottomBar
      ));
    },
  });
})();
