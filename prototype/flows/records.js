/* Records screen ("why the next game matters"): aggregates SE.doneMatches()
   into overall W/L, streaks (current + season-best), head-to-head rivalries,
   and a per-sport tally. Generic over any sport — only reads teams/result/sport.
   Fragment: 3c-streaks-and-records.html. */
(function () {
  'use strict';
  var h = SE.h;

  function aggregate(matches) {
    var teams = {};   // name -> { wins, losses, streakType, streakLen, bestStreak, history }
    var h2h = {};      // 'A|B' (sorted) -> { names:[a,b], wins:{name:count} }
    var bySport = {};  // sportKey -> count

    // chronological order so streaks accumulate correctly
    var chron = matches.slice().sort(function (a, b) { return a.endedAt - b.endedAt; });

    chron.forEach(function (m) {
      bySport[m.sport] = (bySport[m.sport] || 0) + 1;
      var t0 = m.teams[0].name, t1 = m.teams[1].name;
      [t0, t1].forEach(function (n) {
        if (!teams[n]) teams[n] = { wins: 0, losses: 0, streakType: null, streakLen: 0, bestStreak: 0, history: [] };
      });

      var key = [t0, t1].sort().join('|');
      if (!h2h[key]) h2h[key] = { names: [t0, t1].sort(), wins: {} };

      var wi = m.result && m.result.winnerIndex;
      if (wi === 0 || wi === 1) {
        var winner = m.teams[wi].name, loser = m.teams[1 - wi].name;
        teams[winner].wins++;
        teams[loser].losses++;
        h2h[key].wins[winner] = (h2h[key].wins[winner] || 0) + 1;

        [[winner, 'W'], [loser, 'L']].forEach(function (pair) {
          var t = teams[pair[0]];
          if (t.streakType === pair[1]) t.streakLen++; else { t.streakType = pair[1]; t.streakLen = 1; }
          if (pair[1] === 'W' && t.streakLen > t.bestStreak) t.bestStreak = t.streakLen;
          t.history.push(pair[1]);
        });
      }
      // draws (winnerIndex null) count toward games/h2h but don't touch streaks
    });

    return { teams: teams, h2h: h2h, bySport: bySport };
  }

  SE.registerScreen('records', function (root) {
    var matches = SE.doneMatches();

    if (!matches.length) {
      root.appendChild(h('div', { style: 'flex:1;display:flex;flex-direction:column;background:#f4f6f3;color:#14201a;padding:8px 15px;gap:11px' },
        h('span', { style: 'font-size:16px;color:#6b7a72;cursor:pointer', onclick: function () { SE.nav('#/home'); } }, '‹ Home'),
        h('div', { style: 'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;padding:0 16px' },
          h('div', { style: 'font-size:32px' }, '🏆'),
          h('div', { style: 'font-weight:700;font-size:15px' }, 'No finished matches yet'),
          h('div', { style: 'color:#6b7a72;font-size:12px' },
            "Play a match and it'll show up here — streaks, head-to-heads, the works."),
          h('div', {
            style: 'background:#12936a;color:#fff;border-radius:16px;padding:12px 22px;font-size:13px;font-weight:700;cursor:pointer',
            onclick: function () { SE.nav('#/pick'); }
          }, 'Start a match')
        )
      ));
      return;
    }

    var agg = aggregate(matches);
    var teamNames = Object.keys(agg.teams).sort(function (a, b) {
      var ta = agg.teams[a], tb = agg.teams[b];
      return (tb.wins - tb.losses) - (ta.wins - ta.losses);
    });
    var onStreak = teamNames.filter(function (n) {
      return agg.teams[n].streakType === 'W' && agg.teams[n].streakLen >= 2;
    });
    var headline = onStreak.length ? onStreak[0] : teamNames[0];
    var ht = agg.teams[headline];

    var milestone = (Math.floor(matches.length / 20) + 1) * 20;
    var toGo = milestone - matches.length;
    var pct = Math.min(100, Math.round(matches.length / milestone * 100));

    root.appendChild(h('div', { style: 'flex:1;display:flex;flex-direction:column;background:#f4f6f3;color:#14201a' },
      h('div', { style: 'flex:1;display:flex;flex-direction:column;padding:8px 15px;gap:11px;padding-bottom:calc(20px + env(safe-area-inset-bottom))' },

        h('div', { style: 'display:flex;align-items:center;justify-content:space-between' },
          h('div', { style: 'font-size:18px;font-weight:800' }, 'Your season'),
          h('span', { class: 'mono', style: 'font-size:10px;color:#9aa8a0' }, headline ? headline.toUpperCase() : 'ALL TEAMS')
        ),

        ht ? h('div', { style: 'background:#14201a;color:#fff;border-radius:18px;padding:14px 15px' },
          h('div', { style: 'display:flex;align-items:baseline;gap:8px' },
            h('span', { class: 'mono', style: 'font-size:32px;font-weight:500;color:#3fd598' }, (ht.streakType === 'W' ? 'W' : 'L') + ht.streakLen),
            h('span', { style: 'font-size:12px;color:rgba(255,255,255,.65)' },
              (ht.streakType === 'W' ? 'win streak' : 'losing run') + ' — season best is ' + ht.bestStreak)
          ),
          h('div', { style: 'display:flex;gap:5px;margin-top:10px' },
            ht.history.slice(-5).map(function (r, i, arr) {
              var last = i === arr.length - 1;
              return h('span', {
                style: 'flex:1;height:22px;border-radius:6px;display:inline-flex;align-items:center;justify-content:center;font-family:\'DM Mono\',monospace;font-size:10px;' +
                  (r === 'W' ? 'background:#12936a;' : 'background:rgba(255,255,255,.14);') +
                  (last ? 'outline:1.5px solid #3fd598;outline-offset:1px;' : '')
              }, r);
            })
          )
        ) : null,

        h('div', { style: 'display:flex;gap:8px' },
          h('div', { style: 'flex:1;background:#fff;border-radius:14px;padding:11px;text-align:center;box-shadow:0 1px 3px rgba(20,40,30,.06)' },
            h('div', { class: 'mono', style: 'font-size:18px;font-weight:500' }, ht ? (ht.wins + '–' + ht.losses) : '0–0'),
            h('div', { style: 'font-size:9px;color:#9aa8a0;font-weight:600;margin-top:2px' }, 'SEASON W–L')),
          h('div', { style: 'flex:1;background:#fff;border-radius:14px;padding:11px;text-align:center;box-shadow:0 1px 3px rgba(20,40,30,.06)' },
            h('div', { class: 'mono', style: 'font-size:18px;font-weight:500' }, String(Object.keys(agg.bySport).length)),
            h('div', { style: 'font-size:9px;color:#9aa8a0;font-weight:600;margin-top:2px' }, 'SPORTS PLAYED')),
          h('div', { style: 'flex:1;background:#fff;border-radius:14px;padding:11px;text-align:center;box-shadow:0 1px 3px rgba(20,40,30,.06)' },
            h('div', { class: 'mono', style: 'font-size:18px;font-weight:500' }, String(matches.length)),
            h('div', { style: 'font-size:9px;color:#9aa8a0;font-weight:600;margin-top:2px' }, 'GAMES'))
        ),

        Object.keys(agg.h2h).length ? h('div', { style: 'font-size:11px;font-weight:700;letter-spacing:.06em;color:#9aa8a0;text-transform:uppercase;margin-top:2px' }, 'Rivalries') : null,
        Object.keys(agg.h2h).map(function (key) {
          var pair = agg.h2h[key], a = pair.names[0], b = pair.names[1];
          var aw = pair.wins[a] || 0, bw = pair.wins[b] || 0;
          var total = aw + bw || 1;
          var note = Math.abs(aw - bw) === 1 ? 'One win levels it'
            : aw === bw ? 'Tied — next one breaks it'
            : (aw > bw ? a : b) + ' leads';
          return h('div', { style: 'background:#fff;border-radius:16px;padding:12px 14px;box-shadow:0 1px 3px rgba(20,40,30,.07)' },
            h('div', { style: 'display:flex;align-items:center;justify-content:space-between' },
              h('span', { style: 'font-size:13px;font-weight:700' }, a + ' vs ' + b),
              h('span', { class: 'mono', style: 'font-size:13px;font-weight:500' }, aw + '–' + bw)
            ),
            h('div', { style: 'height:6px;border-radius:3px;background:#eef1ee;margin-top:8px;overflow:hidden;display:flex' },
              h('div', { style: 'width:' + Math.round(aw / total * 100) + '%;background:#2f7bd6' }),
              h('div', { style: 'flex:1;background:#d64f43' })
            ),
            h('div', { style: 'font-size:11px;color:#12936a;font-weight:700;margin-top:8px' }, note)
          );
        }),

        h('div', { style: 'background:#fff;border-radius:16px;padding:12px 14px;box-shadow:0 1px 3px rgba(20,40,30,.07);display:flex;align-items:center;gap:10px' },
          h('span', { style: 'font-size:15px' }, '🏆'),
          h('div', { style: 'flex:1' },
            h('div', { style: 'font-size:12px;font-weight:700' }, toGo + ' game' + (toGo === 1 ? '' : 's') + ' to your ' + milestone + 'th'),
            h('div', { style: 'font-size:11px;color:#6b7a72' }, 'Season badge unlocks at ' + milestone + ' games scored')
          ),
          h('div', { style: 'width:34px;height:34px;border-radius:50%;background:conic-gradient(#12936a 0 ' + pct + '%, #e7ece8 ' + pct + '% 100%);display:flex;align-items:center;justify-content:center' },
            h('div', { style: 'width:26px;height:26px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;font-family:\'DM Mono\',monospace;font-size:9px' }, String(matches.length))
          )
        ),

        h('div', { style: 'flex:1' }),

        h('div', {
          style: 'background:#12936a;color:#fff;border-radius:16px;padding:14px 0;text-align:center;font-size:14px;font-weight:700;box-shadow:0 12px 22px -12px rgba(18,147,106,.7);cursor:pointer',
          onclick: function () { SE.nav('#/pick'); }
        }, 'Start game ' + (matches.length + 1) + ' →')
      )
    ));
  });
})();
