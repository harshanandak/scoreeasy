/* Basketball: quarters, +1/+2/+3 scoring, team fouls with BONUS at 5, manual end (+ OT on tie).
   Reference: prototype/reference/screens/5c-basketball-scorer-refined.html
              prototype/reference/screens/6c-spectator-basketball-refined.html */
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

  function buildPeriodRow(snap) {
    var cols = [];
    var maxP = Math.max(4, snap.periodPoints.length);
    for (var i = 0; i < maxP; i++) {
      var pp = snap.periodPoints[i];
      var isCurrent = (i + 1) === snap.period;
      cols.push(h('span', { style: 'color:' + (isCurrent ? 'var(--accent-deep)' : 'var(--ink-faint)') + (isCurrent ? ';font-weight:600' : '') },
        periodLabel(i + 1) + ' ' + (pp ? (pp[0] + '–' + pp[1]) : '—')
      ));
    }
    return h('div', { class: 'card mono', style: 'display:flex;justify-content:space-around;padding:8px 4px;font-size:11px' }, cols);
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
          period: snap.period + 1, fouls: [0, 0], elapsedMs: 0, running: false, startedAt: null, periodPoints: periodPoints
        }),
        label: periodLabel(snap.period + 1) + ' underway'
      };
    }
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
      return { points: [0, 0], fouls: [0, 0], period: 1, periodPoints: [[0, 0]], elapsedMs: 0, running: false, startedAt: null };
    },

    actions: actions,

    isOver: function (snap, cfg) { return null; }, // manual end (with optional OT) only

    headline: function (m) {
      var s = m.snapshot;
      return s.points[0] + '–' + s.points[1] + ' · ' + periodLabel(s.period) + ' ' + SE.fmtClock(remainingSecs(s, m.config));
    },

    renderScorer: function (el, match, api) {
      var m = match, cfg = match.config, teams = match.teams;

      var topbarEl = SE.topbar({
        title: teams[0].name + ' vs ' + teams[1].name,
        sub: periodLabel(m.snapshot.period) + ' · ' + SE.fmtClock(remainingSecs(m.snapshot, cfg)),
        back: '#/home',
        right: h('a', { class: 'chip', href: '#/watch/' + m.id }, '👁')
      });
      var subEl = topbarEl.querySelector('.sub');
      SE.interval(function () {
        if (subEl) subEl.textContent = periodLabel(m.snapshot.period) + ' · ' + SE.fmtClock(remainingSecs(m.snapshot, cfg));
      }, 1000);

      function scoreBtn(team, n) {
        var mid = n === 2;
        return h('button', {
          class: 'btn', style: 'flex:1;height:42px;border-radius:12px;font-family:var(--font-num);font-size:15px;' +
            (mid ? 'background:var(--accent-soft);color:var(--accent-deep);font-weight:600;border-color:transparent;' : ''),
          onclick: function () { api.dispatch('plus' + n, { team: team, name: teams[team].name }); }
        }, '+' + n);
      }

      function teamPanel(team) {
        var pts = m.snapshot.points[team];
        var fouls = m.snapshot.fouls[team];
        var bonus = fouls >= 5;
        var leading = pts > m.snapshot.points[1 - team];
        return h('div', { style: 'flex:1;min-width:0;display:flex;flex-direction:column;' + (team === 0 ? 'border-right:1px solid var(--line);' : '') },
          h('div', { style: 'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:14px 6px' },
            h('span', { class: 'microlabel' }, teams[team].name.toUpperCase()),
            h('span', { class: 'bignum', style: 'font-size:52px;color:' + (leading ? 'var(--accent-deep)' : 'var(--ink)') }, String(pts)),
            h('div', { class: 'row', style: 'gap:6px' },
              h('span', { class: 'mono', style: 'font-size:10px;color:' + (bonus ? 'var(--danger)' : 'var(--ink-faint)') },
                fouls + ' TEAM FOUL' + (fouls === 1 ? '' : 'S')),
              bonus ? h('span', { class: 'chip', style: 'background:var(--danger-soft);color:var(--danger);border-color:transparent;padding:2px 8px;font-size:9px' }, 'BONUS') : null
            ),
            h('button', { class: 'chip', style: 'font-size:10px;padding:3px 10px', onclick: function () { api.dispatch('foul', { team: team, name: teams[team].name }); } }, '+ Foul')
          ),
          h('div', { class: 'row', style: 'gap:6px;padding:0 10px 10px' }, scoreBtn(team, 1), scoreBtn(team, 2), scoreBtn(team, 3))
        );
      }

      function endMatch() {
        var s = m.snapshot;
        var winner = s.points[0] === s.points[1] ? null : (s.points[0] > s.points[1] ? 0 : 1);
        var summary = winner != null
          ? teams[winner].name + ' won ' + Math.max(s.points[0], s.points[1]) + '–' + Math.min(s.points[0], s.points[1])
          : teams[0].name + ' tied ' + teams[1].name + ' ' + s.points[0] + '–' + s.points[1];
        api.end({ summary: summary, winnerIndex: winner });
      }

      var clockBtn = h('button', {
        class: 'btn block', style: 'font-family:var(--font-num)',
        onclick: function () { api.dispatch('clockToggle', Date.now()); }
      }, m.snapshot.running ? '⏸ Pause clock' : '▶ Start clock');

      var tied = m.snapshot.points[0] === m.snapshot.points[1];
      var footer;
      if (m.snapshot.period < 4) {
        footer = h('button', { class: 'btn primary', style: 'flex:1', onclick: function () { api.dispatch('nextPeriod'); } },
          'End ' + periodLabel(m.snapshot.period) + ' ✓');
      } else if (tied) {
        footer = h('div', { class: 'row', style: 'flex:1;gap:8px' },
          h('button', { class: 'btn', style: 'flex:1', onclick: function () { api.dispatch('nextPeriod'); } }, 'Start ' + periodLabel(m.snapshot.period + 1)),
          h('button', { class: 'btn primary', style: 'flex:1', onclick: endMatch }, 'End (tie)')
        );
      } else {
        footer = h('button', { class: 'btn primary', style: 'flex:1', onclick: endMatch }, 'End match ✓');
      }

      el.appendChild(h('div', { class: 'screen' },
        topbarEl,
        clockBtn,
        h('div', { class: 'card row', style: 'padding:0;overflow:hidden' }, teamPanel(0), teamPanel(1)),
        buildPeriodRow(m.snapshot),
        h('div', { class: 'row', style: 'gap:8px' },
          h('button', { class: 'btn', style: 'width:48px;padding:0;flex:none', onclick: function () { api.undo(); } }, '↩'),
          footer
        )
      ));
    },

    renderSpectator: function (el, match) {
      var m = match, cfg = match.config, teams = match.teams, s = m.snapshot;

      var pts = [0, 0], biggest = 0, biggestTeam = null, leadChanges = 0, lastLeader = null;
      match.events.forEach(function (ev) {
        var n = ev.action === 'plus1' ? 1 : (ev.action === 'plus2' ? 2 : (ev.action === 'plus3' ? 3 : 0));
        if (!n) return;
        pts[ev.payload.team] += n;
        var diff = pts[0] - pts[1];
        var leader = diff > 0 ? 0 : (diff < 0 ? 1 : null);
        if (Math.abs(diff) > biggest) { biggest = Math.abs(diff); biggestTeam = leader; }
        if (leader != null && lastLeader != null && leader !== lastLeader) leadChanges++;
        if (leader != null) lastLeader = leader;
      });

      var scoreboard = h('div', { style: 'background:var(--ink);color:#fff;border-radius:18px;padding:14px 16px;display:flex;align-items:center;justify-content:space-between' },
        h('div', null,
          h('div', { style: 'font-size:10px;color:rgba(255,255,255,.6);font-weight:600' }, teams[0].name.toUpperCase()),
          h('div', { class: 'bignum', style: 'font-size:30px;color:#3fd598' }, String(s.points[0]))
        ),
        h('div', { style: 'text-align:center' },
          h('div', { class: 'mono', style: 'font-size:11px;color:rgba(255,255,255,.55)' }, periodLabel(s.period) + ' · ' + SE.fmtClock(remainingSecs(s, cfg)))
        ),
        h('div', { style: 'text-align:right' },
          h('div', { style: 'font-size:10px;color:rgba(255,255,255,.6);font-weight:600' }, teams[1].name.toUpperCase()),
          h('div', { class: 'bignum', style: 'font-size:30px' }, String(s.points[1]))
        )
      );

      var leadRow = h('div', { class: 'row', style: 'justify-content:space-between' },
        h('span', { class: 'microlabel' }, 'LEAD TRACKER'),
        h('span', { class: 'mono', style: 'font-size:10px;color:var(--accent)' },
          (biggest ? ('BIGGEST ' + teams[biggestTeam].name.toUpperCase() + ' +' + biggest) : 'EVEN') + ' · ' + leadChanges + ' CHANGES')
      );

      var recent = match.events.slice(-6).reverse();
      var feed = recent.length
        ? h('div', { style: 'display:flex;flex-direction:column;gap:6px' }, recent.map(function (ev) {
            return h('div', { class: 'card row', style: 'padding:9px 12px;gap:9px' },
              h('span', { class: 'mono', style: 'font-size:9px;color:var(--ink-faint);flex:none' },
                new Date(ev.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
              h('span', { style: 'font-size:12px' }, ev.label)
            );
          }))
        : h('div', { class: 'muted', style: 'font-size:12px;text-align:center;padding:8px' }, 'No plays yet');

      el.appendChild(h('div', { class: 'screen' },
        SE.topbar({ title: teams[0].name + ' vs ' + teams[1].name, sub: 'Basketball · Live', back: '#/home' }),
        scoreboard,
        leadRow,
        buildPeriodRow(s),
        h('div', { class: 'microlabel' }, 'RECENT PLAYS'),
        feed
      ));
    }
  });
})();
