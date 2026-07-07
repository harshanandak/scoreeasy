/* Hockey — quarters, goals, penalty corners, green/yellow cards.
   Clock is display-only: wall-clock elapsed folds into snapshot.elapsedMs on
   clockToggle/nextPeriod (payload = Date.now() from the caller), never dispatched
   from a ticking interval. Match ends manually via api.end (isOver always null). */
(function () {
  'use strict';
  var h = SE.h;

  function cloneScore(a) { return a.slice(); }

  // elapsed ms folded to "now", without mutating snap
  function foldElapsed(snap, now) {
    if (!snap.clockRunning) return snap.elapsedMs;
    return snap.elapsedMs + Math.max(0, now - snap.clockStartedAt);
  }

  function remainingLabel(snap, cfg, now) {
    var totalSec = (cfg.quarterMinutes || 15) * 60;
    var elapsedSec = Math.floor(foldElapsed(snap, now) / 1000);
    return SE.fmtClock(Math.max(0, totalSec - elapsedSec));
  }

  function buildResult(snap, teams) {
    var a = snap.score[0], b = snap.score[1];
    if (a === b) return { summary: 'Match drawn ' + a + '–' + b, winnerIndex: null };
    var wi = a > b ? 0 : 1;
    return { summary: teams[wi].name + ' won ' + Math.max(a, b) + '–' + Math.min(a, b), winnerIndex: wi };
  }

  SE.registerSport({
    key: 'hockey', label: 'Hockey', icon: '🏑', priority: 8,
    tagline: 'quarters & PCs',
    sampleTeams: ['Lions', 'Falcons'],
    defaultConfig: { quarterMinutes: 15 },
    setupFields: [
      { key: 'quarterMinutes', label: 'Quarter length', type: 'choice',
        options: [{ label: '10 min', value: 10 }, { label: '15 min', value: 15 }] },
    ],

    init: function () {
      return {
        score: [0, 0],
        pc: [0, 0],
        cards: [{ green: 0, yellow: 0 }, { green: 0, yellow: 0 }],
        quarter: 1,
        clockRunning: false,
        clockStartedAt: null,
        elapsedMs: 0,
        quarterGoals: [[0, 0], [0, 0], [0, 0], [0, 0]],
      };
    },

    actions: {
      goal: function (snap, cfg, payload) {
        var score = cloneScore(snap.score);
        score[payload.team]++;
        var qg = snap.quarterGoals.map(cloneScore);
        var qi = Math.min(snap.quarter, 4) - 1;
        qg[qi][payload.team]++;
        return {
          snap: Object.assign({}, snap, { score: score, quarterGoals: qg }),
          label: payload.name + ' goal · ' + score[0] + '–' + score[1],
        };
      },
      pc: function (snap, cfg, payload) {
        var pc = cloneScore(snap.pc);
        pc[payload.team]++;
        return { snap: Object.assign({}, snap, { pc: pc }), label: payload.name + ' penalty corner' };
      },
      card: function (snap, cfg, payload) {
        var cards = snap.cards.map(function (c) { return Object.assign({}, c); });
        cards[payload.team][payload.color]++;
        return {
          snap: Object.assign({}, snap, { cards: cards }),
          label: payload.name + ' ' + payload.color + ' card',
        };
      },
      clockToggle: function (snap, cfg, payload) {
        if (snap.clockRunning) {
          return {
            snap: Object.assign({}, snap, {
              clockRunning: false, clockStartedAt: null, elapsedMs: foldElapsed(snap, payload),
            }),
            label: 'Clock paused',
          };
        }
        return {
          snap: Object.assign({}, snap, { clockRunning: true, clockStartedAt: payload }),
          label: 'Clock started',
        };
      },
      nextPeriod: function (snap, cfg, payload) {
        if (snap.quarter >= 4) return { snap: snap, label: 'Final quarter' };
        foldElapsed(snap, payload); // fold is informational only; period reset zeroes the clock
        return {
          snap: Object.assign({}, snap, {
            quarter: snap.quarter + 1, clockRunning: false, clockStartedAt: null, elapsedMs: 0,
          }),
          label: 'End of Q' + snap.quarter,
        };
      },
    },

    isOver: function () { return null; }, // manual end only

    headline: function (m) {
      var s = m.snapshot;
      return s.score[0] + '–' + s.score[1] + ' · Q' + s.quarter + ' · PC ' + s.pc[0] + '–' + s.pc[1];
    },

    renderScorer: function (el, match, api) {
      var snap = match.snapshot, cfg = match.config, teams = match.teams;

      var clockText = h('span', { class: 'mono bignum', style: 'font-size:22px' }, remainingLabel(snap, cfg, Date.now()));
      SE.interval(function () { clockText.textContent = remainingLabel(match.snapshot, cfg, Date.now()); }, 1000);

      function teamPanel(i) {
        var leading = snap.score[i] > snap.score[1 - i];
        return h('div', {
          class: 'tapzone' + (leading ? ' leading' : ''),
          style: 'flex:1;padding:20px 6px;display:flex;flex-direction:column;align-items:center;gap:6px;border-radius:0',
          onclick: function () { api.dispatch('goal', { team: i, name: teams[i].name }); },
        },
          h('span', { class: 'microlabel' }, teams[i].name.toUpperCase()),
          h('span', { class: 'bignum', style: 'font-size:60px' }, String(snap.score[i]))
        );
      }

      function actionRow(i) {
        return h('div', { class: 'actionstrip' },
          h('button', {
            class: 'btn', onclick: function () { api.dispatch('pc', { team: i, name: teams[i].name }); },
          }, teams[i].name + ' PC +1'),
          h('button', {
            class: 'btn', onclick: function () { api.dispatch('card', { team: i, name: teams[i].name, color: 'green' }); },
          }, '🟩 ' + teams[i].name),
          h('button', {
            class: 'btn', onclick: function () { api.dispatch('card', { team: i, name: teams[i].name, color: 'yellow' }); },
          }, '🟨 ' + teams[i].name)
        );
      }

      var recent = match.events.slice(-3).reverse();
      var primaryLabel = snap.quarter >= 4 ? 'End match ✓' : 'End Q' + snap.quarter + ' →';
      var primaryClick = function () {
        if (snap.quarter >= 4) {
          if (!confirm('End the match now?')) return;
          api.end(buildResult(snap, teams));
        } else {
          api.dispatch('nextPeriod', Date.now());
        }
      };

      el.appendChild(h('div', { class: 'screen' },
        SE.topbar({ title: teams[0].name + ' vs ' + teams[1].name, sub: 'Hockey · Q' + snap.quarter }),

        h('div', { class: 'row', style: 'justify-content:center;gap:10px' },
          h('span', { class: 'chip live' }, ''),
          clockText,
          h('span', { class: 'chip' }, 'Q' + snap.quarter),
          h('button', {
            class: 'btn ghost', style: 'padding:6px 10px',
            onclick: function () { api.dispatch('clockToggle', Date.now()); },
          }, snap.clockRunning ? '⏸' : '▶')
        ),

        h('div', { class: 'card row', style: 'padding:0;overflow:hidden' }, teamPanel(0), teamPanel(1)),
        h('div', { class: 'center muted', style: 'font-size:11px' }, 'tap a side to add a goal'),

        h('div', { class: 'card', style: 'display:flex;flex-direction:column;gap:6px' },
          h('div', { class: 'microlabel' }, 'PENALTY CORNERS & CARDS'),
          actionRow(0), actionRow(1),
          h('div', { class: 'row mono muted', style: 'font-size:11px;justify-content:space-between' },
            h('span', null, 'PC ' + snap.pc[0] + '–' + snap.pc[1]),
            h('span', null, '🟩' + (snap.cards[0].green + snap.cards[1].green) + ' 🟨' + (snap.cards[0].yellow + snap.cards[1].yellow))
          )
        ),

        recent.length ? h('div', { class: 'card', style: 'display:flex;flex-direction:column;gap:4px' },
          h('div', { class: 'microlabel' }, 'RECENT'),
          recent.map(function (ev) { return h('div', { class: 'mono', style: 'font-size:11px' }, ev.label); })
        ) : null,

        h('div', { class: 'spacer', style: 'flex:1' }),
        h('div', { class: 'row', style: 'gap:8px' },
          h('button', { class: 'btn', style: 'padding:12px 16px', onclick: function () { api.undo(); } }, '↩'),
          h('button', { class: 'btn primary block', onclick: primaryClick }, primaryLabel)
        )
      ));
    },

    renderSpectator: function (el, match) {
      var snap = match.snapshot, cfg = match.config, teams = match.teams;

      var quarterCells = [0, 1, 2, 3].map(function (qi) {
        var reached = qi <= snap.quarter - 1;
        var g = snap.quarterGoals[qi];
        return h('div', { style: 'flex:1;text-align:center' },
          h('div', { class: 'microlabel' }, 'Q' + (qi + 1)),
          h('div', { class: 'mono', style: 'font-size:13px' }, reached ? g[0] + '–' + g[1] : '—')
        );
      });

      var pcTotal = snap.pc[0] + snap.pc[1] || 1;
      var pcLeftPct = Math.round(snap.pc[0] / pcTotal * 100);
      var recent = match.events.slice(-6).reverse();

      el.appendChild(h('div', { class: 'screen' },
        SE.topbar({
          title: teams[0].name + ' vs ' + teams[1].name,
          sub: (match.status === 'live' ? 'LIVE · ' : '') + 'Hockey',
          back: '#/home',
        }),

        h('div', { style: 'background:var(--ink);color:#fff;border-radius:var(--r-card);padding:14px;display:flex;align-items:center;justify-content:space-between' },
          h('div', null,
            h('div', { style: 'font-size:10px;opacity:.7;font-weight:600' }, teams[0].name.toUpperCase()),
            h('div', { class: 'mono', style: 'font-size:26px' }, String(snap.score[0]))
          ),
          h('div', { class: 'center' },
            h('div', { class: 'mono', style: 'font-size:12px' }, 'Q' + snap.quarter + ' · ' + remainingLabel(snap, cfg, Date.now())),
            h('div', { class: 'mono', style: 'font-size:9px;color:var(--accent-live);margin-top:2px' }, match.status === 'live' ? 'IN PLAY' : 'FULL TIME')
          ),
          h('div', { style: 'text-align:right' },
            h('div', { style: 'font-size:10px;opacity:.7;font-weight:600' }, teams[1].name.toUpperCase()),
            h('div', { class: 'mono', style: 'font-size:26px' }, String(snap.score[1]))
          )
        ),

        h('div', { class: 'card row', style: 'padding:8px 0' }, quarterCells),

        h('div', { class: 'card' },
          h('div', { class: 'row', style: 'justify-content:space-between' },
            h('span', { class: 'microlabel' }, 'PENALTY CORNERS'),
            h('span', { class: 'mono', style: 'font-size:12px' }, snap.pc[0] + '–' + snap.pc[1])
          ),
          h('div', { style: 'display:flex;height:8px;border-radius:99px;overflow:hidden;background:var(--surface);margin-top:8px' },
            h('div', { style: 'width:' + pcLeftPct + '%;background:var(--accent)' }),
            h('div', { style: 'flex:1;background:var(--line)' })
          )
        ),

        h('div', { class: 'row', style: 'gap:8px' },
          h('div', { class: 'card center', style: 'flex:1;padding:10px' },
            h('div', { class: 'mono', style: 'font-size:13px' }, '🟩 ' + (snap.cards[0].green + snap.cards[1].green)),
            h('div', { class: 'microlabel', style: 'margin-top:2px' }, 'GREEN')
          ),
          h('div', { class: 'card center', style: 'flex:1;padding:10px' },
            h('div', { class: 'mono', style: 'font-size:13px' }, '🟨 ' + (snap.cards[0].yellow + snap.cards[1].yellow)),
            h('div', { class: 'microlabel', style: 'margin-top:2px' }, 'YELLOW')
          )
        ),

        h('div', { class: 'microlabel' }, 'EVENT FEED'),
        recent.length ? h('div', { style: 'display:flex;flex-direction:column;gap:6px' },
          recent.map(function (ev) {
            return h('div', { class: 'card row', style: 'padding:9px 12px' },
              h('span', { style: 'font-size:12px' }, ev.label)
            );
          })
        ) : h('div', { class: 'muted center', style: 'font-size:12px' }, 'No events yet')
      ));
    },
  });
})();
