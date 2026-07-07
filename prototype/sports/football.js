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
      // soft actions from the fragment's pill row — no snapshot change, just an event-feed entry
      addedTime: function (snap, cfg, payload) {
        return { snap: snap, label: (payload && payload.label) || "+1' added time" };
      },
      swapEnds: function (snap, cfg, payload) {
        return { snap: snap, label: (payload && payload.label) || '⇄ Ends swapped' };
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

    /* ---------- scorer: 1:1 port of fragment 5b ---------- */
    renderScorer: function (el, match, api) {
      var teams = match.teams, cfg = match.config, snap = match.snapshot;

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
      // "🟨 Card" pill has no per-team target in the fragment (only one pill) —
      // card whichever side is currently most involved, defaulting to team 0.
      function lastActiveTeam() {
        for (var i = match.events.length - 1; i >= 0; i--) {
          var ev = match.events[i];
          if (ev.action === 'goal' || ev.action === 'card') return ev.payload.team;
        }
        return 0;
      }

      // fragment 5b's keyframe (geP: the live pulse dot next to the clock)
      var kf = h('style', { html: '@keyframes geP{0%,100%{opacity:1}50%{opacity:.35}}' });

      function iconBtn(content, onclick, size) {
        return h('div', {
          style: 'width:32px;height:32px;border-radius:11px;background:#fff;box-shadow:0 1px 2px rgba(20,40,30,.08);display:flex;align-items:center;justify-content:center;font-size:' + (size || 16) + 'px;cursor:pointer',
          onclick: onclick,
        }, content);
      }

      function teamPanel(i) {
        var leading = snap.score[i] > snap.score[1 - i];
        return h('div', {
          style: 'flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;cursor:pointer;-webkit-tap-highlight-color:transparent;user-select:none;'
            + (i === 0 ? 'border-right:1px solid rgba(20,32,26,.1);' : '')
            + (leading ? 'background:linear-gradient(180deg,rgba(18,147,106,.07),rgba(18,147,106,0));' : ''),
          onclick: function () { addGoal(i); },
        },
          h('span', { style: 'font-family:\'DM Mono\',monospace;font-size:10px;letter-spacing:.14em;color:#6b7a72' }, teams[i].name.toUpperCase()),
          h('span', { style: 'font-family:\'DM Mono\',monospace;font-size:104px;font-weight:500;line-height:1;font-variant-numeric:tabular-nums' }, String(snap.score[i])),
          h('span', { style: 'width:44px;height:3px;background:#12936a;border-radius:2px' })
        );
      }

      function pill(label, onclick) {
        return h('div', {
          style: 'flex:1;height:36px;border-radius:12px;border:1.5px solid #e4e9e5;background:#fff;display:flex;align-items:center;justify-content:center;font-size:11.5px;font-weight:600;color:#46554d;cursor:pointer;user-select:none',
          onclick: onclick,
        }, label);
      }

      var clockNum = h('span', { style: 'font-family:\'DM Mono\',monospace;font-size:22px;font-weight:500;font-variant-numeric:tabular-nums' }, SE.fmtClock(elapsedSecondsOf(snap)));

      var feedEvents = match.events.filter(function (e) { return e.action === 'goal' || e.action === 'card'; }).slice(-5).reverse();

      el.appendChild(h('div', { style: 'flex:1;display:flex;flex-direction:column;background:#f4f6f3;color:#14201a' },
        kf,
        // header: back · title/sub · match events
        h('div', { style: 'flex:none;display:flex;align-items:center;justify-content:space-between;padding:2px 13px 8px' },
          iconBtn('‹', function () { api.nav('#/home'); }, 16),
          h('div', { style: 'text-align:center' },
            h('div', { style: 'font-size:13px;font-weight:700' }, teams[0].name + ' vs ' + teams[1].name),
            h('div', { style: 'font-family:\'DM Mono\',monospace;font-size:9px;letter-spacing:.08em;color:#6b7a72;margin-top:1px' }, cfg.halfMinutes + '-MIN HALVES')
          ),
          iconBtn('≣', function () { api.nav('#/watch/' + match.id); }, 13)
        ),
        // clock row: live dot · clock · half chip · play/pause
        h('div', { style: 'flex:none;display:flex;align-items:center;justify-content:center;gap:9px;padding:2px 0 6px' },
          h('span', { style: 'width:6px;height:6px;border-radius:50%;background:' + (snap.clockRunning ? '#12936a' : '#c7cec9') + (snap.clockRunning ? ';animation:geP 1.2s infinite' : '') }),
          clockNum,
          h('span', { style: 'font-size:9px;font-weight:700;letter-spacing:.06em;color:#6b7a72;background:#e7ece8;border-radius:99px;padding:3px 9px' }, snap.period === 1 ? '1ST HALF' : '2ND HALF'),
          h('span', { style: 'width:24px;height:24px;border-radius:9px;background:#fff;box-shadow:0 1px 2px rgba(20,40,30,.08);display:inline-flex;align-items:center;justify-content:center;font-size:10px;color:#46554d;cursor:pointer', onclick: toggleClock }, snap.clockRunning ? '⏸' : '▶')
        ),
        // the two giant tap halves
        h('div', { style: 'flex:1;min-height:0;display:flex;border-top:1px solid rgba(20,32,26,.1);border-bottom:1px solid rgba(20,32,26,.1)' },
          teamPanel(0), teamPanel(1)
        ),
        h('div', { style: 'flex:none;text-align:center;font-size:10px;color:#9aa8a0;font-weight:600;padding:6px 0 0' }, 'tap a side to add a goal'),
        // scrolling minute ticker
        feedEvents.length ? h('div', { style: 'flex:none;display:flex;align-items:center;gap:6px;padding:6px 15px 0;white-space:nowrap;overflow:hidden;font-size:11px' },
          feedEvents.map(function (e, idx) {
            var icon = e.action === 'goal' ? '⚽' : (e.payload.type === 'red' ? '🟥' : '🟨');
            return h('span', { style: 'display:inline-flex;align-items:center;gap:6px;flex-shrink:0' },
              h('span', { style: 'font-family:\'DM Mono\',monospace;font-size:10px;color:#9aa8a0' }, e.payload.minute + '\''),
              h('span', { style: 'font-weight:700' }, e.payload.name),
              h('span', null, icon),
              idx < feedEvents.length - 1 ? h('span', { style: 'color:#dfe7e1' }, '·') : null
            );
          }),
          h('span', { style: 'flex:1' }),
          h('span', { style: 'color:#12936a;font-weight:700;flex:none;cursor:pointer', onclick: function () { api.nav('#/watch/' + match.id); } }, 'all ›')
        ) : null,
        // action pills: Card · Swap · +1'
        h('div', { style: 'flex:none;display:flex;gap:7px;padding:8px 13px 0' },
          pill('🟨 Card', function () { addCard(lastActiveTeam(), 'yellow'); }),
          pill('⇄ Swap', function () { api.dispatch('swapEnds'); }),
          pill("+1'", function () { api.dispatch('addedTime'); })
        ),
        // undo + half-time/end match
        h('div', { style: 'flex:none;display:flex;gap:7px;padding:8px 13px 0' },
          h('div', { style: 'width:64px;height:44px;border-radius:14px;background:#eef1ee;display:flex;align-items:center;justify-content:center;font-size:16px;color:#46554d;cursor:pointer', onclick: function () { api.undo(); } }, '↩'),
          h('div', { style: 'flex:1;height:44px;border-radius:14px;background:#12936a;color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;box-shadow:0 10px 18px -10px rgba(18,147,106,.7);cursor:pointer', onclick: snap.period === 1 ? doHalfTime : doEndMatch }, snap.period === 1 ? 'Half-time ✓' : 'End match ✓')
        ),
        // footer: match events link · share live
        h('div', { style: 'flex:none;display:flex;align-items:center;justify-content:space-between;padding:7px 15px calc(10px + env(safe-area-inset-bottom));font-size:11px;font-weight:700;color:#12936a' },
          h('span', { style: 'cursor:pointer', onclick: function () { api.nav('#/watch/' + match.id); } }, 'Match events ›'),
          h('span', { style: 'color:#6b7a72;font-weight:600;cursor:pointer', onclick: function () { api.nav('#/watch/' + match.id); } },
            '👁 ' + (3 + match.events.length % 9) + ' · Share live ', h('span', { style: 'color:#12936a' }, '↗'))
        )
      ));

      SE.interval(function () {
        clockNum.textContent = SE.fmtClock(elapsedSecondsOf(match.snapshot));
      }, 1000);
    },

    /* ---------- spectator: 1:1 port of fragment 6b ---------- */
    renderSpectator: function (el, match) {
      var teams = match.teams, cfg = match.config, snap = match.snapshot;
      var totalSecs = cfg.halfMinutes * 2 * 60;
      var pct = Math.max(0, Math.min(100, (elapsedSecondsOf(snap) / totalSecs) * 100));

      var kf = h('style', { html: '@keyframes geP{0%,100%{opacity:1}50%{opacity:.35}}' });

      var clockNum = h('span', { style: 'font-family:\'DM Mono\',monospace;font-size:13px;font-weight:500' }, SE.fmtClock(elapsedSecondsOf(snap)));

      var events = match.events.filter(function (e) { return e.action === 'goal' || e.action === 'card'; });

      var header = h('div', { style: 'flex:none;display:flex;align-items:center;justify-content:space-between;padding:2px 13px 8px' },
        h('a', { href: '#/home', style: 'width:32px;height:32px;border-radius:11px;background:#fff;box-shadow:0 1px 2px rgba(20,40,30,.08);display:flex;align-items:center;justify-content:center;font-size:16px;text-decoration:none;color:#14201a' }, '‹'),
        h('div', { style: 'display:flex;align-items:center;gap:7px' },
          h('span', { style: 'font-size:13px;font-weight:700' }, teams[0].name + ' vs ' + teams[1].name),
          match.status === 'live'
            ? h('span', { style: 'display:inline-flex;align-items:center;gap:4px;font-size:9px;font-weight:700;color:#d64f43' },
                h('span', { style: 'width:5px;height:5px;border-radius:50%;background:#d64f43;animation:geP 1.4s infinite' }), 'LIVE')
            : h('span', { style: 'font-size:9px;font-weight:700;color:#9aa8a0' }, 'FINAL')
        ),
        h('span', { style: 'width:32px;height:32px;border-radius:11px;background:#fff;box-shadow:0 1px 2px rgba(20,40,30,.08);display:flex;align-items:center;justify-content:center;font-size:13px;color:#12936a' }, '↗')
      );

      // decorative view-mode strip from the fragment — spectator is read-only, no api to route Scorecard/Graphs to
      var tabs = h('div', { style: 'flex:none;display:flex;background:#e7ece8;border-radius:12px;padding:2px;margin:0 13px' },
        h('span', { style: 'flex:1;text-align:center;padding:6px 0;border-radius:10px;background:#fff;font-size:11.5px;font-weight:700;box-shadow:0 1px 2px rgba(20,40,30,.08)' }, 'Live'),
        h('span', { style: 'flex:1;text-align:center;padding:6px 0;font-size:11.5px;font-weight:600;color:#9aa8a0' }, 'Scorecard'),
        h('span', { style: 'flex:1;text-align:center;padding:6px 0;font-size:11.5px;font-weight:600;color:#9aa8a0' }, 'Graphs')
      );

      var banner = h('div', { style: 'background:#14201a;color:#fff;border-radius:18px;padding:12px 14px;display:flex;align-items:center;justify-content:space-between' },
        h('div', null,
          h('div', { style: 'font-size:10px;color:rgba(255,255,255,.6);font-weight:600' }, teams[0].name.toUpperCase()),
          h('div', { style: 'font-family:\'DM Mono\',monospace;font-size:28px;font-weight:500;color:' + (snap.score[0] > snap.score[1] ? '#3fd598' : '#fff') }, String(snap.score[0]))
        ),
        h('div', { style: 'text-align:center' }, clockNum,
          h('div', { style: 'font-family:\'DM Mono\',monospace;font-size:9px;color:rgba(255,255,255,.5);margin-top:2px' }, snap.period === 1 ? '1ST HALF' : '2ND HALF')
        ),
        h('div', { style: 'text-align:right' },
          h('div', { style: 'font-size:10px;color:rgba(255,255,255,.6);font-weight:600' }, teams[1].name.toUpperCase()),
          h('div', { style: 'font-family:\'DM Mono\',monospace;font-size:28px;font-weight:500;color:' + (snap.score[1] > snap.score[0] ? '#3fd598' : '#fff') }, String(snap.score[1]))
        )
      );

      var timelineRow = h('div', { style: 'display:flex;align-items:center;justify-content:space-between' },
        h('span', { style: 'font-size:11px;font-weight:700;letter-spacing:.06em;color:#9aa8a0;text-transform:uppercase' }, 'Match timeline'),
        h('span', { style: 'font-family:\'DM Mono\',monospace;font-size:10px;color:#12936a' }, Math.round(pct) + '% played')
      );
      var dots = events.map(function (e) {
        var epct = Math.min(100, (e.payload.minute * 60 / totalSecs) * 100);
        var isGoal = e.action === 'goal';
        return h('span', {
          style: 'position:absolute;left:' + epct + '%;top:50%;transform:translate(-50%,-50%);' +
            (isGoal ? 'width:11px;height:11px;border-radius:50%;background:#12936a'
              : 'width:8px;height:11px;border-radius:2px;background:' + (e.payload.type === 'red' ? '#d64f43' : '#e8b64c')),
        });
      });
      var timeline = h('div', { style: 'position:relative;height:26px' },
        h('div', { style: 'position:absolute;left:0;right:0;top:50%;height:2px;background:#dfe7e1;border-radius:1px' }),
        h('div', { style: 'position:absolute;left:0;top:50%;width:' + pct + '%;height:2px;background:#12936a' }),
        dots,
        h('span', { style: 'position:absolute;left:' + pct + '%;top:2px;bottom:2px;width:1.5px;background:#14201a' })
      );

      // "pressure" = share of this match's goals/cards in the last 10 game-minutes, per team — derived from real events
      var curMin = minuteOf(snap);
      var recent = events.filter(function (e) { return curMin - e.payload.minute <= 10; });
      var recentA = recent.filter(function (e) { return e.payload.team === 0; }).length;
      var recentB = recent.filter(function (e) { return e.payload.team === 1; }).length;
      var pressurePct = (recentA + recentB) ? Math.round((recentA / (recentA + recentB)) * 100) : 50;
      var pressureRow = h('div', { style: 'display:flex;align-items:center;justify-content:space-between' },
        h('span', { style: 'font-size:11px;font-weight:700;letter-spacing:.06em;color:#9aa8a0;text-transform:uppercase' }, 'Pressure · last 10 min'),
        h('span', { style: 'font-family:\'DM Mono\',monospace;font-size:10px;color:#12936a' }, teams[0].name.toUpperCase() + ' ' + pressurePct + '%')
      );
      var pressureBar = h('div', { style: 'height:6px;border-radius:3px;background:#eef1ee;overflow:hidden;display:flex' },
        h('div', { style: 'width:' + pressurePct + '%;background:#12936a' }),
        h('div', { style: 'flex:1;background:#b8862e' })
      );

      var momentsRow = h('div', { style: 'display:flex;align-items:center;justify-content:space-between' },
        h('span', { style: 'font-size:11px;font-weight:700;letter-spacing:.06em;color:#9aa8a0;text-transform:uppercase' }, 'Key moments')
      );
      var moments = events.slice().reverse().slice(0, 6);
      var momentsList = moments.length
        ? moments.map(function (e) {
          var text = e.action === 'goal'
            ? h('span', { style: 'font-size:12px' }, h('b', { style: 'color:#12936a' }, 'GOAL! '), e.payload.name + ' scores')
            : h('span', { style: 'font-size:12px' }, h('b', null, e.payload.type === 'red' ? 'RED CARD' : 'YELLOW CARD'), ' — ' + e.payload.name);
          return h('div', { style: 'background:#fff;border-radius:13px;padding:9px 12px;box-shadow:0 1px 3px rgba(20,40,30,.06);display:flex;gap:9px;align-items:center' },
            h('span', { style: 'font-family:\'DM Mono\',monospace;font-size:9px;color:#9aa8a0;width:30px;flex:none' }, e.payload.minute + '\''),
            text
          );
        })
        : [h('div', { style: 'text-align:center;color:#9aa8a0;font-size:12px' }, 'No goals or cards yet')];

      var footer = h('div', { style: 'flex:none;display:flex;align-items:center;gap:8px;padding:8px 13px calc(14px + env(safe-area-inset-bottom))' },
        h('span', { style: 'font-size:10px;color:#9aa8a0;font-weight:600;flex:none' }, '👁 ' + (15 + match.events.length)),
        h('div', { style: 'flex:1;display:flex;gap:6px' },
          h('span', { style: 'background:#fff;border-radius:99px;padding:6px 12px;font-size:12px;box-shadow:0 1px 3px rgba(20,40,30,.08)' }, '🔥 ', h('span', { style: 'font-family:\'DM Mono\',monospace;font-size:10px;color:#6b7a72' }, String(11 + match.events.length))),
          h('span', { style: 'background:#fff;border-radius:99px;padding:6px 12px;font-size:12px;box-shadow:0 1px 3px rgba(20,40,30,.08)' }, '👏 ', h('span', { style: 'font-family:\'DM Mono\',monospace;font-size:10px;color:#6b7a72' }, String(6 + Math.floor(match.events.length / 2))))
        ),
        h('span', { style: 'background:#12936a;color:#fff;border-radius:99px;padding:6px 14px;font-size:11px;font-weight:700;flex:none' }, 'Following ✓')
      );

      el.appendChild(h('div', { style: 'flex:1;display:flex;flex-direction:column;background:#f4f6f3;color:#14201a' },
        kf,
        header,
        tabs,
        h('div', { style: 'flex:1;min-height:0;display:flex;flex-direction:column;padding:8px 13px 0;gap:8px' },
          banner,
          timelineRow,
          timeline,
          pressureRow,
          pressureBar,
          momentsRow,
          h('div', { style: 'display:flex;flex-direction:column;gap:8px' }, momentsList),
          match.status === 'done' && match.result ? h('div', { class: 'banner' }, match.result.summary) : null
        ),
        footer
      ));

      SE.interval(function () {
        clockNum.textContent = SE.fmtClock(elapsedSecondsOf(match.snapshot));
      }, 1000);
    },
  });
})();
