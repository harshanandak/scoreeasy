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

    /* ---------- scorer: Floodlight (SE.ui components) ---------- */
    renderScorer: function (el, match, api) {
      var ui = SE.ui;
      var snap = match.snapshot, cfg = match.config;
      var st = pointStatus(snap, cfg);
      var wins = setsWon(snap);
      var target = setTarget(snap.setIndex, cfg);
      var stats = statTotals(match);
      var names = [match.teams[0].name, match.teams[1].name];
      var order = snap.swapped ? [1, 0] : [0, 1];

      function half(idx, sideCls) {
        var serving = snap.server === idx;
        var lead = snap.scores[idx] > snap.scores[1 - idx] ? true : snap.scores[idx] < snap.scores[1 - idx] ? false : null;
        function statChip(txt, onTap) {
          return h('span', {
            style: 'font-family:var(--fl-data);font-size:9px;letter-spacing:.08em;color:var(--fl-ink-faint);border:1px solid var(--fl-line-2);border-radius:6px;padding:2px 7px;cursor:pointer',
            onclick: function (e) { e.stopPropagation(); onTap(); },
          }, txt);
        }
        return h('div', {
          class: 'fl-side ' + sideCls + (serving ? ' serving' : '') + (lead === true ? ' lead' : lead === false ? ' trail' : ''),
          onclick: function () { api.dispatch('point', { team: idx, name: names[idx] }); },
        },
          serving ? h('div', { class: 'fl-dot' }) : null,
          h('div', { class: 'fl-team' }, names[idx]),
          h('div', { class: 'fl-num' }, String(snap.scores[idx])),
          h('div', { class: 'fl-cue' }, serving ? 'serving · tap' : 'tap +1'),
          h('div', { style: 'display:flex;gap:5px;margin-top:7px' },
            statChip('ACE', function () { api.dispatch('point', { team: idx, name: names[idx], kind: 'ace' }); }),
            statChip('BLK', function () { api.dispatch('point', { team: idx, name: names[idx], kind: 'block' }); }),
            statChip('ERR', function () { api.dispatch('point', { team: 1 - idx, name: names[1 - idx], kind: 'err', errBy: names[idx] }); })
          )
        );
      }

      var chipItems = snap.setHistory.map(function (s, i) { return { label: 'SET ' + (i + 1), value: s.a + '–' + s.b }; });
      chipItems.push({ label: 'ACES', value: stats.ace[0] + stats.ace[1] });
      chipItems.push({ label: 'BLK', value: stats.block[0] + stats.block[1] });
      chipItems.push({ label: 'ERR', value: stats.err[0] + stats.err[1] });

      el.appendChild(ui.screen(
        ui.header({
          title: names[0] + ' vs ' + names[1],
          sub: 'SET ' + (snap.setIndex + 1) + ' · SETS ' + wins[0] + '–' + wins[1] + ' · TO ' + target,
          onBack: function () { api.nav('#/home'); },
          right: ui.iconBtn('👁', function () { api.nav('#/watch/' + match.id); }),
        }),
        st ? ui.banner((st.kind === 'match' ? 'Match Point' : 'Set Point') + ' · ' + names[st.leaderIdx]) : null,
        ui.board(half(order[0], 'l'), half(order[1], 'r')),
        ui.chips(chipItems),
        ui.actions([
          { label: 'Time', onTap: function () { api.dispatch('timeout'); } },
          { label: 'Sides', onTap: function () { api.dispatch('swapSides'); } },
          { label: 'Rotate', onTap: function () { api.dispatch('rotate'); } },
          { label: 'Libero', onTap: function () { api.dispatch('libero'); } },
        ]),
        ui.footer({ onUndo: function () { api.undo(); }, primaryLabel: 'End Set', onPrimary: function () { api.dispatch('endSet', { names: names }); } }),
        ui.meta({ left: 'Set history', leftTap: function () { api.nav('#/watch/' + match.id); }, viewers: 3 + match.events.length % 9, onShare: function () { api.nav('#/watch/' + match.id); } })
      ));
    },

    /* ---------- spectator: Floodlight ---------- */
    renderSpectator: function (el, match) {
      var ui = SE.ui;
      var snap = match.snapshot, cfg = match.config;
      var st = pointStatus(snap, cfg);
      var activity = currentSetActivity(match);
      var names = [match.teams[0].name, match.teams[1].name];
      var live = match.status === 'live';

      var biggestIdx = -1, biggestCount = 0;
      activity.runs.forEach(function (r, i) { if (r.count > biggestCount) { biggestCount = r.count; biggestIdx = i; } });

      function moment(f, dim) {
        var m = /(ace|block|error)/i.exec(f.text);
        var body = m
          ? [f.text.slice(0, m.index), h('b', { style: 'color:var(--fl-amber)' }, m[0]), f.text.slice(m.index + m[0].length)]
          : f.text;
        return h('div', { class: 'fl-card', style: 'padding:9px 12px;display:flex;gap:9px;align-items:center' + (dim ? ';opacity:.6' : '') },
          h('span', { style: 'font-family:var(--fl-data);font-size:9px;color:var(--fl-ink-faint);width:32px;flex:none' }, f.score),
          h('span', { style: 'font-size:12px;color:var(--fl-ink)' }, body)
        );
      }

      function scoreCell(idx, alignRight) {
        var serving = snap.server === idx;
        return h('div', { style: alignRight ? 'text-align:right' : '' },
          h('div', { class: 'fl-microlabel', style: 'color:var(--fl-ink-dim)' + (serving ? ';color:var(--fl-amber)' : '') }, names[idx].toUpperCase()),
          h('div', { style: 'font-family:var(--fl-num);font-size:44px;line-height:.9;font-weight:600;color:' + (serving ? 'var(--fl-amber)' : 'var(--fl-ink)') }, String(snap.scores[idx]))
        );
      }

      var moments = activity.feed.slice(-4).reverse();
      var viewers = 3 + match.events.length % 14;

      el.appendChild(ui.screen(
        ui.header({
          title: names[0] + ' vs ' + names[1],
          sub: live ? 'LIVE · SET ' + (snap.setIndex + 1) : 'FINAL',
          onBack: function () { SE.nav('#/home'); },
          right: ui.iconBtn('↗', function () {}),
        }),
        h('div', { class: 'fl-scroll', style: 'display:flex;flex-direction:column;gap:12px;padding:8px 16px 16px' },
          // dark scoreboard
          h('div', { class: 'fl-scoreboard' },
            h('div', { style: 'display:flex;align-items:center;justify-content:space-between' },
              scoreCell(0),
              h('div', { style: 'text-align:center' },
                h('div', { class: 'fl-microlabel' }, 'SET ' + (snap.setIndex + 1)),
                h('div', { style: 'font-family:var(--fl-data);font-size:9px;color:var(--fl-ink-faint);margin-top:4px' },
                  snap.setHistory.length ? snap.setHistory.map(function (s) { return s.a + '·' + s.b; }).join('  ') : '—')
              ),
              scoreCell(1, true)
            ),
            st ? h('div', { style: 'margin-top:9px;text-align:center;font-family:var(--fl-data);font-size:10px;letter-spacing:.18em;color:var(--fl-amber);text-shadow:0 0 16px rgba(255,195,0,.5)' },
              (st.kind === 'match' ? 'MATCH POINT' : 'SET POINT') + ' · ' + names[st.leaderIdx].toUpperCase()
            ) : null
          ),
          // scoring runs
          h('div', { style: 'display:flex;align-items:center;justify-content:space-between' },
            ui.microlabel('Scoring runs · set ' + (snap.setIndex + 1)),
            biggestIdx >= 0 ? h('span', { style: 'font-family:var(--fl-data);font-size:10px;color:var(--fl-amber)' }, 'BIGGEST ' + biggestCount + '–0') : null
          ),
          activity.runs.length
            ? h('div', { style: 'display:flex;gap:3px;align-items:center' },
                activity.runs.map(function (r) {
                  return h('span', { style: 'height:15px;border-radius:4px;flex:' + r.count + ';background:' + (r.team === 0 ? 'var(--fl-amber)' : 'var(--fl-lose)') });
                })
              )
            : h('div', { style: 'font-size:12px;color:var(--fl-ink-faint)' }, 'No points yet this set'),
          // key moments
          ui.microlabel('Key moments'),
          moments.length ? moments.map(function (f, i) { return moment(f, i > 0); })
            : h('div', { style: 'font-size:12px;color:var(--fl-ink-faint)' }, 'No key moments yet'),
          match.status === 'done' && match.result
            ? h('div', { style: 'background:var(--fl-amber);color:var(--fl-amber-ink);border-radius:12px;padding:11px 12px;text-align:center;font-weight:600;letter-spacing:.06em' }, match.result.summary)
            : null
        ),
        ui.meta({ viewers: viewers, onShare: function () {} })
      ));
    },
  });
})();
