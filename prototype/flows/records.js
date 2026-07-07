/* Records screen ("why the next game matters"): aggregates SE.doneMatches()
   into overall W/L, head-to-head rivalries, current win streaks, and a
   per-sport tally. Generic over any sport — only reads teams/result/sport.
   Fragment: 3c-streaks-and-records.html. */
(function () {
  'use strict';
  var h = SE.h;

  function aggregate(matches) {
    var teams = {};   // name -> { wins, losses, streakType, streakLen }
    var h2h = {};     // 'A|B' (sorted) -> { names:[a,b], wins:{name:count} }
    var bySport = {}; // sportKey -> count

    // chronological order so streaks accumulate correctly
    var chron = matches.slice().sort(function (a, b) { return a.endedAt - b.endedAt; });

    chron.forEach(function (m) {
      bySport[m.sport] = (bySport[m.sport] || 0) + 1;
      var t0 = m.teams[0].name, t1 = m.teams[1].name;
      [t0, t1].forEach(function (n) {
        if (!teams[n]) teams[n] = { wins: 0, losses: 0, streakType: null, streakLen: 0 };
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
          if (t.streakType === pair[1]) t.streakLen++;
          else { t.streakType = pair[1]; t.streakLen = 1; }
        });
      }
      // draws (winnerIndex null) count toward games/h2h but don't touch streaks
    });

    return { teams: teams, h2h: h2h, bySport: bySport };
  }

  SE.registerScreen('records', function (root) {
    var matches = SE.doneMatches();

    if (!matches.length) {
      root.appendChild(h('div', { class: 'screen' },
        SE.topbar({ title: 'Records', sub: 'Season so far' }),
        h('div', { class: 'card center', style: 'padding:32px 16px;display:flex;flex-direction:column;gap:10px' },
          h('div', { style: 'font-size:32px' }, '🏆'),
          h('div', { style: 'font-weight:700;font-size:15px' }, 'No finished matches yet'),
          h('div', { class: 'muted', style: 'font-size:12px' },
            "Play a match and it'll show up here — streaks, head-to-heads, the works."),
          h('a', { class: 'btn primary', href: '#/pick' }, 'Start a match')
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

    root.appendChild(h('div', { class: 'screen' },
      SE.topbar({ title: 'Records', sub: matches.length + ' finished · why the next game matters' }),

      onStreak.length ? h('div', { class: 'card', style: 'background:var(--ink);color:#fff' },
        (function () {
          var n = onStreak[0], t = agg.teams[n];
          return h('div', { class: 'row', style: 'align-items:baseline;gap:8px' },
            h('span', { class: 'bignum', style: 'font-size:30px;color:#3fd598' }, 'W' + t.streakLen),
            h('span', { style: 'font-size:12px;color:rgba(255,255,255,.65)' }, n + ' on a win streak')
          );
        })()
      ) : null,

      h('div', { class: 'row', style: 'gap:8px' },
        h('div', { class: 'card center', style: 'flex:1;padding:11px' },
          h('div', { class: 'bignum', style: 'font-size:16px' }, String(matches.length)),
          h('div', { class: 'microlabel', style: 'margin-top:2px' }, 'GAMES')),
        h('div', { class: 'card center', style: 'flex:1;padding:11px' },
          h('div', { class: 'bignum', style: 'font-size:16px' }, String(Object.keys(agg.bySport).length)),
          h('div', { class: 'microlabel', style: 'margin-top:2px' }, 'SPORTS')),
        h('div', { class: 'card center', style: 'flex:1;padding:11px' },
          h('div', { class: 'bignum', style: 'font-size:16px' }, String(teamNames.length)),
          h('div', { class: 'microlabel', style: 'margin-top:2px' }, 'TEAMS'))
      ),

      h('div', { class: 'microlabel' }, 'STANDINGS'),
      h('div', { class: 'card', style: 'display:flex;flex-direction:column;gap:8px' },
        teamNames.map(function (n, i) {
          var t = agg.teams[n];
          return h('div', { class: 'row', style: i ? 'padding-top:8px;border-top:1px solid var(--line-soft)' : '' },
            h('span', { class: 'grow', style: 'font-weight:700;font-size:13px' }, n),
            h('span', { class: 'mono', style: 'font-size:13px' }, t.wins + '–' + t.losses)
          );
        })
      ),

      Object.keys(agg.h2h).length ? h('div', { style: 'display:flex;flex-direction:column;gap:8px' },
        h('div', { class: 'microlabel' }, 'RIVALRIES'),
        Object.keys(agg.h2h).map(function (key) {
          var pair = agg.h2h[key], a = pair.names[0], b = pair.names[1];
          var aw = pair.wins[a] || 0, bw = pair.wins[b] || 0;
          return h('div', { class: 'card' },
            h('div', { class: 'row', style: 'justify-content:space-between' },
              h('span', { style: 'font-size:13px;font-weight:700' }, a + ' vs ' + b),
              h('span', { class: 'mono', style: 'font-size:13px' }, aw + '–' + bw)
            )
          );
        })
      ) : null,

      h('div', { class: 'microlabel' }, 'BY SPORT'),
      h('div', { class: 'row', style: 'flex-wrap:wrap;gap:8px' },
        Object.keys(agg.bySport).map(function (k) {
          var def = SE.sports[k] || { icon: '🏟', label: k };
          return h('span', { class: 'chip' }, def.icon + ' ' + def.label + ' · ' + agg.bySport[k]);
        })
      )
    ));
  });
})();
