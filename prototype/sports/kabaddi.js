/* Kabaddi sport def: raid points, 30s raid clock (display-only), football-style half clock. */
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
  function withNames(label, teams) {
    return (label || '').replace('Team 1', teams[0].name).replace('Team 2', teams[1].name);
  }

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

    actions: {
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
    },

    isOver: function (snap, cfg) { return null; }, // manual end only

    headline: function (m) {
      var s = m.snapshot;
      return s.points[0] + '–' + s.points[1] + ' · ' + (s.half === 1 ? '1st' : '2nd') + ' half';
    },

    renderScorer: function (el, match, api) {
      var snap = match.snapshot, cfg = match.config, teams = match.teams;
      var raider = snap.raidingTeam;

      function teamPanel(i) {
        var isRaiding = raider === i;
        var dots = [];
        for (var d = 0; d < MAT_SIZE; d++) {
          dots.push(h('span', { style: 'width:6px;height:6px;border-radius:50%;' +
            (d < snap.onMat[i] ? 'background:var(--accent)' : 'border:1px solid var(--line-soft)') }));
        }
        return h('div', { style: 'flex:1;min-width:0;text-align:center' },
          h('div', { class: 'microlabel' }, teams[i].name.toUpperCase()),
          h('div', { class: 'bignum', style: 'font-size:40px;' + (isRaiding ? '' : 'color:var(--ink-muted)') }, String(snap.points[i])),
          h('div', { style: 'display:flex;gap:3px;justify-content:center;margin-top:4px' }, dots),
          h('div', { style: 'font-size:9px;color:var(--ink-faint);margin-top:3px' }, snap.onMat[i] + ' on mat')
        );
      }

      var raidNumEl = h('span', { class: 'mono', style: 'font-size:22px;font-weight:500;line-height:1' },
        snap.raidStartedTs ? String(raidRemaining(snap)) : String(RAID_SECS));
      var raidLabelEl = h('span', { style: 'font-size:8px;font-weight:700;letter-spacing:.1em;color:var(--accent)' },
        snap.raidStartedTs ? 'RAID ON' : 'TAP TO RAID');
      var raidCircle = h('div', {
        style: 'width:78px;height:78px;flex-shrink:0;border-radius:50%;background:var(--accent-soft);' +
          'display:flex;align-items:center;justify-content:center;cursor:pointer',
        onclick: function () { if (!snap.raidStartedTs) api.dispatch('startRaid', Date.now()); },
      }, h('div', { style: 'width:62px;height:62px;border-radius:50%;background:var(--card);' +
        'display:flex;flex-direction:column;align-items:center;justify-content:center' }, raidNumEl, raidLabelEl));
      if (snap.raidStartedTs) {
        SE.interval(function () { raidNumEl.textContent = String(raidRemaining(snap)); }, 250);
      }

      var clockTextEl = h('span', { class: 'mono' }, SE.fmtClock(elapsedSecs(snap)));
      SE.interval(function () { clockTextEl.textContent = SE.fmtClock(elapsedSecs(snap)); }, 1000);
      var clockRow = h('div', { class: 'row', style: 'justify-content:center;gap:9px;padding:2px 0 4px' },
        h('span', { style: 'width:6px;height:6px;border-radius:50%;background:var(--accent-live);' + (snap.running ? '' : 'opacity:.3') }),
        clockTextEl,
        h('span', { class: 'chip' }, snap.half === 1 ? '1ST HALF' : '2ND HALF'),
        h('button', { class: 'btn ghost', style: 'padding:6px 9px;font-size:12px',
          onclick: function () { api.dispatch('clockToggle', Date.now()); } }, snap.running ? '⏸' : '▶')
      );

      var banner = h('div', { class: 'banner' },
        teams[raider].name + ' raiding' + (snap.onMat[raider] <= 3 ? ' · do-or-die' : ''));

      var strip = h('div', { class: 'actionstrip' },
        [1, 2, 3].map(function (n) {
          return h('button', { class: 'btn', onclick: function () { api.dispatch('raidPoint', n); } }, 'Raid +' + n);
        }),
        h('button', { class: 'btn', onclick: function () { api.dispatch('bonus'); } }, 'Bonus'),
        h('button', { class: 'btn', onclick: function () { api.dispatch('tackle'); } }, 'Tackle'),
        h('button', { class: 'btn', onclick: function () { api.dispatch('superTackle'); } }, 'Super'),
        h('button', { class: 'btn danger', onclick: function () { api.dispatch('allOut'); } }, 'All out'),
        h('button', { class: 'btn ghost', onclick: function () { api.dispatch('emptyRaid'); } }, 'Empty')
      );

      var primaryBtn = snap.half === 1
        ? h('button', { class: 'btn primary block', onclick: function () { api.dispatch('nextHalf', Date.now()); } }, 'Half-time ✓')
        : h('button', { class: 'btn primary block', onclick: function () { api.end(computeResult(snap, teams)); } }, 'End match');

      var bottomRow = h('div', { class: 'row', style: 'gap:8px' },
        h('button', { class: 'btn ghost', style: 'padding:12px 16px', onclick: function () { api.undo(); } }, '↩'),
        h('div', { class: 'grow' }, primaryBtn)
      );

      el.appendChild(h('div', { class: 'screen' },
        SE.topbar({ title: teams[0].name + ' vs ' + teams[1].name, sub: cfg.halfMinutes + '-min halves', back: '#/home' }),
        clockRow,
        h('div', { class: 'row', style: 'align-items:center;gap:6px' }, teamPanel(0), raidCircle, teamPanel(1)),
        banner,
        strip,
        bottomRow
      ));
    },

    renderSpectator: function (el, match) {
      var snap = match.snapshot, teams = match.teams;

      var clockTextEl = h('div', { class: 'mono', style: 'font-size:10px;color:rgba(255,255,255,.5)' },
        'HALF ' + snap.half + ' · ' + SE.fmtClock(elapsedSecs(snap)));
      SE.interval(function () {
        clockTextEl.textContent = 'HALF ' + snap.half + ' · ' + SE.fmtClock(elapsedSecs(snap));
      }, 1000);

      var raidTextEl = h('div', { class: 'mono', style: 'font-size:9px;color:#3fd598;margin-top:3px' },
        snap.raidStartedTs ? ('RAID ON · ' + raidRemaining(snap) + 's') : 'between raids');
      if (snap.raidStartedTs) {
        SE.interval(function () {
          raidTextEl.textContent = 'RAID ON · ' + raidRemaining(snap) + 's';
        }, 1000);
      }

      var summaryCard = h('div', { style: 'background:var(--ink);color:#fff;border-radius:18px;padding:12px 14px' },
        h('div', { class: 'row', style: 'justify-content:space-between;align-items:flex-start' },
          h('div', null,
            h('div', { style: 'font-size:10px;color:rgba(255,255,255,.6);font-weight:600' }, teams[0].name.toUpperCase()),
            h('div', { class: 'mono', style: 'font-size:28px;font-weight:500;color:' + (snap.raidingTeam === 0 ? '#3fd598' : '#fff') }, String(snap.points[0])),
            h('div', { class: 'mono', style: 'font-size:8px;color:rgba(255,255,255,.5);margin-top:2px' }, snap.onMat[0] + ' ON MAT')
          ),
          h('div', { style: 'text-align:center' }, clockTextEl, raidTextEl),
          h('div', { style: 'text-align:right' },
            h('div', { style: 'font-size:10px;color:rgba(255,255,255,.6);font-weight:600' }, teams[1].name.toUpperCase()),
            h('div', { class: 'mono', style: 'font-size:28px;font-weight:500;color:' + (snap.raidingTeam === 1 ? '#3fd598' : '#fff') }, String(snap.points[1])),
            h('div', { class: 'mono', style: 'font-size:8px;color:rgba(255,255,255,.5);margin-top:2px' }, snap.onMat[1] + ' ON MAT')
          )
        )
      );

      var events = match.events.slice(-8).reverse();
      function feedRow(ev) {
        var color = (ev.action === 'tackle' || ev.action === 'superTackle') ? 'var(--amber)'
          : ev.action === 'allOut' ? 'var(--danger)' : 'var(--accent)';
        return h('div', { class: 'card row', style: 'padding:9px 12px' },
          h('span', { style: 'width:8px;height:8px;border-radius:50%;background:' + color + ';flex-shrink:0' }),
          h('div', { class: 'grow', style: 'font-size:12px' }, withNames(ev.label, teams))
        );
      }

      el.appendChild(h('div', { class: 'screen' },
        SE.topbar({ title: teams[0].name + ' vs ' + teams[1].name, sub: match.status === 'live' ? 'LIVE' : 'FINAL', back: '#/home' }),
        summaryCard,
        h('div', { class: 'microlabel' }, 'RAID FEED'),
        h('div', { style: 'display:flex;flex-direction:column;gap:6px' },
          events.length ? events.map(feedRow) : h('div', { class: 'muted', style: 'font-size:12px' }, 'No raids yet')
        )
      ));
    },
  });
})();
