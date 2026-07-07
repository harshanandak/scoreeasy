/* Kabaddi sport def: raid points, 30s raid clock (display-only), football-style half clock.
   Scorer/spectator are 1:1 ports of reference fragments 5e/6e (clean instrument). */
(function () {
  'use strict';
  var h = SE.h;
  var MAT_SIZE = 7;
  var RAID_SECS = 30;

  function copySnap(snap) {
    return {
      points: snap.points.slice(),
      onMat: snap.onMat.slice(),
      half: snap.half,
      running: snap.running,
      clockStartTs: snap.clockStartTs,
      elapsedMs: snap.elapsedMs,
      raidingTeam: snap.raidingTeam,
      raidStartedTs: snap.raidStartedTs,
    };
  }

  function endRaid(s) { s.raidStartedTs = null; s.raidingTeam = 1 - s.raidingTeam; }
  function teamTag(i) { return i === 0 ? 'Team 1' : 'Team 2'; }

  function elapsedSecs(s) {
    var ms = s.elapsedMs + (s.running ? Date.now() - s.clockStartTs : 0);
    return ms / 1000;
  }
  function raidRemaining(s) {
    if (!s.raidStartedTs) return RAID_SECS;
    return Math.max(0, RAID_SECS - Math.floor((Date.now() - s.raidStartedTs) / 1000));
  }
  function computeResult(snap, teams) {
    var a = snap.points[0], b = snap.points[1];
    if (a === b) return { summary: teams[0].name + ' drew with ' + teams[1].name + ' ' + a + '–' + b, winnerIndex: null };
    var w = a > b ? 0 : 1, l = 1 - w;
    return { summary: teams[w].name + ' won ' + snap.points[w] + '–' + snap.points[l], winnerIndex: w };
  }

  // 32px white rounded icon button (exemplar's header chrome — see volleyball.js renderScorer)
  function iconBtn(content, onclick, size) {
    return h('div', {
      style: 'width:32px;height:32px;border-radius:11px;background:#fff;box-shadow:0 1px 2px rgba(20,40,30,.08);display:flex;align-items:center;justify-content:center;font-size:' + (size || 16) + 'px;cursor:pointer',
      onclick: onclick,
    }, content);
  }

  // actions that end a raid and flip who's raiding — used to reconstruct raider
  // identity per past event for the spectator's raid log/dots (nothing in the
  // event itself records who was raiding when it happened).
  var RAID_END_ACTIONS = { raidPoint: 1, bonus: 1, tackle: 1, superTackle: 1, allOut: 1, emptyRaid: 1 };
  function raidHistory(match) {
    var raider = 0;
    var log = [];
    match.events.forEach(function (ev) {
      if (RAID_END_ACTIONS[ev.action]) {
        log.push({ action: ev.action, label: ev.label, ts: ev.ts, raider: raider });
        raider = 1 - raider;
      } else if (ev.action === 'switchRaid') {
        raider = 1 - raider;
      }
    });
    return log;
  }

  var ACTIONS = {
    startRaid: function (snap, cfg, payload) {
      var s = copySnap(snap);
      s.raidStartedTs = payload || Date.now();
      return { snap: s, label: 'Raid on' };
    },
    raidPoint: function (snap, cfg, payload) {
      var s = copySnap(snap);
      var touches = payload || 1;
      var raider = s.raidingTeam, def = 1 - raider;
      s.points[raider] += touches;
      s.onMat[def] = Math.max(0, s.onMat[def] - touches);
      var label = teamTag(raider) + ' raid +' + touches;
      endRaid(s);
      return { snap: s, label: label };
    },
    bonus: function (snap, cfg, payload) {
      var s = copySnap(snap);
      var raider = s.raidingTeam;
      s.points[raider] += 1;
      var label = teamTag(raider) + ' bonus +1';
      endRaid(s);
      return { snap: s, label: label };
    },
    tackle: function (snap, cfg, payload) {
      var s = copySnap(snap);
      var raider = s.raidingTeam, def = 1 - raider;
      s.points[def] += 1;
      s.onMat[raider] = Math.max(0, s.onMat[raider] - 1);
      var label = teamTag(def) + ' tackle +1';
      endRaid(s);
      return { snap: s, label: label };
    },
    superTackle: function (snap, cfg, payload) {
      var s = copySnap(snap);
      var raider = s.raidingTeam, def = 1 - raider;
      s.points[def] += 2;
      s.onMat[raider] = Math.max(0, s.onMat[raider] - 1);
      var label = teamTag(def) + ' super tackle +2';
      endRaid(s);
      return { snap: s, label: label };
    },
    allOut: function (snap, cfg, payload) {
      var s = copySnap(snap);
      var raider = s.raidingTeam, def = 1 - raider;
      // whichever side is more depleted is the side that's "out"; ties default to the defense.
      var outTeam = s.onMat[def] <= s.onMat[raider] ? def : raider;
      var winner = 1 - outTeam;
      s.points[winner] += 2;
      s.onMat[outTeam] = MAT_SIZE;
      var label = teamTag(winner) + ' all out +2';
      endRaid(s);
      return { snap: s, label: label };
    },
    emptyRaid: function (snap, cfg, payload) {
      var s = copySnap(snap);
      var label = teamTag(s.raidingTeam) + ' empty raid';
      endRaid(s);
      return { snap: s, label: label };
    },
    clockToggle: function (snap, cfg, payload) {
      var s = copySnap(snap);
      var now = payload || Date.now();
      if (s.running) { s.elapsedMs += now - s.clockStartTs; s.running = false; s.clockStartTs = null; }
      else { s.running = true; s.clockStartTs = now; }
      return { snap: s, label: s.running ? 'Clock started' : 'Clock paused' };
    },
    nextHalf: function (snap, cfg, payload) {
      var s = copySnap(snap);
      var now = payload || Date.now();
      if (s.running) { s.elapsedMs += now - s.clockStartTs; s.running = false; s.clockStartTs = null; }
      if (s.half < 2) { s.half += 1; s.elapsedMs = 0; }
      return { snap: s, label: 'Half-time' };
    },
    // referee-style manual correction: hand the raid to the other side without scoring.
    switchRaid: function (snap, cfg, payload) {
      var s = copySnap(snap);
      var label = 'Switch raid to ' + teamTag(1 - s.raidingTeam);
      s.raidStartedTs = null;
      s.raidingTeam = 1 - s.raidingTeam;
      return { snap: s, label: label };
    },
    // soft action — no state change, just lands in the event feed.
    timeout: function (snap, cfg, payload) {
      var s = copySnap(snap);
      return { snap: s, label: 'Timeout' };
    },
  };

  SE.registerSport({
    key: 'kabaddi', label: 'Kabaddi', icon: '🤼', priority: 5,
    tagline: 'raid & tackle',
    sampleTeams: ['Panthers', 'Tigers'],
    defaultConfig: { halfMinutes: 20 },
    setupFields: [
      { key: 'halfMinutes', label: 'Half length', type: 'choice', options: [
        { label: '10 min', value: 10 }, { label: '15 min', value: 15 }, { label: '20 min', value: 20 }
      ] },
    ],

    init: function (config) {
      return {
        points: [0, 0],
        onMat: [MAT_SIZE, MAT_SIZE],
        half: 1,
        running: false,
        clockStartTs: null,
        elapsedMs: 0,
        raidingTeam: 0,
        raidStartedTs: null,
      };
    },

    actions: ACTIONS,

    isOver: function (snap, cfg) { return null; }, // manual end only

    headline: function (m) {
      var s = m.snapshot;
      return s.points[0] + '–' + s.points[1] + ' · ' + (s.half === 1 ? '1st' : '2nd') + ' half';
    },

    /* ---------- scorer: 1:1 port of fragment 5e ---------- */
    renderScorer: function (el, match, api) {
      var snap = match.snapshot, cfg = match.config, teams = match.teams;
      var raider = snap.raidingTeam;

      var header = h('div', { style: 'flex:none;display:flex;align-items:center;justify-content:space-between;padding:2px 13px 8px' },
        iconBtn('‹', function () { api.nav('#/home'); }),
        h('div', { style: 'text-align:center' },
          h('div', { style: 'font-size:13px;font-weight:700' }, teams[0].name + ' vs ' + teams[1].name),
          (function () {
            var clockSpan = h('span', null, SE.fmtClock(elapsedSecs(snap)));
            SE.interval(function () { clockSpan.textContent = SE.fmtClock(elapsedSecs(snap)); }, 1000);
            return h('div', { style: 'font-family:\'DM Mono\',monospace;font-size:9px;letter-spacing:.08em;color:#6b7a72;margin-top:1px' },
              (snap.half === 1 ? '1ST HALF' : '2ND HALF') + ' · ', clockSpan, ' · ' + cfg.halfMinutes + '-MIN HALVES'
            );
          })()
        ),
        iconBtn('≣', function () { api.nav('#/watch/' + match.id); }, 13)
      );

      function teamPanel(i) {
        var isRaiding = raider === i;
        var dots = [];
        for (var d = 0; d < MAT_SIZE; d++) {
          dots.push(h('span', { style: 'width:6px;height:6px;border-radius:50%;' +
            (d < snap.onMat[i] ? 'background:#12936a' : 'border:1px solid #b3bdb6') }));
        }
        return h('div', { style: 'text-align:center' },
          h('div', { style: 'font-family:\'DM Mono\',monospace;font-size:10px;letter-spacing:.12em;color:#6b7a72' }, teams[i].name.toUpperCase()),
          h('div', { style: 'font-family:\'DM Mono\',monospace;font-size:42px;font-weight:500;line-height:1.1;font-variant-numeric:tabular-nums;' + (isRaiding ? '' : 'color:#6b7a72') }, String(snap.points[i])),
          h('div', { style: 'display:flex;gap:3px;justify-content:center;margin-top:4px' }, dots),
          h('div', { style: 'font-size:9px;color:#9aa8a0;margin-top:3px' }, snap.onMat[i] + ' on mat')
        );
      }

      var remaining0 = snap.raidStartedTs ? raidRemaining(snap) : RAID_SECS;
      var pct0 = Math.round((remaining0 / RAID_SECS) * 100);
      var raidNumEl = h('span', { style: 'font-family:\'DM Mono\',monospace;font-size:22px;font-weight:500;line-height:1' }, String(remaining0));
      var raidLabelEl = h('span', { style: 'font-size:8px;font-weight:700;letter-spacing:.1em;color:#12936a' },
        snap.raidStartedTs ? 'RAID ON' : 'TAP TO RAID');
      var raidCircle = h('div', {
        style: 'width:80px;height:80px;flex-shrink:0;border-radius:50%;background:conic-gradient(#12936a 0 ' + pct0 + '%, #e7ece8 ' + pct0 + '% 100%);display:flex;align-items:center;justify-content:center;box-shadow:0 8px 16px -10px rgba(18,147,106,.5);cursor:pointer',
        onclick: function () { if (!snap.raidStartedTs) api.dispatch('startRaid', Date.now()); },
      }, h('div', { style: 'width:64px;height:64px;border-radius:50%;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center' }, raidNumEl, raidLabelEl));
      if (snap.raidStartedTs) {
        SE.interval(function () {
          var remaining = raidRemaining(snap);
          raidNumEl.textContent = String(remaining);
          raidCircle.style.background = 'conic-gradient(#12936a 0 ' + Math.round((remaining / RAID_SECS) * 100) + '%, #e7ece8 ' + Math.round((remaining / RAID_SECS) * 100) + '% 100%)';
        }, 250);
      }

      var defIdx = 1 - raider;
      var doOrDie = snap.onMat[raider] <= 3;
      var banner = h('div', { style: 'flex:none;text-align:center;font-size:11px;font-weight:700;color:#12936a;padding:0 0 4px' },
        teams[raider].name + ' is raiding → ' + teams[defIdx].name + "'s half",
        doOrDie ? h('span', { style: 'color:#6b7a72;font-weight:600' }, ' · do-or-die') : null
      );

      function gridCell(bg, color, boxShadow, big, small, onclick) {
        return h('div', {
          style: 'border-radius:14px;background:' + bg + ';' + (color ? 'color:' + color + ';' : '') +
            (boxShadow ? 'box-shadow:' + boxShadow + ';' : '') + 'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;cursor:pointer',
          onclick: onclick,
        },
          h('span', { style: 'font-family:\'DM Mono\',monospace;font-size:20px;font-weight:600' }, big),
          h('span', { style: 'font-size:8px;font-weight:700;letter-spacing:.12em' }, small)
        );
      }
      var grid = h('div', { style: 'flex:1;min-height:0;display:grid;grid-template-columns:1fr 1fr;grid-auto-rows:1fr;gap:7px;padding:4px 13px 0' },
        gridCell('#e7f4ee', '#12936a', null, '+1', 'RAID POINT', function () { api.dispatch('raidPoint', 1); }),
        gridCell('#fff', null, '0 1px 2px rgba(20,40,30,.08)', '+1', 'TACKLE', function () { api.dispatch('tackle'); }),
        gridCell('#fff', null, '0 1px 2px rgba(20,40,30,.08)', '+1', 'BONUS', function () { api.dispatch('bonus'); }),
        gridCell('#fff', null, '0 1px 2px rgba(20,40,30,.08)', '+2', 'SUPER TACKLE', function () { api.dispatch('superTackle'); })
      );

      var row2 = h('div', { style: 'flex:none;display:flex;gap:7px;padding:8px 13px 0' },
        h('div', { style: 'flex:1;height:38px;border-radius:13px;background:#fdeceb;color:#d64f43;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;cursor:pointer',
          onclick: function () { api.dispatch('allOut'); } }, 'All out +2'),
        h('div', { style: 'flex:1;height:38px;border-radius:13px;border:1.5px solid #e4e9e5;background:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;color:#46554d;cursor:pointer',
          onclick: function () { api.dispatch('emptyRaid'); } }, 'Empty raid')
      );

      function pill3(label, onclick) {
        return h('div', {
          style: 'flex:1;height:36px;border-radius:12px;border:1.5px solid #e4e9e5;background:#fff;display:flex;align-items:center;justify-content:center;font-size:11.5px;font-weight:600;color:#46554d;cursor:pointer',
          onclick: onclick,
        }, label);
      }
      var row3 = h('div', { style: 'flex:none;display:flex;gap:7px;padding:8px 13px 0' },
        pill3('⇄ Switch raid', function () { api.dispatch('switchRaid'); }),
        pill3(snap.running ? '⏸ Pause' : '▶ Resume', function () { api.dispatch('clockToggle', Date.now()); }),
        pill3('Time out', function () { api.dispatch('timeout'); })
      );

      var primaryBtn = snap.half === 1
        ? h('div', { style: 'flex:1;height:44px;border-radius:14px;background:#12936a;color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;box-shadow:0 10px 18px -10px rgba(18,147,106,.7);cursor:pointer',
            onclick: function () { api.dispatch('nextHalf', Date.now()); } }, 'Half-time ✓')
        : h('div', { style: 'flex:1;height:44px;border-radius:14px;background:#12936a;color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;box-shadow:0 10px 18px -10px rgba(18,147,106,.7);cursor:pointer',
            onclick: function () { api.end(computeResult(snap, teams)); } }, 'End match');
      var bottomRow = h('div', { style: 'flex:none;display:flex;gap:7px;padding:8px 13px 0' },
        h('div', { style: 'width:64px;height:44px;border-radius:14px;background:#eef1ee;display:flex;align-items:center;justify-content:center;font-size:16px;color:#46554d;cursor:pointer',
          onclick: function () { api.undo(); } }, '↩'),
        primaryBtn
      );

      var footer = h('div', { style: 'flex:none;display:flex;align-items:center;justify-content:space-between;padding:7px 15px calc(10px + env(safe-area-inset-bottom));font-size:11px;font-weight:700;color:#12936a' },
        h('span', { style: 'cursor:pointer', onclick: function () { api.nav('#/watch/' + match.id); } }, 'Raid log ›'),
        h('span', { style: 'color:#6b7a72;font-weight:600;cursor:pointer', onclick: function () { api.nav('#/watch/' + match.id); } },
          '👁 ' + (12 + match.events.length % 9) + ' · Share live ', h('span', { style: 'color:#12936a' }, '↗'))
      );

      el.appendChild(h('div', { style: 'flex:1;display:flex;flex-direction:column;background:#f4f6f3;color:#14201a' },
        header,
        h('div', { style: 'flex:none;display:flex;align-items:center;justify-content:space-between;padding:8px 22px 4px' },
          teamPanel(0), raidCircle, teamPanel(1)),
        banner,
        grid,
        row2,
        row3,
        bottomRow,
        footer
      ));
    },

    /* ---------- spectator: 1:1 port of fragment 6e ---------- */
    renderSpectator: function (el, match) {
      var snap = match.snapshot, teams = match.teams;
      var raider = snap.raidingTeam;
      var isLive = match.status === 'live';

      var kf = h('style', { html:
        '@keyframes geP{0%,100%{opacity:1}50%{opacity:.35}}' +
        '@keyframes geGlow{0%,100%{box-shadow:0 8px 16px -10px rgba(18,147,106,.7)}50%{box-shadow:0 8px 22px -8px rgba(18,147,106,.95)}}'
      });

      var header = h('div', { style: 'flex:none;display:flex;align-items:center;justify-content:space-between;padding:2px 13px 8px' },
        h('a', { href: '#/home', style: 'width:32px;height:32px;border-radius:11px;background:#fff;box-shadow:0 1px 2px rgba(20,40,30,.08);display:flex;align-items:center;justify-content:center;font-size:16px;text-decoration:none;color:#14201a' }, '‹'),
        h('div', { style: 'display:flex;align-items:center;gap:7px' },
          h('span', { style: 'font-size:13px;font-weight:700' }, teams[0].name + ' vs ' + teams[1].name),
          isLive
            ? h('span', { style: 'display:inline-flex;align-items:center;gap:4px;font-size:9px;font-weight:700;color:#d64f43' },
                h('span', { style: 'width:5px;height:5px;border-radius:50%;background:#d64f43;animation:geP 1.4s infinite' }), 'LIVE')
            : h('span', { style: 'font-size:9px;font-weight:700;color:#9aa8a0' }, 'FINAL')
        ),
        h('div', { style: 'width:32px;height:32px;border-radius:11px;background:#fff;box-shadow:0 1px 2px rgba(20,40,30,.08);display:flex;align-items:center;justify-content:center;font-size:13px;color:#12936a' }, '↗')
      );

      var tabs = h('div', { style: 'flex:none;display:flex;background:#e7ece8;border-radius:12px;padding:2px;margin:0 13px' },
        h('span', { style: 'flex:1;text-align:center;padding:6px 0;border-radius:10px;background:#fff;font-size:11.5px;font-weight:700;box-shadow:0 1px 2px rgba(20,40,30,.08)' }, 'Live'),
        h('span', { style: 'flex:1;text-align:center;padding:6px 0;font-size:11.5px;font-weight:600;color:#9aa8a0' }, 'Scorecard'),
        h('span', { style: 'flex:1;text-align:center;padding:6px 0;font-size:11.5px;font-weight:600;color:#9aa8a0' }, 'Graphs')
      );

      var clockLine = h('div', { style: 'font-family:\'DM Mono\',monospace;font-size:10px;color:rgba(255,255,255,.5)' },
        (snap.half === 1 ? '1ST HALF' : '2ND HALF') + ' · ' + SE.fmtClock(elapsedSecs(snap)));
      SE.interval(function () {
        clockLine.textContent = (snap.half === 1 ? '1ST HALF' : '2ND HALF') + ' · ' + SE.fmtClock(elapsedSecs(snap));
      }, 1000);
      var raidLine = h('div', { style: 'font-family:\'DM Mono\',monospace;font-size:9px;color:#3fd598;margin-top:3px;' + (snap.raidStartedTs ? 'animation:geGlow 1.4s infinite' : '') },
        snap.raidStartedTs ? ('RAID ON · ' + raidRemaining(snap) + 's') : 'between raids');
      if (snap.raidStartedTs) {
        SE.interval(function () { raidLine.textContent = 'RAID ON · ' + raidRemaining(snap) + 's'; }, 1000);
      }

      var summaryCard = h('div', { style: 'background:#14201a;color:#fff;border-radius:18px;padding:12px 14px' },
        h('div', { style: 'display:flex;align-items:center;justify-content:space-between' },
          h('div', null,
            h('div', { style: 'font-size:10px;color:rgba(255,255,255,.6);font-weight:600' }, teams[0].name.toUpperCase()),
            h('div', { style: 'font-family:\'DM Mono\',monospace;font-size:28px;font-weight:500;color:' + (raider === 0 ? '#3fd598' : '#fff') }, String(snap.points[0])),
            h('div', { style: 'font-family:\'DM Mono\',monospace;font-size:8px;color:rgba(255,255,255,.5);margin-top:2px' }, snap.onMat[0] + ' ON MAT')
          ),
          h('div', { style: 'text-align:center' }, clockLine, raidLine),
          h('div', { style: 'text-align:right' },
            h('div', { style: 'font-size:10px;color:rgba(255,255,255,.6);font-weight:600' }, teams[1].name.toUpperCase()),
            h('div', { style: 'font-family:\'DM Mono\',monospace;font-size:28px;font-weight:500;color:' + (raider === 1 ? '#3fd598' : '#fff') }, String(snap.points[1])),
            h('div', { style: 'font-family:\'DM Mono\',monospace;font-size:8px;color:rgba(255,255,255,.5);margin-top:2px' }, snap.onMat[1] + ' ON MAT')
          )
        )
      );

      var hist = raidHistory(match);
      var last10 = hist.slice(-10);
      var scoreCounts = [0, 0];
      last10.forEach(function (r) { if (r.action === 'raidPoint' || r.action === 'bonus') scoreCounts[r.raider] += 1; });
      var lead = scoreCounts[0] === scoreCounts[1] ? -1 : (scoreCounts[0] > scoreCounts[1] ? 0 : 1);

      var raidsHeader = h('div', { style: 'display:flex;align-items:center;justify-content:space-between' },
        h('span', { style: 'font-size:11px;font-weight:700;letter-spacing:.06em;color:#9aa8a0;text-transform:uppercase' }, 'Last 10 raids'),
        lead >= 0 ? h('span', { style: 'font-family:\'DM Mono\',monospace;font-size:10px;color:#12936a' }, teams[lead].name.toUpperCase() + ' ' + scoreCounts[lead] + ' SCORED') : null
      );

      function raidDot(r, isLast) {
        var style, content = null;
        if (r.action === 'emptyRaid') style = 'background:#eef1ee;border:1px solid #d7ded9';
        else if (r.action === 'tackle' || r.action === 'allOut') style = 'background:#b8862e';
        else if (r.action === 'superTackle') { style = 'background:#12936a;color:#fff;font-family:\'DM Mono\',monospace;font-size:8px;display:inline-flex;align-items:center;justify-content:center'; content = 'S'; }
        else style = 'background:#12936a';
        return h('span', { style: 'width:19px;height:19px;border-radius:50%;' + style + (isLast && isLive ? ';animation:geP 1.4s infinite' : '') }, content);
      }
      var dotsRow = last10.length
        ? h('div', { style: 'display:flex;gap:5px' }, last10.map(function (r, i) { return raidDot(r, i === last10.length - 1); }))
        : h('div', { style: 'font-size:12px;color:#9aa8a0' }, 'No raids yet');

      var legend = h('div', { style: 'display:flex;justify-content:space-between;font-family:\'DM Mono\',monospace;font-size:8px;color:#b3bdb6' },
        h('span', { style: 'color:#12936a' }, '● RAID PT'),
        h('span', null, 'S = SUPER TACKLE'),
        h('span', { style: 'color:#b8862e' }, '● DEFENDED')
      );

      var keyHeader = h('div', null,
        h('span', { style: 'font-size:11px;font-weight:700;letter-spacing:.06em;color:#9aa8a0;text-transform:uppercase' }, 'Key moments'));
      var keyEvents = match.events.filter(function (ev) { return ev.action === 'superTackle' || ev.action === 'allOut'; }).slice(-2);
      function momentCard(ev, i) {
        var tag = ev.action === 'superTackle' ? h('b', { style: 'color:#12936a' }, 'SUPER TACKLE! ') : h('b', { style: 'color:#d64f43' }, 'ALL OUT ');
        var t = SE.fmtClock(Math.max(0, (ev.ts - match.startedAt) / 1000));
        return h('div', { style: 'background:#fff;border-radius:13px;padding:9px 12px;box-shadow:0 1px 3px rgba(20,40,30,.06);display:flex;gap:9px;align-items:center;' + (i > 0 ? 'opacity:.65' : '') },
          h('span', { style: 'font-family:\'DM Mono\',monospace;font-size:9px;color:#9aa8a0;width:30px;flex:none' }, t),
          h('span', { style: 'font-size:12px' }, tag, ev.label)
        );
      }

      var footer = h('div', { style: 'flex:none;display:flex;align-items:center;gap:8px;padding:8px 13px 14px' },
        h('span', { style: 'font-size:10px;color:#9aa8a0;font-weight:600;flex:none' }, '👁 ' + (12 + match.events.length % 20)),
        h('div', { style: 'flex:1;display:flex;gap:6px' },
          h('span', { style: 'background:#fff;border-radius:99px;padding:6px 12px;font-size:12px;box-shadow:0 1px 3px rgba(20,40,30,.08)' },
            '🔥 ', h('span', { style: 'font-family:\'DM Mono\',monospace;font-size:10px;color:#6b7a72' }, String(Math.floor(match.events.length / 2)))),
          h('span', { style: 'background:#fff;border-radius:99px;padding:6px 12px;font-size:12px;box-shadow:0 1px 3px rgba(20,40,30,.08)' },
            '👏 ', h('span', { style: 'font-family:\'DM Mono\',monospace;font-size:10px;color:#6b7a72' }, String(Math.floor(match.events.length / 3))))
        ),
        h('span', { style: 'background:#12936a;color:#fff;border-radius:99px;padding:6px 14px;font-size:11px;font-weight:700;flex:none' }, 'Following ✓')
      );

      el.appendChild(h('div', { style: 'flex:1;display:flex;flex-direction:column;background:#f4f6f3;color:#14201a' },
        kf,
        header,
        tabs,
        h('div', { style: 'flex:1;min-height:0;display:flex;flex-direction:column;padding:8px 13px 0;gap:8px;overflow:hidden' },
          summaryCard,
          raidsHeader,
          dotsRow,
          legend,
          keyHeader,
          keyEvents.length ? keyEvents.map(momentCard) : h('div', { style: 'font-size:12px;color:#9aa8a0' }, 'No key moments yet'),
          h('div', { style: 'flex:1' })
        ),
        footer
      ));
    },
  });
})();
