/* Football sport def: two 45(ish)-minute halves, goals, cards, manual clock control.
   Halves are fixed at 2; only half length is configurable. Time never auto-ends the
   match — full-time is the scorer tapping "End match", which computes the result
   from the score. See prototype/AGENT-BRIEF.md for the contract this must satisfy. */
(function () {
  'use strict';
  var h = SE.h;

  /* ---------- snapshot time helpers ----------
     snapshot.elapsedBase is seconds already banked (clock paused/stopped there).
     When running, live elapsed = elapsedBase + (now - clockStartedTs)/1000.
     Half-time jumps elapsedBase straight to cfg.halfMinutes*60 so the on-screen
     clock reads continuously across the break, matching the reference fragment. */
  function elapsedSecondsOf(snap) {
    if (!snap.clockRunning) return snap.elapsedBase;
    return snap.elapsedBase + (Date.now() - snap.clockStartedTs) / 1000;
  }
  function minuteOf(snap) { return Math.floor(elapsedSecondsOf(snap) / 60); }

  function patch(snap, changes) {
    var next = {};
    Object.keys(snap).forEach(function (k) { next[k] = snap[k]; });
    Object.keys(changes).forEach(function (k) { next[k] = changes[k]; });
    return next;
  }

  SE.registerSport({
    key: 'football', label: 'Football', icon: '⚽', priority: 4,
    tagline: 'goals & cards',
    sampleTeams: ['Reds', 'Blues'],
    defaultConfig: { halfMinutes: 45, halves: 2 },
    setupFields: [
      { key: 'halfMinutes', label: 'Half length (min)', type: 'choice', options: [
        { label: '10', value: 10 }, { label: '20', value: 20 },
        { label: '30', value: 30 }, { label: '45', value: 45 },
      ] },
    ],

    init: function (config) {
      return {
        period: 1, clockRunning: false, clockStartedTs: null, elapsedBase: 0,
        score: [0, 0], cards: [],
      };
    },

    actions: {
      // payload: { now } — play/pause. First press of period 1 is kickoff;
      // a press mid-half pauses/resumes; a press after half-time is 2nd-half kickoff.
      clockToggle: function (snap, cfg, payload) {
        if (snap.clockRunning) {
          var banked = snap.elapsedBase + (payload.now - snap.clockStartedTs) / 1000;
          return { snap: patch(snap, { clockRunning: false, clockStartedTs: null, elapsedBase: banked }), label: 'Clock paused' };
        }
        var label = (snap.period === 1 && snap.elapsedBase === 0) ? 'Kickoff'
          : (snap.period === 2 && snap.elapsedBase === cfg.halfMinutes * 60) ? '2nd half underway' : 'Clock resumed';
        return { snap: patch(snap, { clockRunning: true, clockStartedTs: payload.now }), label: label };
      },
      // payload: { now } — pauses (if running) and jumps straight to the 2nd-half mark.
      halfTime: function (snap, cfg, payload) {
        if (snap.period !== 1) return { snap: snap, label: 'Half-time' };
        return { snap: patch(snap, { period: 2, clockRunning: false, clockStartedTs: null, elapsedBase: cfg.halfMinutes * 60 }), label: 'Half-time' };
      },
      // payload: { team, name, minute }
      goal: function (snap, cfg, payload) {
        var score = snap.score.slice();
        score[payload.team] += 1;
        return { snap: patch(snap, { score: score }), label: payload.name + ' +1' };
      },
      // payload: { team, name, type: 'yellow'|'red', minute }
      card: function (snap, cfg, payload) {
        var cards = snap.cards.concat([{ team: payload.team, name: payload.name, type: payload.type, minute: payload.minute }]);
        return { snap: patch(snap, { cards: cards }), label: payload.name + ' ' + (payload.type === 'red' ? '🟥' : '🟨') };
      },
    },

    // Time never ends the match on its own — only the scorer's "End match" button
    // (which calls api.end directly) does. See renderScorer's doEndMatch.
    isOver: function () { return null; },

    headline: function (m) {
      var snap = m.snapshot;
      var half = snap.period === 1 ? '1st half' : '2nd half';
      return snap.score[0] + '–' + snap.score[1] + ' · ' + half + ' ' + minuteOf(snap) + '\'';
    },

    renderScorer: function (el, match, api) {
      var teams = match.teams, cfg = match.config;

      function addGoal(team) {
        api.dispatch('goal', { team: team, name: teams[team].name, minute: minuteOf(match.snapshot) });
      }
      function addCard(team, type, ev) {
        if (ev) ev.stopPropagation();
        api.dispatch('card', { team: team, name: teams[team].name, type: type, minute: minuteOf(match.snapshot) });
      }
      function toggleClock() { api.dispatch('clockToggle', { now: Date.now() }); }
      function doHalfTime() { api.dispatch('halfTime', { now: Date.now() }); }
      function doEndMatch() {
        var s0 = match.snapshot.score[0], s1 = match.snapshot.score[1], result;
        if (s0 === s1) result = { summary: 'Draw ' + s0 + '–' + s1, winnerIndex: null };
        else if (s0 > s1) result = { summary: teams[0].name + ' won ' + s0 + '–' + s1, winnerIndex: 0 };
        else result = { summary: teams[1].name + ' won ' + s1 + '–' + s0, winnerIndex: 1 };
        api.end(result);
      }

      var snap = match.snapshot;
      var clockNum = h('span', { class: 'mono', style: 'font-size:22px;font-weight:500;font-variant-numeric:tabular-nums' }, SE.fmtClock(elapsedSecondsOf(snap)));

      function teamPanel(i) {
        return h('div', {
          class: 'tapzone', style: 'flex:1;padding:16px 4px;display:flex;flex-direction:column;align-items:center;gap:6px;position:relative',
          onclick: function () { addGoal(i); },
        },
          h('div', { style: 'position:absolute;top:8px;right:8px;display:flex;gap:4px' },
            h('button', { class: 'chip', style: 'padding:2px 7px;font-size:11px', onclick: function (ev) { addCard(i, 'yellow', ev); } }, '🟨'),
            h('button', { class: 'chip', style: 'padding:2px 7px;font-size:11px', onclick: function (ev) { addCard(i, 'red', ev); } }, '🟥')
          ),
          h('span', { class: 'microlabel' }, teams[i].name.toUpperCase()),
          h('span', { class: 'bignum', style: 'font-size:64px' }, String(snap.score[i])),
          h('span', { style: 'width:36px;height:3px;background:var(--accent);border-radius:2px' })
        );
      }

      var feedEvents = match.events.filter(function (e) { return e.action === 'goal' || e.action === 'card'; }).slice(-6).reverse();
      var feed = feedEvents.length
        ? h('div', { class: 'row', style: 'gap:6px;padding:2px 2px;overflow-x:auto;font-size:11px' },
          feedEvents.map(function (e, idx) {
            var icon = e.action === 'goal' ? '⚽' : (e.payload.type === 'red' ? '🟥' : '🟨');
            return h('span', { class: 'row', style: 'gap:6px;flex-shrink:0' },
              h('span', { class: 'mono muted', style: 'font-size:10px' }, e.payload.minute + '\''),
              h('span', { style: 'font-weight:700' }, e.payload.name),
              h('span', null, icon),
              idx < feedEvents.length - 1 ? h('span', { class: 'muted' }, '·') : null
            );
          }))
        : h('div', { class: 'center muted', style: 'font-size:11px' }, 'tap a side to add a goal');

      var halfLabel = snap.period === 1 ? '1ST HALF' : '2ND HALF';
      var ctaLabel = snap.period === 1 ? 'Half-time' : 'End match ✓';
      var ctaClick = snap.period === 1 ? doHalfTime : doEndMatch;

      el.appendChild(h('div', { class: 'screen' },
        SE.topbar({ title: teams[0].name + ' vs ' + teams[1].name, sub: cfg.halfMinutes + '-min halves', back: '#/home' }),

        h('div', { class: 'row', style: 'justify-content:center;gap:9px' },
          h('span', { class: 'chip live', style: snap.clockRunning ? '' : 'background:var(--surface);color:var(--ink-soft)' }, snap.clockRunning ? 'LIVE' : 'PAUSED'),
          clockNum,
          h('span', { class: 'chip' }, halfLabel),
          h('button', { class: 'chip', onclick: toggleClock }, snap.clockRunning ? '⏸' : '▶')
        ),

        h('div', { class: 'row', style: 'gap:0' }, teamPanel(0), teamPanel(1)),

        feed,

        h('div', { class: 'row', style: 'gap:8px' },
          h('button', { class: 'btn', style: 'width:52px;flex-shrink:0', onclick: function () { api.undo(); } }, '↩'),
          h('button', { class: 'btn primary big block', onclick: ctaClick }, ctaLabel)
        )
      ));

      SE.interval(function () {
        clockNum.textContent = SE.fmtClock(elapsedSecondsOf(match.snapshot));
      }, 1000);
    },

    renderSpectator: function (el, match) {
      var teams = match.teams, cfg = match.config, snap = match.snapshot;
      var totalSecs = cfg.halfMinutes * 2 * 60;

      var clockNum = h('span', { class: 'mono', style: 'font-size:13px;font-weight:500' }, SE.fmtClock(elapsedSecondsOf(snap)));

      var banner = h('div', { style: 'background:var(--ink);color:#fff;border-radius:18px;padding:12px 14px;display:flex;align-items:center;justify-content:space-between' },
        h('div', null,
          h('div', { style: 'font-size:10px;color:rgba(255,255,255,.6);font-weight:600' }, teams[0].name.toUpperCase()),
          h('div', { class: 'mono', style: 'font-size:28px;font-weight:500;color:var(--accent-live)' }, String(snap.score[0]))
        ),
        h('div', { class: 'center' }, clockNum,
          h('div', { class: 'mono', style: 'font-size:9px;color:rgba(255,255,255,.5);margin-top:2px' }, snap.period === 1 ? '1ST HALF' : '2ND HALF')
        ),
        h('div', { style: 'text-align:right' },
          h('div', { style: 'font-size:10px;color:rgba(255,255,255,.6);font-weight:600' }, teams[1].name.toUpperCase()),
          h('div', { class: 'mono', style: 'font-size:28px;font-weight:500' }, String(snap.score[1]))
        )
      );

      var events = match.events.filter(function (e) { return e.action === 'goal' || e.action === 'card'; });
      var dots = events.map(function (e) {
        var pct = Math.min(100, (e.payload.minute * 60 / totalSecs) * 100);
        var isGoal = e.action === 'goal';
        return h('span', {
          style: 'position:absolute;left:' + pct + '%;top:50%;transform:translate(-50%,-50%);' +
            (isGoal ? 'width:11px;height:11px;border-radius:50%;background:var(--accent)'
              : 'width:8px;height:11px;border-radius:2px;background:' + (e.payload.type === 'red' ? 'var(--danger)' : 'var(--amber)')),
        });
      });
      var timeline = h('div', { style: 'position:relative;height:26px' },
        h('div', { style: 'position:absolute;left:0;right:0;top:50%;height:2px;background:var(--line-soft);border-radius:1px' }),
        dots
      );

      var moments = events.slice().reverse().slice(0, 6);
      var momentsList = moments.length
        ? moments.map(function (e) {
          var text = e.action === 'goal'
            ? h('span', null, h('b', { style: 'color:var(--accent)' }, 'GOAL! '), e.payload.name + ' scores')
            : h('span', null, h('b', null, e.payload.type === 'red' ? 'RED CARD' : 'YELLOW CARD'), ' — ' + e.payload.name);
          return h('div', { class: 'card row', style: 'padding:9px 12px;gap:9px' },
            h('span', { class: 'mono muted', style: 'font-size:9px;width:28px;flex-shrink:0' }, e.payload.minute + '\''),
            text
          );
        })
        : [h('div', { class: 'center muted', style: 'font-size:12px' }, 'No goals or cards yet')];

      el.appendChild(h('div', { class: 'screen' },
        SE.topbar({ title: teams[0].name + ' vs ' + teams[1].name, sub: match.status === 'live' ? 'LIVE' : 'FULL-TIME', back: '#/home' }),
        banner,
        h('div', { class: 'microlabel' }, 'MATCH TIMELINE'),
        timeline,
        h('div', { class: 'microlabel' }, 'KEY MOMENTS'),
        h('div', { style: 'display:flex;flex-direction:column;gap:8px' }, momentsList)
      ));

      SE.interval(function () {
        clockNum.textContent = SE.fmtClock(elapsedSecondsOf(match.snapshot));
      }, 1000);
    },
  });
})();
