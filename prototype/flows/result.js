/* Result moment (celebration takeover) + rematch sheet. Generic over any sport def —
   reads only match.result, match.teams, match.config, match.events, and (optionally)
   def.headline. Fragments: 3a-result-moment.html, 3b-rematch-sheet.html. */
(function () {
  'use strict';
  var h = SE.h;

  // head-to-head win tally between two named teams, across all finished matches
  function h2h(teamA, teamB) {
    var wins = {}; wins[teamA] = 0; wins[teamB] = 0;
    SE.doneMatches().forEach(function (m) {
      var names = [m.teams[0].name, m.teams[1].name];
      if (names.indexOf(teamA) === -1 || names.indexOf(teamB) === -1) return;
      var wi = m.result && m.result.winnerIndex;
      if (wi === 0 || wi === 1) wins[m.teams[wi].name] = (wins[m.teams[wi].name] || 0) + 1;
    });
    return wins;
  }

  /* ---------- Result takeover (#/result/:id) — 1:1 port of fragment 3a ---------- */
  SE.registerScreen('result', function (root, args) {
    var m = SE.store.get().matches[args[0]];
    if (!m) return SE.nav('#/home');
    if (m.status === 'live') return SE.nav('#/score/' + m.id);

    var def = SE.sports[m.sport];
    var result = m.result || { summary: 'Match ended', winnerIndex: null };
    var winner = result.winnerIndex != null ? m.teams[result.winnerIndex] : null;
    var durSecs = m.endedAt && m.startedAt ? Math.max(0, Math.round((m.endedAt - m.startedAt) / 1000)) : 0;
    var events = m.events || [];

    var t0 = m.teams[0].name, t1 = m.teams[1].name;
    var rec = h2h(t0, t1);
    var meetings = (rec[t0] || 0) + (rec[t1] || 0);
    var margin = Math.abs((rec[t0] || 0) - (rec[t1] || 0));

    var shareLabel = h('span', null, 'Share card ↗');
    function share() {
      var text = t0 + ' vs ' + t1 + ' — ' + result.summary;
      function flash() { shareLabel.textContent = 'Copied ✓'; setTimeout(function () { shareLabel.textContent = 'Share card ↗'; }, 1400); }
      try { navigator.clipboard.writeText(text).then(flash, flash); }
      catch (e) { flash(); }
    }

    root.appendChild(h('div', { style: 'flex:1;display:flex;flex-direction:column;background:#f4f6f3;color:#14201a' },
      h('div', { style: 'flex:1;min-height:0;display:flex;flex-direction:column;padding:8px 15px;gap:11px' },

        // hero: solid green celebration card with sparkle accents (verbatim from 3a)
        h('div', { style: 'background:#12936a;border-radius:20px;padding:20px 16px;color:#fff;text-align:center;box-shadow:0 14px 28px -14px rgba(18,147,106,.8);position:relative;overflow:hidden' },
          h('div', { style: 'position:absolute;left:14px;top:12px;font-size:12px;opacity:.5' }, '✦'),
          h('div', { style: 'position:absolute;right:20px;top:26px;font-size:9px;opacity:.5' }, '✦'),
          h('div', { style: 'position:absolute;left:40px;bottom:18px;font-size:10px;opacity:.4' }, '✦'),
          h('div', { style: 'position:absolute;right:34px;bottom:34px;font-size:12px;opacity:.45' }, '✦'),
          h('div', { class: 'mono', style: 'font-size:10px;letter-spacing:.2em;opacity:.75' }, (def.label || m.sport).toUpperCase() + ' · FULL TIME'),
          h('div', { style: 'font-size:28px;font-weight:800;letter-spacing:-.02em;margin-top:8px' }, winner ? winner.name.toUpperCase() + ' WIN' : 'MATCH OVER'),
          h('div', { style: 'font-size:13px;opacity:.85;margin-top:3px' }, result.summary),
          h('div', { class: 'mono', style: 'display:flex;justify-content:center;gap:18px;margin-top:14px;font-size:13px' },
            m.teams.map(function (t, i) {
              return h('span', { style: i === result.winnerIndex ? 'font-weight:600' : 'opacity:.75' }, t.name);
            })
          )
        ),

        // head-to-head hype line — real data from SE.doneMatches(), stands in for the
        // fragment's "Player of the Match" card (no per-player stat model in this app)
        meetings ? h('div', { style: 'background:#fff;border-radius:16px;padding:11px 14px;box-shadow:0 1px 3px rgba(20,40,30,.06);display:flex;align-items:center;gap:9px' },
          h('span', { style: 'font-size:14px' }, '🔥'),
          h('span', { style: 'font-size:12px;flex:1' },
            'Head-to-head now ',
            h('b', null, t0 + ' ' + (rec[t0] || 0) + ' – ' + (rec[t1] || 0) + ' ' + t1),
            margin === 1 ? ' — one more levels it' : ''
          )
        ) : null,

        // 3-up stat row (duration / events / sport headline — generic stand-in for
        // fragment's sixes/viewers/overs, which are cricket-specific)
        h('div', { style: 'display:flex;gap:8px' },
          h('div', { style: 'flex:1;background:#fff;border-radius:14px;padding:10px;text-align:center;box-shadow:0 1px 3px rgba(20,40,30,.06)' },
            h('div', { class: 'mono', style: 'font-size:16px;font-weight:500' }, SE.fmtClock(durSecs)),
            h('div', { style: 'font-size:9px;color:#9aa8a0;font-weight:600;margin-top:2px' }, 'DURATION')),
          h('div', { style: 'flex:1;background:#fff;border-radius:14px;padding:10px;text-align:center;box-shadow:0 1px 3px rgba(20,40,30,.06)' },
            h('div', { class: 'mono', style: 'font-size:16px;font-weight:500' }, String(events.length)),
            h('div', { style: 'font-size:9px;color:#9aa8a0;font-weight:600;margin-top:2px' }, 'EVENTS')),
          def.headline ? h('div', { style: 'flex:1;background:#fff;border-radius:14px;padding:10px;text-align:center;box-shadow:0 1px 3px rgba(20,40,30,.06)' },
            h('div', { class: 'mono', style: 'font-size:16px;font-weight:500' }, def.headline(m)),
            h('div', { style: 'font-size:9px;color:#9aa8a0;font-weight:600;margin-top:2px' }, 'FINAL')) : null
        ),

        h('div', { style: 'flex:1' }),

        h('div', { style: 'display:flex;gap:8px' },
          h('div', { style: 'flex:1;background:#fff;border:1.5px solid #12936a;color:#12936a;border-radius:16px;padding:13px 0;text-align:center;font-size:13px;font-weight:700;cursor:pointer', onclick: share }, shareLabel),
          h('div', { style: 'flex:1;background:#12936a;color:#fff;border-radius:16px;padding:13px 0;text-align:center;font-size:13px;font-weight:700;box-shadow:0 12px 22px -12px rgba(18,147,106,.7);cursor:pointer', onclick: function () { SE.nav('#/rematch/' + m.id); } }, 'Rematch ↻')
        ),
        h('div', { style: 'text-align:center;font-size:12px;font-weight:600;color:#9aa8a0;padding-bottom:4px;cursor:pointer', onclick: function () { SE.nav('#/home'); } }, 'Done for today')
      )
    ));
  });

  /* ---------- Rematch sheet (#/rematch/:id) — 1:1 port of fragment 3b ---------- */
  SE.registerScreen('rematch', function (root, args) {
    var m = SE.store.get().matches[args[0]];
    if (!m) return SE.nav('#/home');
    var def = SE.sports[m.sport];
    var names = [m.teams[0].name, m.teams[1].name];
    var swapped = false;

    function initial(name) { return (name || '?').trim().charAt(0).toUpperCase(); }

    var avatar1 = h('span', { style: 'width:26px;height:26px;border-radius:8px;background:#2f7bd6;color:#fff;font-size:11px;font-weight:800;display:inline-flex;align-items:center;justify-content:center' }, initial(names[0]));
    var avatar2 = h('span', { style: 'width:26px;height:26px;border-radius:8px;background:#d64f43;color:#fff;font-size:11px;font-weight:800;display:inline-flex;align-items:center;justify-content:center' }, initial(names[1]));
    var team1El = h('span', { style: 'font-size:13px;font-weight:700' }, names[0]);
    var team2El = h('span', { style: 'font-size:13px;font-weight:700' }, names[1]);
    var swapBtn = h('span', {
      style: 'font-size:12px;color:#12936a;font-weight:700;cursor:pointer',
      onclick: function () {
        swapped = !swapped;
        team1El.textContent = swapped ? names[1] : names[0];
        team2El.textContent = swapped ? names[0] : names[1];
        avatar1.textContent = initial(swapped ? names[1] : names[0]);
        avatar2.textContent = initial(swapped ? names[0] : names[1]);
      }
    }, '⇄ Swap');

    var fieldsByKey = {};
    (def.setupFields || []).forEach(function (f) { fieldsByKey[f.key] = f; });
    var cfgChips = Object.keys(m.config || {}).map(function (k) {
      var f = fieldsByKey[k];
      var val = m.config[k];
      if (f && f.type === 'choice') {
        var opt = (f.options || []).filter(function (o) { return o.value === val; })[0];
        if (opt) val = opt.label;
      }
      return h('span', { style: 'background:#e7f4ee;color:#12936a;border-radius:99px;padding:5px 11px;font-size:11px;font-weight:700' }, (f ? f.label : k) + ' ' + val);
    });
    var ground = SE.store.get().settings.ground || 'turf';
    var groundChip = h('span', { style: 'background:#e7f4ee;color:#12936a;border-radius:99px;padding:5px 11px;font-size:11px;font-weight:700' },
      ground.charAt(0).toUpperCase() + ground.slice(1) + ' rules');
    var editChip = h('span', {
      style: 'background:#f4f6f3;color:#6b7a72;border-radius:99px;padding:5px 11px;font-size:11px;font-weight:600;cursor:pointer',
      onclick: function () { SE.nav('#/setup/' + m.sport); }
    }, 'Edit setup ›');

    var rec = h2h(names[0], names[1]);
    var wa = rec[names[0]] || 0, wb = rec[names[1]] || 0;
    var h2hNote = !(wa + wb) ? 'First meeting — head-to-head starts here'
      : wa === wb ? 'Head-to-head tied ' + wa + '–' + wb + ' — this one breaks it'
      : Math.abs(wa - wb) === 1 ? 'Win this and the head-to-head is level ' + Math.max(wa, wb) + '–' + Math.max(wa, wb)
      : (wa > wb ? names[0] : names[1]) + ' leads the head-to-head ' + Math.max(wa, wb) + '–' + Math.min(wa, wb);

    root.appendChild(h('div', { style: 'flex:1;display:flex;flex-direction:column;background:#f4f6f3;position:relative' },
      // dimmed backdrop — decorative placeholder blocks per fragment (not a live
      // re-render of the result screen behind the sheet)
      h('div', { style: 'flex:1;opacity:.35;padding:8px 15px' },
        h('div', { style: 'background:#12936a;border-radius:20px;height:130px' }),
        h('div', { style: 'background:#fff;border-radius:16px;height:56px;margin-top:11px' }),
        h('div', { style: 'background:#fff;border-radius:16px;height:44px;margin-top:8px' })
      ),
      // bottom sheet
      h('div', { style: 'flex:none;background:#fff;border-radius:26px 26px 0 0;box-shadow:0 -12px 34px rgba(20,40,30,.18);padding:14px 16px calc(18px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:11px' },
        h('div', { style: 'width:36px;height:4px;border-radius:2px;background:#dfe7e1;margin:0 auto' }),
        h('div', { style: 'font-size:17px;font-weight:800' }, 'Rematch'),
        h('div', { style: 'background:#f4f6f3;border-radius:14px;padding:11px 13px;display:flex;align-items:center;gap:10px' },
          h('div', { style: 'display:flex;align-items:center;gap:6px;flex:1;flex-wrap:wrap' },
            avatar1, team1El, h('span', { style: 'font-size:11px;color:#9aa8a0' }, 'vs'), avatar2, team2El
          ),
          swapBtn
        ),
        h('div', { style: 'display:flex;flex-wrap:wrap;gap:6px' },
          h('span', { style: 'background:#e7f4ee;color:#12936a;border-radius:99px;padding:5px 11px;font-size:11px;font-weight:700' }, def.icon + ' ' + def.label),
          cfgChips, groundChip, editChip
        ),
        h('div', { style: 'background:#fff;border:1px solid #e7ebe7;border-radius:14px;padding:10px 13px;display:flex;align-items:center;gap:9px' },
          h('span', { style: 'font-size:13px' }, '🎯'),
          h('span', { style: 'font-size:12px;flex:1' }, h2hNote)
        ),
        h('div', {
          style: 'background:#12936a;color:#fff;border-radius:16px;padding:14px 0;text-align:center;font-size:15px;font-weight:700;box-shadow:0 12px 22px -12px rgba(18,147,106,.7);cursor:pointer',
          onclick: function () {
            var teams = swapped ? [{ name: names[1] }, { name: names[0] }] : [{ name: names[0] }, { name: names[1] }];
            var id = SE.newMatch(m.sport, teams, m.config);
            SE.nav('#/score/' + id);
          }
        }, 'Play now'),
        h('div', { style: 'display:flex;gap:8px' },
          h('div', {
            style: 'flex:1;background:#f4f6f3;border-radius:14px;padding:11px 0;text-align:center;font-size:12px;font-weight:700;color:#14201a;cursor:pointer',
            onclick: function () {
              var when = prompt('When? e.g. Sun 4 PM', '');
              if (when == null) return;
              var teams = swapped ? [{ name: names[1] }, { name: names[0] }] : [{ name: names[0] }, { name: names[1] }];
              SE.store.update(function (st) { st.scheduled.push({ sport: m.sport, title: teams[0].name + ' vs ' + teams[1].name, when: when }); });
              SE.nav('#/schedule');
            }
          }, 'Schedule'),
          h('div', {
            style: 'flex:1;background:#f4f6f3;border-radius:14px;padding:11px 0;text-align:center;font-size:12px;font-weight:700;color:#6b7a72;cursor:pointer',
            onclick: function () {
              var teams = swapped ? [{ name: names[1] }, { name: names[0] }] : [{ name: names[0] }, { name: names[1] }];
              SE.store.update(function (st) { st.scheduled.push({ sport: m.sport, title: teams[0].name + ' vs ' + teams[1].name, when: '' }); });
              SE.nav('#/schedule');
            }
          }, 'Later, no time')
        )
      )
    ));
  });
})();
