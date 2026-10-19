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
      // soft action from fragment 5h's "⇄ Swap ends" pill — no rule effect, just a logged event
      swapEnds: function (snap) { return { snap: snap, label: '⇄ Ends swapped' }; },
    },

    isOver: function () { return null; }, // manual end only

    headline: function (m) {
      var s = m.snapshot;
      return s.score[0] + '–' + s.score[1] + ' · Q' + s.quarter + ' · PC ' + s.pc[0] + '–' + s.pc[1];
    },

    /* ---------- scorer: 1:1 port of fragment 5h ---------- */
    renderScorer: function (el, match, api) {
      var snap = match.snapshot, cfg = match.config, teams = match.teams;
      var names = [teams[0].name, teams[1].name];

      // fragment 5h's keyframe (geP — the clock/serve pulse dot)
      var kf = h('style', { html: '@keyframes geP{0%,100%{opacity:1}50%{opacity:.35}}' });

      function iconBtn(content, onclick, size) {
        return h('div', {
          style: 'width:32px;height:32px;border-radius:11px;background:#fff;box-shadow:0 1px 2px rgba(20,40,30,.08);display:flex;align-items:center;justify-content:center;font-size:' + (size || 16) + 'px;cursor:pointer',
          onclick: onclick,
        }, content);
      }

      var clockText = h('span', { style: 'font-family:\'DM Mono\',monospace;font-size:22px;font-weight:500;font-variant-numeric:tabular-nums' }, remainingLabel(snap, cfg, Date.now()));
      SE.interval(function () { clockText.textContent = remainingLabel(match.snapshot, cfg, Date.now()); }, 1000);

      // one big score half — exact styles from the fragment; leading side gets the tint + underline
      function half(idx) {
        var leading = snap.score[idx] > snap.score[1 - idx];
        return h('div', {
          style: 'flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;cursor:pointer;-webkit-tap-highlight-color:transparent;user-select:none;'
            + (idx === 0 ? 'border-right:1px solid rgba(20,32,26,.1);' : '')
            + (leading ? 'background:linear-gradient(180deg,rgba(18,147,106,.07),rgba(18,147,106,0));' : ''),
          onclick: function () { api.dispatch('goal', { team: idx, name: names[idx] }); },
        },
          h('span', { style: 'font-family:\'DM Mono\',monospace;font-size:10px;letter-spacing:.14em;color:#6b7a72' }, names[idx].toUpperCase()),
          h('span', { style: 'font-family:\'DM Mono\',monospace;font-size:104px;font-weight:500;line-height:1;font-variant-numeric:tabular-nums' }, String(snap.score[idx])),
          h('span', { style: 'width:44px;height:3px;background:' + (leading ? '#12936a' : 'transparent') + ';border-radius:2px' })
        );
      }

      function pill(label, onclick) {
        return h('div', {
          style: 'flex:1;height:36px;border-radius:12px;border:1.5px solid #e4e9e5;background:#fff;display:flex;align-items:center;justify-content:center;font-size:11.5px;font-weight:600;color:#46554d;cursor:pointer;user-select:none',
          onclick: onclick,
        }, label);
      }

      // fragment 5h shows one generic "PC +1 / Card / Swap" row; our rules need a team on
      // PC + cards, so that row is ported per-team (still the fragment's exact pill style)
      function actionRow(i) {
        return h('div', { style: 'flex:none;display:flex;gap:7px;padding:8px 13px 0' },
          pill(names[i] + ' PC +1', function () { api.dispatch('pc', { team: i, name: names[i] }); }),
          pill('🟩 ' + names[i], function () { api.dispatch('card', { team: i, name: names[i], color: 'green' }); }),
          pill('🟨 ' + names[i], function () { api.dispatch('card', { team: i, name: names[i], color: 'yellow' }); })
        );
      }

      // compact single-line event ticker, styled like the fragment's minute/name feed
      var recent = match.events.slice(-2).reverse();
      var feedLine = recent.length
        ? recent.map(function (ev, i) {
            return h('span', { style: 'display:inline-flex;align-items:center;gap:6px' },
              i > 0 ? h('span', { style: 'color:#dfe7e1' }, '·') : null,
              h('span', { style: 'font-weight:700' }, ev.label)
            );
          })
        : h('span', { style: 'color:#9aa8a0' }, 'No events yet');

      var primaryLabel = snap.quarter >= 4 ? 'End match ✓' : 'End Q' + snap.quarter + ' ✓';
      var primaryClick = function () {
        if (snap.quarter >= 4) {
          if (!confirm('End the match now?')) return;
          api.end(buildResult(snap, teams));
        } else {
          api.dispatch('nextPeriod', Date.now());
        }
      };

      el.appendChild(h('div', { style: 'flex:1;display:flex;flex-direction:column;background:#f4f6f3;color:#14201a' },
        kf,
        // header: back · title/sub · match events shortcut
        h('div', { style: 'flex:none;display:flex;align-items:center;justify-content:space-between;padding:2px 13px 8px' },
          iconBtn('‹', function () { api.nav('#/home'); }),
          h('div', { style: 'text-align:center' },
            h('div', { style: 'font-size:13px;font-weight:700' }, names[0] + ' vs ' + names[1]),
            h('div', { style: 'font-family:\'DM Mono\',monospace;font-size:9px;letter-spacing:.08em;color:#6b7a72;margin-top:1px' }, 'HOCKEY · Q' + snap.quarter)
          ),
          iconBtn('≣', function () { api.nav('#/watch/' + match.id); }, 13)
        ),
        // clock row: pulse dot (live while running) · clock · quarter chip · play/pause
        h('div', { style: 'flex:none;display:flex;align-items:center;justify-content:center;gap:9px;padding:2px 0 6px' },
          h('span', { style: 'width:6px;height:6px;border-radius:50%;background:' + (snap.clockRunning ? '#12936a' : '#c8d1cb') + (snap.clockRunning ? ';animation:geP 1.2s infinite' : '') }),
          clockText,
          h('span', { style: 'font-size:9px;font-weight:700;letter-spacing:.06em;color:#6b7a72;background:#e7ece8;border-radius:99px;padding:3px 9px' }, 'Q' + snap.quarter),
          h('span', {
            style: 'width:24px;height:24px;border-radius:9px;background:#fff;box-shadow:0 1px 2px rgba(20,40,30,.08);display:inline-flex;align-items:center;justify-content:center;font-size:10px;color:#46554d;cursor:pointer',
            onclick: function () { api.dispatch('clockToggle', Date.now()); },
          }, snap.clockRunning ? '⏸' : '▶')
        ),
        // the two giant tap halves
        h('div', { style: 'flex:1;min-height:0;display:flex;border-top:1px solid rgba(20,32,26,.1);border-bottom:1px solid rgba(20,32,26,.1)' },
          half(0), half(1)
        ),
        h('div', { style: 'flex:none;text-align:center;font-size:10px;color:#9aa8a0;font-weight:600;padding:6px 0 0' }, 'tap a side to add a goal'),
        // recent-events ticker + PC total + link to full feed
        h('div', { style: 'flex:none;display:flex;align-items:center;gap:6px;padding:6px 15px 0;white-space:nowrap;overflow:hidden;font-size:11px' },
          feedLine,
          h('span', { style: 'font-family:\'DM Mono\',monospace;font-size:9px;color:#9aa8a0' }, 'PC ' + snap.pc[0] + '–' + snap.pc[1]),
          h('span', { style: 'flex:1' }),
          h('span', { style: 'color:#12936a;font-weight:700;flex:none;cursor:pointer', onclick: function () { api.nav('#/watch/' + match.id); } }, 'all ›')
        ),
        // per-team PC + card pills
        actionRow(0), actionRow(1),
        // fragment's ⇄ Swap ends pill — soft reducer, just logged
        h('div', { style: 'flex:none;display:flex;gap:7px;padding:8px 13px 0' },
          pill('⇄ Swap ends', function () { api.dispatch('swapEnds'); })
        ),
        // undo + end quarter/match
        h('div', { style: 'flex:none;display:flex;gap:7px;padding:8px 13px 0' },
          h('div', { style: 'width:64px;height:44px;border-radius:14px;background:#eef1ee;display:flex;align-items:center;justify-content:center;font-size:16px;color:#46554d;cursor:pointer', onclick: function () { api.undo(); } }, '↩'),
          h('div', { style: 'flex:1;height:44px;border-radius:14px;background:#12936a;color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;box-shadow:0 10px 18px -10px rgba(18,147,106,.7);cursor:pointer', onclick: primaryClick }, primaryLabel)
        ),
        // footer: full event feed link · share live
        h('div', { style: 'flex:none;display:flex;align-items:center;justify-content:space-between;padding:7px 15px calc(10px + env(safe-area-inset-bottom));font-size:11px;font-weight:700;color:#12936a' },
          h('span', { style: 'cursor:pointer', onclick: function () { api.nav('#/watch/' + match.id); } }, 'Match events ›'),
          h('span', { style: 'color:#6b7a72;font-weight:600;cursor:pointer', onclick: function () { api.nav('#/watch/' + match.id); } },
            '👁 ' + (3 + match.events.length % 9) + ' · Share live ', h('span', { style: 'color:#12936a' }, '↗'))
        )
      ));
    },

    /* ---------- spectator: 1:1 port of fragment 6h (read-only) ---------- */
    renderSpectator: function (el, match) {
      var snap = match.snapshot, cfg = match.config, teams = match.teams;
      var names = [teams[0].name, teams[1].name];
      var live = match.status === 'live';

      // fragment 6h's keyframe (geP — the LIVE dot pulse)
      var kf = h('style', { html: '@keyframes geP{0%,100%{opacity:1}50%{opacity:.35}}' });

      function statCell(value, label, color) {
        return h('div', { style: 'flex:1;background:#fff;border-radius:13px;padding:8px;text-align:center;box-shadow:0 1px 3px rgba(20,40,30,.06)' },
          h('div', { style: 'font-family:\'DM Mono\',monospace;font-size:13px;font-weight:500' + (color ? ';color:' + color : '') }, value),
          h('div', { style: 'font-size:9px;color:#9aa8a0;font-weight:600;margin-top:1px' }, label)
        );
      }

      var leaderIdx = snap.score[0] === snap.score[1] ? null : (snap.score[0] > snap.score[1] ? 0 : 1);
      var statusLine = !live ? 'FULL TIME' : (leaderIdx == null ? 'ALL EVEN' : names[leaderIdx].toUpperCase() + ' PRESSING');

      var quarterCells = [0, 1, 2, 3].map(function (qi) {
        var reached = qi <= snap.quarter - 1;
        var current = qi === snap.quarter - 1 && live;
        var g = snap.quarterGoals[qi];
        return h('div', { style: 'flex:1' + (qi > 0 ? ';border-left:1px solid #eef1ee' : '') + (reached ? '' : ';color:#b3bdb6') },
          h('div', { style: 'font-size:8px;color:#9aa8a0' }, 'Q' + (qi + 1)),
          h('div', { style: current ? 'color:#12936a;font-weight:500' : '' }, reached ? g[0] + '–' + g[1] : '—')
        );
      });

      // last two events: newest at full opacity, previous dimmed, exactly like the fragment
      var recent = match.events.slice(-2).reverse();
      function tagFor(ev) {
        if (ev.action === 'goal') return { text: 'GOAL', color: '#12936a' };
        if (ev.action === 'pc') return { text: 'PENALTY CORNER', color: '#12936a' };
        if (ev.action === 'card') return { text: (ev.payload && ev.payload.color === 'yellow' ? 'YELLOW CARD' : 'GREEN CARD'), color: '#3e8266' };
        return { text: 'EVENT', color: '#3e8266' };
      }
      function minuteFor(ev) { return Math.max(0, Math.floor((ev.ts - match.startedAt) / 60000)) + '\''; }

      el.appendChild(h('div', { style: 'flex:1;display:flex;flex-direction:column;background:#f4f6f3;color:#14201a' },
        kf,
        // header: back · title + LIVE badge · share
        h('div', { style: 'flex:none;display:flex;align-items:center;justify-content:space-between;padding:2px 13px 8px' },
          h('a', { href: '#/home', style: 'width:32px;height:32px;border-radius:11px;background:#fff;box-shadow:0 1px 2px rgba(20,40,30,.08);display:flex;align-items:center;justify-content:center;font-size:16px;color:inherit;text-decoration:none' }, '‹'),
          h('div', { style: 'display:flex;align-items:center;gap:7px' },
            h('span', { style: 'font-size:13px;font-weight:700' }, names[0] + ' vs ' + names[1]),
            live
              ? h('span', { style: 'display:inline-flex;align-items:center;gap:4px;font-size:9px;font-weight:700;color:#d64f43' },
                  h('span', { style: 'width:5px;height:5px;border-radius:50%;background:#d64f43;animation:geP 1.4s infinite' }), 'LIVE')
              : h('span', { style: 'font-size:9px;font-weight:700;color:#6b7a72' }, 'FULL TIME')
          ),
          h('span', { style: 'width:32px;height:32px;border-radius:11px;background:#fff;box-shadow:0 1px 2px rgba(20,40,30,.08);display:flex;align-items:center;justify-content:center;font-size:13px;color:#12936a' }, '↗')
        ),
        // decorative tab strip from the fragment (this prototype has one live view; non-interactive)
        h('div', { style: 'flex:none;display:flex;background:#e7ece8;border-radius:12px;padding:2px;margin:0 13px' },
          h('span', { style: 'flex:1;text-align:center;padding:6px 0;border-radius:10px;background:#fff;font-size:11.5px;font-weight:700;box-shadow:0 1px 2px rgba(20,40,30,.08)' }, 'Live'),
          h('span', { style: 'flex:1;text-align:center;padding:6px 0;font-size:11.5px;font-weight:600;color:#9aa8a0' }, 'Scorecard'),
          h('span', { style: 'flex:1;text-align:center;padding:6px 0;font-size:11.5px;font-weight:600;color:#9aa8a0' }, 'Graphs')
        ),

        h('div', { style: 'flex:1;min-height:0;display:flex;flex-direction:column;padding:8px 13px 0;gap:8px;overflow:hidden' },
          // score banner
          h('div', { style: 'background:#14201a;color:#fff;border-radius:18px;padding:12px 14px;display:flex;align-items:center;justify-content:space-between' },
            h('div', null,
              h('div', { style: 'font-size:10px;color:rgba(255,255,255,.6);font-weight:600' }, names[0].toUpperCase()),
              h('div', { style: 'font-family:\'DM Mono\',monospace;font-size:28px;font-weight:500;color:' + (leaderIdx === 0 ? '#3fd598' : '#fff') }, String(snap.score[0]))
            ),
            h('div', { style: 'text-align:center' },
              h('div', { style: 'font-family:\'DM Mono\',monospace;font-size:11px;font-weight:500' }, 'Q' + snap.quarter + ' · ' + remainingLabel(snap, cfg, Date.now())),
              h('div', { style: 'font-family:\'DM Mono\',monospace;font-size:9px;color:#3fd598;margin-top:2px' }, statusLine)
            ),
            h('div', { style: 'text-align:right' },
              h('div', { style: 'font-size:10px;color:rgba(255,255,255,.6);font-weight:600' }, names[1].toUpperCase()),
              h('div', { style: 'font-family:\'DM Mono\',monospace;font-size:28px;font-weight:500;color:' + (leaderIdx === 1 ? '#3fd598' : '#fff') }, String(snap.score[1]))
            )
          ),
          // quarter-by-quarter goals
          h('div', { style: 'background:#fff;border-radius:13px;box-shadow:0 1px 3px rgba(20,40,30,.06);display:flex;padding:8px 0;text-align:center;font-family:\'DM Mono\',monospace;font-size:11px' }, quarterCells),
          // stat row: PC total · green cards · yellow cards (fragment's 3rd cell repurposed to real data)
          h('div', { style: 'display:flex;gap:8px' },
            statCell(snap.pc[0] + '–' + snap.pc[1], 'PEN. CORNERS'),
            statCell('🟩 ' + (snap.cards[0].green + snap.cards[1].green), 'GREEN CARDS', '#3e8266'),
            statCell('🟨 ' + (snap.cards[0].yellow + snap.cards[1].yellow), 'YELLOW CARDS')
          ),
          h('div', { style: 'display:flex;align-items:center;justify-content:space-between' },
            h('span', { style: 'font-size:11px;font-weight:700;letter-spacing:.06em;color:#9aa8a0;text-transform:uppercase' }, 'Key moments')
          ),
          recent.length
            ? h('div', { style: 'display:flex;flex-direction:column;gap:8px' },
                recent.map(function (ev, i) {
                  var tag = tagFor(ev);
                  return h('div', { style: 'background:#fff;border-radius:13px;padding:9px 12px;box-shadow:0 1px 3px rgba(20,40,30,.06);display:flex;gap:9px;align-items:center' + (i > 0 ? ';opacity:.65' : '') },
                    h('span', { style: 'font-family:\'DM Mono\',monospace;font-size:9px;color:#9aa8a0;width:30px;flex:none' }, minuteFor(ev)),
                    h('span', { style: 'font-size:12px' }, h('b', { style: 'color:' + tag.color }, tag.text), ' — ' + ev.label)
                  );
                })
              )
            : h('div', { style: 'font-size:12px;color:#9aa8a0;text-align:center;padding:8px 0' }, 'No events yet'),
          h('div', { style: 'flex:1' })
        ),

        // footer: viewer count · reaction chips · following status
        h('div', { style: 'flex:none;display:flex;align-items:center;gap:8px;padding:8px 13px 14px' },
          h('span', { style: 'font-size:10px;color:#9aa8a0;font-weight:600;flex:none' }, '👁 ' + (3 + match.events.length % 9)),
          h('div', { style: 'flex:1;display:flex;gap:6px' },
            h('span', { style: 'background:#fff;border-radius:99px;padding:6px 12px;font-size:12px;box-shadow:0 1px 3px rgba(20,40,30,.08)' }, '🔥 ', h('span', { style: 'font-family:\'DM Mono\',monospace;font-size:10px;color:#6b7a72' }, String(match.events.length))),
            h('span', { style: 'background:#fff;border-radius:99px;padding:6px 12px;font-size:12px;box-shadow:0 1px 3px rgba(20,40,30,.08)' }, '👏 ', h('span', { style: 'font-family:\'DM Mono\',monospace;font-size:10px;color:#6b7a72' }, String(Math.max(0, match.events.length - 2))))
          ),
          h('span', { style: 'background:#12936a;color:#fff;border-radius:99px;padding:6px 14px;font-size:11px;font-weight:700;flex:none' }, live ? 'Following ✓' : 'Final')
        )
      ));
    },
  });
})();
