/* Basketball: quarters, +1/+2/+3 scoring, team fouls with BONUS at 5, manual end (+ OT on tie).
   Reference: prototype/reference/screens/5c-basketball-scorer-refined.html
              prototype/reference/screens/6c-spectator-basketball-refined.html
   Scorer + spectator are 1:1 ports of fragments 5c/6c (see FIDELITY V2 in AGENT-BRIEF.md). */
(function () {
  'use strict';
  var h = SE.h;

  function periodLabel(p) {
    if (p <= 4) return 'Q' + p;
    return p === 5 ? 'OT' : 'OT' + (p - 4);
  }

  function remainingSecs(snap, cfg) {
    var total = cfg.quarterMinutes * 60;
    var elapsed = snap.elapsedMs + (snap.running ? (Date.now() - snap.startedAt) : 0);
    var rem = total - Math.floor(elapsed / 1000);
    return rem < 0 ? 0 : rem;
  }

  // single replay over the event log: current unanswered-points run (reset each
  // period), biggest lead so far + who held it, lead-change count, and the
  // point-by-point margin trail (for the spectator's lead bar chart)
  function matchActivity(match) {
    var pts = [0, 0];
    var runTeam = null, runPoints = 0;
    var biggestMargin = 0, biggestTeam = null;
    var lastLeader = null, leadChanges = 0;
    var history = [];
    match.events.forEach(function (ev) {
      if (ev.action === 'nextPeriod') { runTeam = null; runPoints = 0; return; }
      var n = ev.action === 'plus1' ? 1 : ev.action === 'plus2' ? 2 : ev.action === 'plus3' ? 3 : 0;
      if (!n) return;
      var team = ev.payload.team;
      pts[team] += n;
      if (runTeam === team) runPoints += n; else { runTeam = team; runPoints = n; }
      var diff = pts[0] - pts[1];
      history.push(diff);
      if (Math.abs(diff) > biggestMargin) { biggestMargin = Math.abs(diff); biggestTeam = diff > 0 ? 0 : 1; }
      var leader = diff > 0 ? 0 : (diff < 0 ? 1 : null);
      if (leader != null && lastLeader != null && leader !== lastLeader) leadChanges++;
      if (leader != null) lastLeader = leader;
    });
    return {
      run: (runTeam != null && runPoints >= 6) ? { team: runTeam, points: runPoints } : null,
      biggestMargin: biggestMargin, biggestTeam: biggestTeam, leadChanges: leadChanges, history: history,
    };
  }

  function scoreAction(n) {
    return function (snap, cfg, payload) {
      var team = payload.team;
      var points = snap.points.slice();
      points[team] += n;
      var periodPoints = snap.periodPoints.map(function (pp) { return pp.slice(); });
      periodPoints[snap.period - 1][team] += n;
      return {
        snap: Object.assign({}, snap, { points: points, periodPoints: periodPoints }),
        label: payload.name + ' +' + n
      };
    };
  }

  function noop(label) {
    return function (snap, cfg, payload) {
      return { snap: snap, label: (payload && payload.label) || label };
    };
  }

  var actions = {
    plus1: scoreAction(1),
    plus2: scoreAction(2),
    plus3: scoreAction(3),
    foul: function (snap, cfg, payload) {
      var fouls = snap.fouls.slice();
      fouls[payload.team] += 1;
      var label = payload.name + ' foul (' + fouls[payload.team] + ')' + (fouls[payload.team] >= 5 ? ' · BONUS' : '');
      return { snap: Object.assign({}, snap, { fouls: fouls }), label: label };
    },
    // real, team-scoped timeout: caps at 3 (the fragment's 3 T/O dots)
    timeout: function (snap, cfg, payload) {
      var team = payload.team;
      var timeouts = snap.timeouts.slice();
      if (timeouts[team] >= 3) return { snap: snap, label: payload.name + ' has no timeouts left' };
      timeouts[team] += 1;
      return { snap: Object.assign({}, snap, { timeouts: timeouts }), label: payload.name + ' timeout (' + timeouts[team] + '/3)' };
    },
    clockToggle: function (snap, cfg, payload) {
      var ts = payload;
      if (snap.running) {
        return {
          snap: Object.assign({}, snap, { running: false, elapsedMs: snap.elapsedMs + (ts - snap.startedAt), startedAt: null }),
          label: 'Clock paused'
        };
      }
      return { snap: Object.assign({}, snap, { running: true, startedAt: ts }), label: 'Clock started' };
    },
    nextPeriod: function (snap, cfg, payload) {
      var periodPoints = snap.periodPoints.map(function (pp) { return pp.slice(); });
      periodPoints.push([0, 0]);
      return {
        snap: Object.assign({}, snap, {
          period: snap.period + 1, fouls: [0, 0], timeouts: [0, 0], elapsedMs: 0, running: false, startedAt: null, periodPoints: periodPoints
        }),
        label: periodLabel(snap.period + 1) + ' underway'
      };
    },
    swapSides: function (snap) {
      return { snap: Object.assign({}, snap, { swapped: !snap.swapped }), label: '⇄ Sides swapped' };
    },
    // global footer pills with no natural team target — logged-only, like volleyball's timeout/rotate/libero
    foulCall: noop('Foul called'),
    freeThrowAwarded: noop('Free throw awarded'),
    timeoutCalled: noop('Timeout called'),
  };

  SE.registerSport({
    key: 'basketball', label: 'Basketball', icon: '🏀', priority: 6,
    tagline: 'quarters + fouls',
    sampleTeams: ['Hawks', 'Eagles'],
    defaultConfig: { quarterMinutes: 10 },
    setupFields: [
      { key: 'quarterMinutes', label: 'Quarter length', type: 'choice', options: [
        { label: '5 min', value: 5 }, { label: '8 min', value: 8 }, { label: '10 min', value: 10 }, { label: '12 min', value: 12 }
      ] }
    ],

    init: function (config) {
      return {
        points: [0, 0], fouls: [0, 0], timeouts: [0, 0], period: 1, periodPoints: [[0, 0]],
        elapsedMs: 0, running: false, startedAt: null, swapped: false
      };
    },

    actions: actions,

    isOver: function (snap, cfg) { return null; }, // manual end (with optional OT) only

    headline: function (m) {
      var s = m.snapshot;
      return s.points[0] + '–' + s.points[1] + ' · ' + periodLabel(s.period) + ' ' + SE.fmtClock(remainingSecs(s, m.config));
    },

    /* ---------- scorer: 1:1 port of fragment 5c ---------- */
    renderScorer: function (el, match, api) {
      var snap = match.snapshot, cfg = match.config;
      var names = [match.teams[0].name, match.teams[1].name];
      var activity = matchActivity(match);
      var order = snap.swapped ? [1, 0] : [0, 1];

      // fragment's geP pulse (run dot, live badge)
      var kf = h('style', { html: '@keyframes geP{0%,100%{opacity:1}50%{opacity:.35}}' });

      function iconBtn(content, onclick, size) {
        return h('div', {
          style: 'width:32px;height:32px;border-radius:11px;background:#fff;box-shadow:0 1px 2px rgba(20,40,30,.08);display:flex;align-items:center;justify-content:center;font-size:' + (size || 16) + 'px;cursor:pointer',
          onclick: onclick,
        }, content);
      }

      function scoreBtn(team, n) {
        var mid = n === 2;
        return h('div', {
          style: 'flex:1;height:42px;border-radius:12px;' +
            (mid ? 'background:#e7f4ee;color:#12936a;font-weight:600;' : 'background:#fff;box-shadow:0 1px 2px rgba(20,40,30,.08);') +
            'display:flex;align-items:center;justify-content:center;font-family:\'DM Mono\',monospace;font-size:15px;cursor:pointer;user-select:none',
          onclick: function () { api.dispatch('plus' + n, { team: team, name: names[team] }); },
        }, '+' + n);
      }

      function timeoutDots(team) {
        var used = snap.timeouts[team];
        var dots = [];
        for (var i = 0; i < 3; i++) {
          dots.push(h('span', { style: 'width:5px;height:5px;border-radius:50%;' + (i < used ? 'background:#12936a' : 'border:1px solid #b3bdb6') }));
        }
        return dots;
      }

      function teamPanel(team) {
        var pts = snap.points[team];
        var fouls = snap.fouls[team];
        var bonus = fouls >= 5;
        var leading = pts > snap.points[1 - team];
        var onRun = activity.run && activity.run.team === team;
        return h('div', {
          style: 'flex:1;min-width:0;display:flex;flex-direction:column;'
            + (team === (snap.swapped ? 1 : 0) ? 'border-right:1px solid rgba(20,32,26,.1);' : ''),
        },
          h('div', {
            style: 'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;'
              + (leading ? 'background:linear-gradient(180deg,rgba(18,147,106,.07),rgba(18,147,106,0));' : ''),
          },
            h('span', { style: 'font-family:\'DM Mono\',monospace;font-size:10px;letter-spacing:.14em;color:#6b7a72' }, names[team].toUpperCase()),
            h('span', { style: 'font-family:\'DM Mono\',monospace;font-size:60px;font-weight:500;line-height:1;font-variant-numeric:tabular-nums' }, String(pts)),
            onRun
              ? h('span', { style: 'display:inline-flex;align-items:center;gap:5px;font-family:\'DM Mono\',monospace;font-size:10px;color:#12936a;font-weight:600' },
                  h('span', { style: 'width:5px;height:5px;border-radius:50%;background:#12936a;animation:geP 1.2s infinite' }),
                  activity.run.points + '–0 RUN')
              : h('span', { style: 'font-family:\'DM Mono\',monospace;font-size:10px;font-weight:600;color:' + (fouls ? '#c47d12' : '#9aa8a0') },
                  fouls + ' TEAM FOUL' + (fouls === 1 ? '' : 'S')),
            h('div', {
              style: 'display:flex;gap:4px;align-items:center;cursor:pointer',
              onclick: function () { api.dispatch('timeout', { team: team, name: names[team] }); },
            },
              timeoutDots(team),
              h('span', { style: 'font-size:9px;color:#9aa8a0;margin-left:2px' }, 'T/O'),
              h('span', {
                style: 'font-size:9px;color:#9aa8a0;margin-left:6px;cursor:pointer',
                onclick: function (e) { e.stopPropagation(); api.dispatch('foul', { team: team, name: names[team] }); },
              }, bonus ? 'BONUS ⚠' : ('FOULS ' + fouls))
            )
          ),
          h('div', { style: 'flex:none;display:flex;gap:6px;padding:0 10px 10px' }, scoreBtn(team, 1), scoreBtn(team, 2), scoreBtn(team, 3))
        );
      }

      function pill(label, onclick) {
        return h('div', {
          style: 'flex:1;height:36px;border-radius:12px;border:1.5px solid #e4e9e5;background:#fff;display:flex;align-items:center;justify-content:center;font-size:11.5px;font-weight:600;color:#46554d;cursor:pointer;user-select:none',
          onclick: onclick,
        }, label);
      }

      function primaryBtn(label, onclick, style) {
        return h('div', { style: (style || 'flex:1;') + 'height:44px;border-radius:14px;background:#12936a;color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;box-shadow:0 10px 18px -10px rgba(18,147,106,.7);cursor:pointer', onclick: onclick }, label);
      }

      function secondaryBtn(label, onclick) {
        return h('div', { style: 'flex:1;height:44px;border-radius:14px;border:1.5px solid #e4e9e5;background:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#46554d;cursor:pointer', onclick: onclick }, label);
      }

      function periodStatLine() {
        var maxP = Math.max(4, snap.periodPoints.length);
        var cols = [];
        for (var i = 0; i < maxP; i++) {
          var pp = snap.periodPoints[i];
          var isCurrent = (i + 1) === snap.period;
          if (i > 0) cols.push(h('span', { style: 'color:#dfe7e1' }, '|'));
          cols.push(h('span', { style: 'color:' + (isCurrent ? '#14201a;font-weight:500' : '#9aa8a0') },
            periodLabel(i + 1) + ' ' + (pp ? (pp[0] + '–' + pp[1]) : '—')));
        }
        cols.push(h('span', { style: 'color:#dfe7e1' }, '|'));
        cols.push(h('span', null, 'LEAD ±' + activity.biggestMargin + ' MAX'));
        return h('div', { style: 'flex:none;display:flex;align-items:center;justify-content:center;gap:12px;padding:8px 14px 0;font-family:\'DM Mono\',monospace;font-size:10px;color:#9aa8a0;flex-wrap:wrap' }, cols);
      }

      function endMatch() {
        var s = snap;
        var winner = s.points[0] === s.points[1] ? null : (s.points[0] > s.points[1] ? 0 : 1);
        var summary = winner != null
          ? names[winner] + ' won ' + Math.max(s.points[0], s.points[1]) + '–' + Math.min(s.points[0], s.points[1])
          : names[0] + ' tied ' + names[1] + ' ' + s.points[0] + '–' + s.points[1];
        api.end({ summary: summary, winnerIndex: winner });
      }

      var subDiv = h('div', { style: 'font-family:\'DM Mono\',monospace;font-size:9px;letter-spacing:.08em;color:#6b7a72;margin-top:1px' },
        (snap.running ? '⏸ ' : '▶ ') + periodLabel(snap.period) + ' · ' + SE.fmtClock(remainingSecs(snap, cfg)));
      SE.interval(function () {
        subDiv.textContent = (match.snapshot.running ? '⏸ ' : '▶ ') + periodLabel(match.snapshot.period) + ' · ' + SE.fmtClock(remainingSecs(match.snapshot, cfg));
      }, 1000);

      var tied = snap.points[0] === snap.points[1];
      var footer;
      if (snap.period < 4) {
        footer = primaryBtn('End ' + periodLabel(snap.period) + ' ✓', function () { api.dispatch('nextPeriod'); });
      } else if (tied) {
        footer = h('div', { style: 'flex:1;display:flex;gap:8px' },
          secondaryBtn('Start ' + periodLabel(snap.period + 1), function () { api.dispatch('nextPeriod'); }),
          primaryBtn('End (tie)', endMatch)
        );
      } else {
        footer = primaryBtn('End match ✓', endMatch);
      }

      el.appendChild(h('div', { style: 'flex:1;display:flex;flex-direction:column;background:#f4f6f3;color:#14201a' },
        kf,
        // header: back · title/clock (tap to start/pause) · box score
        h('div', { style: 'flex:none;display:flex;align-items:center;justify-content:space-between;padding:12px 13px 8px' },
          iconBtn('‹', function () { api.nav('#/home'); }),
          h('div', { style: 'text-align:center;cursor:pointer', onclick: function () { api.dispatch('clockToggle', Date.now()); } },
            h('div', { style: 'font-size:13px;font-weight:700' }, names[0] + ' vs ' + names[1]),
            subDiv
          ),
          iconBtn('≣', function () { api.nav('#/watch/' + match.id); }, 13)
        ),
        // the two giant score halves
        h('div', { style: 'flex:1;min-height:0;display:flex;border-top:1px solid rgba(20,32,26,.1)' },
          teamPanel(order[0]), teamPanel(order[1])
        ),
        // per-quarter line + biggest lead
        periodStatLine(),
        // action pills: Foul · Free throw · Timeout · Swap
        h('div', { style: 'flex:none;display:flex;gap:7px;padding:8px 13px 0' },
          pill('Foul', function () { api.dispatch('foulCall'); }),
          pill('Free throw', function () { api.dispatch('freeThrowAwarded'); }),
          pill('Timeout', function () { api.dispatch('timeoutCalled'); }),
          pill('⇄ Swap', function () { api.dispatch('swapSides'); })
        ),
        // undo + end quarter/match
        h('div', { style: 'flex:none;display:flex;gap:7px;padding:8px 13px 0' },
          h('div', { style: 'width:64px;height:44px;border-radius:14px;background:#eef1ee;display:flex;align-items:center;justify-content:center;font-size:16px;color:#46554d;cursor:pointer', onclick: function () { api.undo(); } }, '↩'),
          footer
        ),
        // footer: box score link · share live
        h('div', { style: 'flex:none;display:flex;align-items:center;justify-content:space-between;padding:7px 15px calc(10px + env(safe-area-inset-bottom));font-size:11px;font-weight:700;color:#12936a' },
          h('span', { style: 'cursor:pointer', onclick: function () { api.nav('#/watch/' + match.id); } }, 'Box score ›'),
          h('span', { style: 'color:#6b7a72;font-weight:600;cursor:pointer', onclick: function () { api.nav('#/watch/' + match.id); } },
            '👁 ' + (3 + match.events.length % 9) + ' · Share live ', h('span', { style: 'color:#12936a' }, '↗'))
        )
      ));
    },

    /* ---------- spectator: 1:1 port of fragment 6c ---------- */
    renderSpectator: function (el, match) {
      var snap = match.snapshot, cfg = match.config;
      var names = [match.teams[0].name, match.teams[1].name];
      var activity = matchActivity(match);
      var leading = snap.points[0] === snap.points[1] ? null : (snap.points[0] > snap.points[1] ? 0 : 1);

      var kf = h('style', { html: '@keyframes geP{0%,100%{opacity:1}50%{opacity:.35}}' });

      function iconBtn(content, onclick, size, color) {
        return h('div', {
          style: 'width:32px;height:32px;border-radius:11px;background:#fff;box-shadow:0 1px 2px rgba(20,40,30,.08);display:flex;align-items:center;justify-content:center;font-size:' + (size || 16) + 'px;' + (color ? 'color:' + color + ';' : '') + 'cursor:pointer',
          onclick: onclick,
        }, content);
      }

      function marginBars() {
        var hist = activity.history.slice(-10);
        if (!hist.length) return h('div', { style: 'font-size:11px;color:#9aa8a0;text-align:center;padding:14px 0' }, 'No plays yet');
        var max = Math.max.apply(null, hist.map(Math.abs)) || 1;
        var n = hist.length;
        var bars = hist.map(function (diff, i) {
          var pct = Math.min(48, Math.round((Math.abs(diff) / max) * 48)) || 1;
          var isLast = i === n - 1;
          return h('div', { style: 'position:absolute;left:' + Math.round(i * (100 / n)) + '%;width:' + Math.round((100 / n) - 1) + '%;height:' + pct + '%;background:' + (diff > 0 ? '#12936a' : '#b8862e') + ';' + (diff > 0 ? 'bottom' : 'top') + ':50%;' + (isLast ? 'animation:geP 1.4s infinite' : '') });
        });
        return h('div', { style: 'position:relative;height:44px' },
          h('div', { style: 'position:absolute;left:0;right:0;top:50%;height:1px;background:#cfd8d1' }),
          bars
        );
      }

      function periodCard() {
        var maxP = Math.max(4, snap.periodPoints.length);
        var cells = [];
        for (var i = 0; i < maxP; i++) {
          var pp = snap.periodPoints[i];
          var isCurrent = (i + 1) === snap.period;
          cells.push(h('div', { style: 'flex:1;' + (i > 0 ? 'border-left:1px solid #eef1ee;' : '') + (!pp ? 'color:#b3bdb6' : '') },
            h('div', { style: 'font-size:8px;color:#9aa8a0' }, periodLabel(i + 1)),
            h('div', { style: isCurrent ? 'color:#12936a;font-weight:500' : '' }, pp ? (pp[0] + '–' + pp[1]) : '—')
          ));
        }
        return h('div', { style: 'background:#fff;border-radius:13px;box-shadow:0 1px 3px rgba(20,40,30,.06);display:flex;padding:8px 0;text-align:center;font-family:\'DM Mono\',monospace;font-size:11px' }, cells);
      }

      var recent = match.events.slice(-4).reverse();
      var feed = recent.length
        ? recent.map(function (ev) {
            return h('div', { style: 'background:#fff;border-radius:13px;padding:9px 12px;box-shadow:0 1px 3px rgba(20,40,30,.06);display:flex;gap:9px;align-items:center' },
              h('span', { style: 'font-family:\'DM Mono\',monospace;font-size:9px;color:#9aa8a0;width:34px;flex:none' },
                new Date(ev.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
              h('span', { style: 'font-size:12px' }, ev.label)
            );
          })
        : [h('div', { style: 'font-size:12px;color:#9aa8a0;text-align:center;padding:8px' }, 'No plays yet')];

      el.appendChild(h('div', { style: 'flex:1;display:flex;flex-direction:column;background:#f4f6f3;color:#14201a' },
        kf,
        // header: back · matchup + LIVE/FINAL · share
        h('div', { style: 'flex:none;display:flex;align-items:center;justify-content:space-between;padding:12px 13px 8px' },
          iconBtn('‹', function () { SE.nav('#/home'); }),
          h('div', { style: 'display:flex;align-items:center;gap:7px' },
            h('span', { style: 'font-size:13px;font-weight:700' }, names[0] + ' vs ' + names[1]),
            match.status === 'live'
              ? h('span', { style: 'display:inline-flex;align-items:center;gap:4px;font-size:9px;font-weight:700;color:#d64f43' },
                  h('span', { style: 'width:5px;height:5px;border-radius:50%;background:#d64f43;animation:geP 1.4s infinite' }), 'LIVE')
              : h('span', { style: 'font-size:9px;font-weight:700;color:#9aa8a0' }, 'FINAL')
          ),
          iconBtn('↗', null, 13, '#12936a')
        ),
        // decorative tab strip (Live is the only implemented view)
        h('div', { style: 'flex:none;display:flex;background:#e7ece8;border-radius:12px;padding:2px;margin:0 13px' },
          h('span', { style: 'flex:1;text-align:center;padding:6px 0;border-radius:10px;background:#fff;font-size:11.5px;font-weight:700;box-shadow:0 1px 2px rgba(20,40,30,.08)' }, 'Live'),
          h('span', { style: 'flex:1;text-align:center;padding:6px 0;font-size:11.5px;font-weight:600;color:#9aa8a0' }, 'Scorecard'),
          h('span', { style: 'flex:1;text-align:center;padding:6px 0;font-size:11.5px;font-weight:600;color:#9aa8a0' }, 'Graphs')
        ),
        h('div', { style: 'flex:1;min-height:0;display:flex;flex-direction:column;padding:8px 13px 0;gap:8px;overflow:hidden' },
          // scoreboard
          h('div', { style: 'background:#14201a;color:#fff;border-radius:18px;padding:12px 14px;display:flex;align-items:center;justify-content:space-between' },
            h('div', null,
              h('div', { style: 'font-size:10px;color:rgba(255,255,255,.6);font-weight:600' }, names[0].toUpperCase()),
              h('div', { style: 'font-family:\'DM Mono\',monospace;font-size:28px;font-weight:500;color:' + (leading === 0 ? '#3fd598' : '#fff') }, String(snap.points[0]))
            ),
            h('div', { style: 'text-align:center' },
              h('div', { style: 'font-family:\'DM Mono\',monospace;font-size:10px;color:rgba(255,255,255,.5)' }, periodLabel(snap.period) + ' · ' + SE.fmtClock(remainingSecs(snap, cfg))),
              activity.run ? h('div', { style: 'font-family:\'DM Mono\',monospace;font-size:9px;color:#3fd598;margin-top:3px' }, activity.run.points + '–0 RUN') : null
            ),
            h('div', { style: 'text-align:right' },
              h('div', { style: 'font-size:10px;color:rgba(255,255,255,.6);font-weight:600' }, names[1].toUpperCase()),
              h('div', { style: 'font-family:\'DM Mono\',monospace;font-size:28px;font-weight:500;color:' + (leading === 1 ? '#3fd598' : '#fff') }, String(snap.points[1]))
            )
          ),
          match.status === 'done' && match.result ? h('div', { style: 'background:#e7f4ee;color:#0d6b4e;border-radius:12px;padding:10px 12px;font-size:12px;font-weight:700;text-align:center' }, match.result.summary) : null,
          // lead tracker + margin bar chart
          h('div', { style: 'display:flex;align-items:center;justify-content:space-between' },
            h('span', { style: 'font-size:11px;font-weight:700;letter-spacing:.06em;color:#9aa8a0;text-transform:uppercase' }, 'Lead tracker'),
            h('span', { style: 'font-family:\'DM Mono\',monospace;font-size:10px;color:#12936a' },
              activity.biggestMargin ? ('BIGGEST: ' + names[activity.biggestTeam][0].toUpperCase() + ' +' + activity.biggestMargin) : 'EVEN')
          ),
          marginBars(),
          // per-quarter card
          periodCard(),
          // recent plays feed
          feed,
          h('div', { style: 'flex:1' })
        ),
        // footer: viewer count · reactions · following
        h('div', { style: 'flex:none;display:flex;align-items:center;gap:8px;padding:8px 13px 14px' },
          h('span', { style: 'font-size:10px;color:#9aa8a0;font-weight:600;flex:none' }, '👁 ' + (3 + match.events.length % 9)),
          h('div', { style: 'flex:1;display:flex;gap:6px' },
            h('span', { style: 'background:#fff;border-radius:99px;padding:6px 12px;font-size:12px;box-shadow:0 1px 3px rgba(20,40,30,.08)' }, '🔥 ', h('span', { style: 'font-family:\'DM Mono\',monospace;font-size:10px;color:#6b7a72' }, String(8 + match.events.length % 7))),
            h('span', { style: 'background:#fff;border-radius:99px;padding:6px 12px;font-size:12px;box-shadow:0 1px 3px rgba(20,40,30,.08)' }, '👏 ', h('span', { style: 'font-family:\'DM Mono\',monospace;font-size:10px;color:#6b7a72' }, String(3 + match.events.length % 5)))
          ),
          h('span', { style: 'background:#12936a;color:#fff;border-radius:99px;padding:6px 14px;font-size:11px;font-weight:700;flex:none' }, 'Following ✓')
        )
      ));
    },
  });
})();
