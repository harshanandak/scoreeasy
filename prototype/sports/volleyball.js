/* Volleyball: rally-point scoring, win set at target with a 2-point lead (no cap),
   deciding set always plays to 15, serve follows the rally winner.
   Scorer is a 1:1 port of reference fragment 5d (clean instrument). */
(function () {
  'use strict';
  var h = SE.h;

  /* ---------- pure helpers (no dependency on match/teams) ---------- */

  // deciding set (last possible set of the format) always plays to 15
  function setTarget(setIndex, cfg) {
    return setIndex === cfg.sets - 1 ? 15 : cfg.target;
  }

  function setsWon(snap) {
    var wins = [0, 0];
    snap.setHistory.forEach(function (s) { wins[s.a > s.b ? 0 : 1]++; });
    return wins;
  }

  // { leaderIdx, kind: 'set'|'match' } if the leading team is one point from
  // winning the current set (and possibly the match); else null
  function pointStatus(snap, cfg) {
    var a = snap.scores[0], b = snap.scores[1];
    if (a === b) return null;
    var leaderIdx = a > b ? 0 : 1;
    var lead = Math.max(a, b), trail = Math.min(a, b);
    var target = setTarget(snap.setIndex, cfg);
    if (lead + 1 < target || (lead + 1 - trail) < 2) return null;
    var setsToWin = Math.ceil(cfg.sets / 2);
    var wins = setsWon(snap);
    return { leaderIdx: leaderIdx, kind: wins[leaderIdx] + 1 >= setsToWin ? 'match' : 'set' };
  }

  // payload: { team, name, kind? } — kind 'ace' | 'block' | 'err' (err = the OTHER
  // side's error gave this team the point; payload.errBy names the erring side)
  function point(snap, cfg, payload) {
    var team = payload.team;
    var scores = snap.scores.slice();
    scores[team] += 1;
    var target = setTarget(snap.setIndex, cfg);
    var over = scores[team] >= target && (scores[team] - scores[1 - team]) >= 2;
    var setHistory = snap.setHistory.slice();
    var setIndex = snap.setIndex;
    if (over) {
      setHistory.push({ a: scores[0], b: scores[1] });
      setIndex += 1;
      scores = [0, 0];
    }
    var who = payload.name || 'Team ' + (team + 1);
    var label = payload.kind === 'ace' ? who + ' ace +1'
      : payload.kind === 'block' ? who + ' block +1'
      : payload.kind === 'err' ? who + ' +1 (' + (payload.errBy || 'opponent') + ' error)'
      : who + ' +1';
    return {
      snap: { setIndex: setIndex, scores: scores, setHistory: setHistory, server: team, swapped: snap.swapped },
      label: label,
    };
  }

  // manual set close (time-capped schoolyard sets): leader takes the set as-is
  function endSet(snap, cfg, payload) {
    if (snap.scores[0] === snap.scores[1]) return { snap: snap, label: 'Set tied — play it out' };
    var leader = snap.scores[0] > snap.scores[1] ? 0 : 1;
    var setHistory = snap.setHistory.concat([{ a: snap.scores[0], b: snap.scores[1] }]);
    return {
      snap: { setIndex: snap.setIndex + 1, scores: [0, 0], setHistory: setHistory, server: leader, swapped: snap.swapped },
      label: 'Set ' + (snap.setIndex + 1) + ' ended early · ' + ((payload && payload.names) ? payload.names[leader] : 'Team ' + (leader + 1)) + ' takes it',
    };
  }

  function noop(label) {
    return function (snap, cfg, payload) {
      return { snap: snap, label: (payload && payload.label) || label };
    };
  }

  function swapSides(snap) {
    var next = Object.assign({}, snap, { swapped: !snap.swapped });
    return { snap: next, label: '⇄ Sides swapped' };
  }

  var ACTIONS = {
    point: point,
    endSet: endSet,
    swapSides: swapSides,
    timeout: noop('Timeout'),
    rotate: noop('Rotation'),
    libero: noop('Libero change'),
  };

  // per-team ace/block/err tallies for the whole match, derived from the event log
  function statTotals(match) {
    var t = { ace: [0, 0], block: [0, 0], err: [0, 0] };
    match.events.forEach(function (ev) {
      if (ev.action !== 'point' || !ev.payload || !ev.payload.kind) return;
      if (ev.payload.kind === 'err') t.err[1 - ev.payload.team] += 1; // error charged to conceder
      else t[ev.payload.kind][ev.payload.team] += 1;
    });
    return t;
  }

  // replay events, keeping only the run/feed data for the set still in progress
  function currentSetActivity(match) {
    var snap = { setIndex: 0, scores: [0, 0], setHistory: [], server: 0, swapped: false };
    var runs = [], feed = [];
    match.events.forEach(function (ev) {
      var fn = ACTIONS[ev.action];
      if (!fn) return;
      var beforeSetIndex = snap.setIndex;
      snap = fn(snap, match.config, ev.payload).snap;
      if (snap.setIndex !== beforeSetIndex) { runs = []; feed = []; return; }
      if (ev.action !== 'point') return;
      var team = ev.payload.team;
      if (runs.length && runs[runs.length - 1].team === team) runs[runs.length - 1].count += 1;
      else runs.push({ team: team, count: 1 });
      feed.push({ score: snap.scores[0] + '–' + snap.scores[1], text: ev.label });
    });
    return { runs: runs, feed: feed };
  }

  /* ---------- sport def ---------- */

  SE.registerSport({
    key: 'volleyball', label: 'Volleyball', icon: '🏐', priority: 3,
    tagline: 'rally point',
    sampleTeams: ['Hawks', 'Wolves'],
    defaultConfig: { sets: 3, target: 25 },
    setupFields: [
      { key: 'sets', label: 'Best of', type: 'choice', options: [{ label: '3', value: 3 }, { label: '5', value: 5 }] },
      { key: 'target', label: 'Points per set', type: 'choice', options: [{ label: '25', value: 25 }, { label: '21', value: 21 }, { label: '15', value: 15 }] },
    ],

    init: function () {
      return { setIndex: 0, scores: [0, 0], setHistory: [], server: 0, swapped: false };
    },

    actions: ACTIONS,

    isOver: function (snap, cfg) {
      var setsToWin = Math.ceil(cfg.sets / 2);
      var wins = setsWon(snap);
      if (wins[0] >= setsToWin) return { summary: 'Team 1 won ' + wins[0] + '–' + wins[1] + ' in sets', winnerIndex: 0 };
      if (wins[1] >= setsToWin) return { summary: 'Team 2 won ' + wins[1] + '–' + wins[0] + ' in sets', winnerIndex: 1 };
      return null;
    },

    headline: function (match) {
      var snap = match.snapshot;
      var st = pointStatus(snap, match.config);
      var txt = snap.scores[0] + '–' + snap.scores[1] + ' · set ' + (snap.setIndex + 1);
      if (st) txt += ' · ' + st.kind + ' point';
      return txt;
    },

    /* ---------- scorer: 1:1 port of fragment 5d ---------- */
    renderScorer: function (el, match, api) {
      var snap = match.snapshot, cfg = match.config;
      var st = pointStatus(snap, cfg);
      var wins = setsWon(snap);
      var target = setTarget(snap.setIndex, cfg);
      var stats = statTotals(match);
      var names = [match.teams[0].name, match.teams[1].name];

      // fragment 5d's keyframes (geP serve pulse, geGlow banner glow)
      var kf = h('style', { html:
        '@keyframes geP{0%,100%{opacity:1}50%{opacity:.35}}' +
        '@keyframes geGlow{0%,100%{box-shadow:0 8px 16px -10px rgba(18,147,106,.7)}50%{box-shadow:0 8px 22px -8px rgba(18,147,106,.95)}}'
      });

      function iconBtn(content, onclick, size) {
        return h('div', {
          style: 'width:32px;height:32px;border-radius:11px;background:#fff;box-shadow:0 1px 2px rgba(20,40,30,.08);display:flex;align-items:center;justify-content:center;font-size:' + (size || 16) + 'px;cursor:pointer',
          onclick: onclick,
        }, content);
      }

      // one big score half — exact styles from the fragment
      function half(idx) {
        var serving = snap.server === idx;
        function statChip(txt, onTap) {
          return h('span', {
            style: 'font-family:\'DM Mono\',monospace;font-size:9px;letter-spacing:.08em;color:#6b7a72;border:1px solid #e4e9e5;background:#fff;border-radius:999px;padding:2px 7px;cursor:pointer',
            onclick: function (e) { e.stopPropagation(); onTap(); },
          }, txt);
        }
        return h('div', {
          style: 'flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;cursor:pointer;-webkit-tap-highlight-color:transparent;user-select:none;'
            + (idx === (snap.swapped ? 1 : 0) ? 'border-right:1px solid rgba(20,32,26,.1);' : '')
            + (serving ? 'background:linear-gradient(180deg,rgba(18,147,106,.07),rgba(18,147,106,0));' : ''),
          onclick: function () { api.dispatch('point', { team: idx, name: names[idx] }); },
        },
          h('span', { style: 'display:inline-flex;align-items:center;gap:6px;font-family:\'DM Mono\',monospace;font-size:10px;letter-spacing:.14em;color:#6b7a72' },
            serving ? h('span', { style: 'width:7px;height:7px;border-radius:50%;background:#12936a;animation:geP 1.2s infinite' }) : null,
            names[idx].toUpperCase()
          ),
          h('span', { style: 'font-family:\'DM Mono\',monospace;font-size:84px;font-weight:500;line-height:1;font-variant-numeric:tabular-nums' }, String(snap.scores[idx])),
          h('span', { style: 'width:44px;height:3px;background:#12936a;border-radius:2px' }),
          h('span', { style: 'font-size:10px;font-weight:600;color:#9aa8a0' }, serving ? 'serving · tap +1' : 'tap +1'),
          h('div', { style: 'display:flex;gap:5px;margin-top:4px' },
            statChip('ACE', function () { api.dispatch('point', { team: idx, name: names[idx], kind: 'ace' }); }),
            statChip('BLOCK', function () { api.dispatch('point', { team: idx, name: names[idx], kind: 'block' }); }),
            statChip('ERR', function () { api.dispatch('point', { team: 1 - idx, name: names[1 - idx], kind: 'err', errBy: names[idx] }); })
          )
        );
      }

      function pill(label, onclick) {
        return h('div', {
          style: 'flex:1;height:36px;border-radius:12px;border:1.5px solid #e4e9e5;background:#fff;display:flex;align-items:center;justify-content:center;font-size:11.5px;font-weight:600;color:#46554d;cursor:pointer;user-select:none',
          onclick: onclick,
        }, label);
      }

      var order = snap.swapped ? [1, 0] : [0, 1];

      el.appendChild(h('div', { style: 'flex:1;display:flex;flex-direction:column;background:#f4f6f3;color:#14201a' },
        kf,
        // header: back · title/sub · watch
        h('div', { style: 'flex:none;display:flex;align-items:center;justify-content:space-between;padding:12px 13px 8px' },
          iconBtn('‹', function () { api.nav('#/home'); }),
          h('div', { style: 'text-align:center' },
            h('div', { style: 'font-size:13px;font-weight:700' }, names[0] + ' vs ' + names[1]),
            h('div', { style: 'font-family:\'DM Mono\',monospace;font-size:9px;letter-spacing:.08em;color:#6b7a72;margin-top:1px' },
              'SET ' + (snap.setIndex + 1) + ' · SETS ' + wins[0] + '–' + wins[1] + ' · TO ' + target)
          ),
          iconBtn('👁', function () { api.nav('#/watch/' + match.id); }, 13)
        ),
        // set/match point banner
        st ? h('div', { style: 'flex:none;margin:0 13px;background:' + (st.kind === 'match' ? '#0d6b4e' : '#12936a') + ';color:#fff;text-align:center;padding:8px 0;border-radius:12px;font-family:\'DM Mono\',monospace;font-size:11px;letter-spacing:.16em;box-shadow:0 8px 16px -10px rgba(18,147,106,.7);animation:geGlow 1.8s infinite' },
          (st.kind === 'match' ? 'MATCH POINT' : 'SET POINT') + ' · ' + names[st.leaderIdx].toUpperCase()
        ) : null,
        // the two giant tap halves
        h('div', { style: 'flex:1;min-height:0;display:flex;border-bottom:1px solid rgba(20,32,26,.1);margin-top:' + (st ? '8px' : '0') },
          half(order[0]), half(order[1])
        ),
        // set history + stat totals row
        h('div', { style: 'flex:none;display:flex;align-items:center;justify-content:center;gap:12px;padding:8px 14px 0;font-family:\'DM Mono\',monospace;font-size:10px;color:#9aa8a0;flex-wrap:wrap' },
          snap.setHistory.map(function (s, i) {
            return h('span', null, 'SET ' + (i + 1) + ' ', h('span', { style: 'color:#14201a' }, s.a + '–' + s.b));
          }),
          snap.setHistory.length ? h('span', { style: 'color:#dfe7e1' }, '|') : null,
          h('span', null, 'ACES ' + (stats.ace[0] + stats.ace[1])),
          h('span', null, 'BLOCKS ', h('span', { style: 'color:#12936a' }, String(stats.block[0] + stats.block[1]))),
          h('span', null, 'ERR ' + (stats.err[0] + stats.err[1]))
        ),
        // action pills: Timeout · Sides · Rotate · Libero
        h('div', { style: 'flex:none;display:flex;gap:7px;padding:8px 13px 0' },
          pill('Timeout', function () { api.dispatch('timeout'); }),
          pill('⇄ Sides', function () { api.dispatch('swapSides'); }),
          pill('Rotate', function () { api.dispatch('rotate'); }),
          pill('Libero', function () { api.dispatch('libero'); })
        ),
        // undo + end set
        h('div', { style: 'flex:none;display:flex;gap:7px;padding:8px 13px 0' },
          h('div', { style: 'width:64px;height:44px;border-radius:14px;background:#eef1ee;display:flex;align-items:center;justify-content:center;font-size:16px;color:#46554d;cursor:pointer', onclick: function () { api.undo(); } }, '↩'),
          h('div', { style: 'flex:1;height:44px;border-radius:14px;background:#12936a;color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;box-shadow:0 10px 18px -10px rgba(18,147,106,.7);cursor:pointer', onclick: function () { api.dispatch('endSet', { names: names }); } }, 'End set ✓')
        ),
        // footer: set history link · share live
        h('div', { style: 'flex:none;display:flex;align-items:center;justify-content:space-between;padding:7px 15px calc(10px + env(safe-area-inset-bottom));font-size:11px;font-weight:700;color:#12936a' },
          h('span', { style: 'cursor:pointer', onclick: function () { api.nav('#/watch/' + match.id); } }, 'Set history ›'),
          h('span', { style: 'color:#6b7a72;font-weight:600;cursor:pointer', onclick: function () { api.nav('#/watch/' + match.id); } },
            '👁 ' + (3 + match.events.length % 9) + ' · Share live ', h('span', { style: 'color:#12936a' }, '↗'))
        )
      ));
    },

    /* ---------- spectator: 1:1 port of fragment 6d ---------- */
    renderSpectator: function (el, match) {
      var snap = match.snapshot, cfg = match.config;
      var st = pointStatus(snap, cfg);
      var activity = currentSetActivity(match);
      var names = [match.teams[0].name, match.teams[1].name];
      var live = match.status === 'live';

      // fragment 6d's keyframes (geP live-dot pulse, geGlow banner glow)
      var kf = h('style', { html:
        '@keyframes geP{0%,100%{opacity:1}50%{opacity:.35}}' +
        '@keyframes geGlow{0%,100%{box-shadow:0 8px 16px -10px rgba(18,147,106,.7)}50%{box-shadow:0 8px 22px -8px rgba(18,147,106,.95)}}'
      });

      // 32px white icon button; decorative (no href) unless it navigates somewhere real
      function iconBtn(content, href, size) {
        var style = 'width:32px;height:32px;border-radius:11px;background:#fff;box-shadow:0 1px 2px rgba(20,40,30,.08);display:flex;align-items:center;justify-content:center;font-size:' + (size || 16) + 'px;text-decoration:none;color:#14201a';
        return href ? h('a', { href: href, style: style }, content) : h('div', { style: style }, content);
      }

      // biggest scoring run still standing in the set in progress
      var biggestIdx = -1, biggestCount = 0;
      activity.runs.forEach(function (r, i) { if (r.count > biggestCount) { biggestCount = r.count; biggestIdx = i; } });

      // bold the scoring-kind keyword in a feed line, e.g. "Hawks ace +1" -> "Hawks **ace** +1"
      function moment(f, dim) {
        var m = /(ace|block|error)/i.exec(f.text);
        var body = m
          ? [f.text.slice(0, m.index), h('b', { style: 'color:#12936a' }, m[0]), f.text.slice(m.index + m[0].length)]
          : f.text;
        return h('div', { style: 'background:#fff;border-radius:13px;padding:9px 12px;box-shadow:0 1px 3px rgba(20,40,30,.06);display:flex;gap:9px;align-items:center' + (dim ? ';opacity:.65' : '') },
          h('span', { style: 'font-family:\'DM Mono\',monospace;font-size:9px;color:#9aa8a0;width:30px;flex:none' }, f.score),
          h('span', { style: 'font-size:12px' }, body)
        );
      }

      var moments = activity.feed.slice(-4).reverse();
      // decorative live-ish counters, derived from real match activity (not random, stays stable across re-renders)
      var viewers = 3 + match.events.length % 14;
      var fires = 5 + match.events.length % 12;
      var claps = 2 + match.events.length % 9;

      el.appendChild(h('div', { style: 'flex:1;display:flex;flex-direction:column;background:#f4f6f3;color:#14201a' },
        kf,
        // header: back · title + LIVE/FINAL · share
        h('div', { style: 'flex:none;display:flex;align-items:center;justify-content:space-between;padding:12px 13px 8px' },
          iconBtn('‹', '#/home'),
          h('div', { style: 'display:flex;align-items:center;gap:7px' },
            h('span', { style: 'font-size:13px;font-weight:700' }, names[0] + ' vs ' + names[1]),
            live
              ? h('span', { style: 'display:inline-flex;align-items:center;gap:4px;font-size:9px;font-weight:700;color:#d64f43' },
                  h('span', { style: 'width:5px;height:5px;border-radius:50%;background:#d64f43;animation:geP 1.4s infinite' }), 'LIVE')
              : h('span', { style: 'font-size:9px;font-weight:700;color:#9aa8a0' }, 'FINAL')
          ),
          iconBtn('↗', null, 13)
        ),
        // Live / Scorecard / Graphs segmented control (decorative — only Live view exists)
        h('div', { style: 'flex:none;display:flex;background:#e7ece8;border-radius:12px;padding:2px;margin:0 13px' },
          h('span', { style: 'flex:1;text-align:center;padding:6px 0;border-radius:10px;background:#fff;font-size:11.5px;font-weight:700;box-shadow:0 1px 2px rgba(20,40,30,.08)' }, 'Live'),
          h('span', { style: 'flex:1;text-align:center;padding:6px 0;font-size:11.5px;font-weight:600;color:#9aa8a0' }, 'Scorecard'),
          h('span', { style: 'flex:1;text-align:center;padding:6px 0;font-size:11.5px;font-weight:600;color:#9aa8a0' }, 'Graphs')
        ),
        h('div', { style: 'flex:1;min-height:0;display:flex;flex-direction:column;padding:8px 13px 0;gap:8px;overflow:auto' },
          // dark scoreboard card
          h('div', { style: 'background:#14201a;color:#fff;border-radius:18px;padding:12px 14px' },
            h('div', { style: 'display:flex;align-items:center;justify-content:space-between' },
              h('div', null,
                h('div', { style: 'font-size:10px;color:rgba(255,255,255,.6);font-weight:600' },
                  names[0].toUpperCase(), snap.server === 0 ? h('span', { style: 'display:inline-block;width:5px;height:5px;border-radius:50%;background:#3fd598;margin-left:3px' }) : null),
                h('div', { style: 'font-family:\'DM Mono\',monospace;font-size:28px;font-weight:500;color:' + (snap.server === 0 ? '#3fd598' : '#fff') }, String(snap.scores[0]))
              ),
              h('div', { style: 'text-align:center' },
                h('div', { style: 'font-family:\'DM Mono\',monospace;font-size:10px;letter-spacing:.1em;color:rgba(255,255,255,.5)' }, 'SET ' + (snap.setIndex + 1)),
                h('div', { style: 'font-family:\'DM Mono\',monospace;font-size:9px;color:rgba(255,255,255,.5);margin-top:3px' },
                  snap.setHistory.length ? snap.setHistory.map(function (s) { return s.a + '·' + s.b; }).join(' | ') : '—')
              ),
              h('div', { style: 'text-align:right' },
                h('div', { style: 'font-size:10px;color:rgba(255,255,255,.6);font-weight:600' },
                  names[1].toUpperCase(), snap.server === 1 ? h('span', { style: 'display:inline-block;width:5px;height:5px;border-radius:50%;background:#3fd598;margin-left:3px' }) : null),
                h('div', { style: 'font-family:\'DM Mono\',monospace;font-size:28px;font-weight:500;color:' + (snap.server === 1 ? '#3fd598' : '#fff') }, String(snap.scores[1]))
              )
            ),
            st ? h('div', { style: 'margin-top:7px;text-align:center;font-family:\'DM Mono\',monospace;font-size:10px;letter-spacing:.16em;color:#3fd598;animation:geGlow 1.6s infinite' },
              (st.kind === 'match' ? 'MATCH POINT' : 'SET POINT') + ' · ' + names[st.leaderIdx].toUpperCase()
            ) : null
          ),
          // scoring runs
          h('div', { style: 'display:flex;align-items:center;justify-content:space-between' },
            h('span', { style: 'font-size:11px;font-weight:700;letter-spacing:.06em;color:#9aa8a0;text-transform:uppercase' }, 'Scoring runs · set ' + (snap.setIndex + 1)),
            biggestIdx >= 0 ? h('span', { style: 'font-family:\'DM Mono\',monospace;font-size:10px;color:#12936a' }, 'BIGGEST: ' + biggestCount + '–0') : null
          ),
          activity.runs.length
            ? h('div', { style: 'display:flex;gap:3px;align-items:center' },
                activity.runs.map(function (r, i) {
                  var isBiggest = i === biggestIdx, isLast = i === activity.runs.length - 1;
                  return h('span', {
                    style: 'height:15px;border-radius:4px;flex:' + r.count + ';background:' + (r.team === 0 ? '#12936a' : '#b8862e')
                      + (isBiggest ? ';color:#fff;font-family:\'DM Mono\',monospace;font-size:9px;display:inline-flex;align-items:center;justify-content:center' : '')
                      + (isLast ? ';animation:geP 1.4s infinite' : ''),
                  }, isBiggest ? (r.count + '–0') : null);
                })
              )
            : h('div', { style: 'font-size:12px;color:#9aa8a0' }, 'No points yet this set'),
          // key moments (real event feed, most recent first, older entries dimmed)
          h('div', { style: 'display:flex;align-items:center;justify-content:space-between' },
            h('span', { style: 'font-size:11px;font-weight:700;letter-spacing:.06em;color:#9aa8a0;text-transform:uppercase' }, 'Key moments'),
            h('span', { style: 'font-family:\'DM Mono\',monospace;font-size:10px;color:#12936a' })
          ),
          moments.length ? moments.map(function (f, i) { return moment(f, i > 0); })
            : h('div', { style: 'font-size:12px;color:#9aa8a0' }, 'No key moments yet'),
          h('div', { style: 'flex:1' }),
          match.status === 'done' && match.result ? h('div', { style: 'background:#12936a;color:#fff;border-radius:13px;padding:10px 12px;text-align:center;font-size:12px;font-weight:700' }, match.result.summary) : null
        ),
        // footer: viewers · reactions · follow
        h('div', { style: 'flex:none;display:flex;align-items:center;gap:8px;padding:8px 13px calc(14px + env(safe-area-inset-bottom))' },
          h('span', { style: 'font-size:10px;color:#9aa8a0;font-weight:600;flex:none' }, '👁 ' + viewers),
          h('div', { style: 'flex:1;display:flex;gap:6px' },
            h('span', { style: 'background:#fff;border-radius:99px;padding:6px 12px;font-size:12px;box-shadow:0 1px 3px rgba(20,40,30,.08)' }, '🔥 ', h('span', { style: 'font-family:\'DM Mono\',monospace;font-size:10px;color:#6b7a72' }, String(fires))),
            h('span', { style: 'background:#fff;border-radius:99px;padding:6px 12px;font-size:12px;box-shadow:0 1px 3px rgba(20,40,30,.08)' }, '👏 ', h('span', { style: 'font-family:\'DM Mono\',monospace;font-size:10px;color:#6b7a72' }, String(claps)))
          ),
          h('span', { style: 'background:#12936a;color:#fff;border-radius:99px;padding:6px 14px;font-size:11px;font-weight:700;flex:none' }, 'Following ✓')
        )
      ));
    },
  });
})();
