/* Cricket sport definition. Two-innings limited-overs game: team-level runs/wickets/overs
   only (no per-player roster — setup only collects two team names), so batsman/bowler
   figures from the reference fragment are intentionally dropped. See registerSport() call
   at the bottom for what's implemented vs simplified. */
(function () {
  'use strict';
  var h = SE.h;
  var BALLS_PER_OVER = 6;

  /* ---------- pure helpers ---------- */
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function maxWickets(cfg) { return cfg.players - 1; }
  function totalBalls(cfg) { return cfg.overs * BALLS_PER_OVER; }
  function oversStr(balls) { return Math.floor(balls / BALLS_PER_OVER) + '.' + (balls % BALLS_PER_OVER); }
  function runRate(runs, balls) { return balls ? (runs / (balls / BALLS_PER_OVER)).toFixed(2) : '0.00'; }
  function reqRunRate(target, runs, tBalls, balls) {
    var remaining = tBalls - balls;
    if (remaining <= 0) return '-';
    return Math.max(0, (target - runs) / (remaining / BALLS_PER_OVER)).toFixed(2);
  }

  function freshInnings(battingTeam) {
    return { battingTeam: battingTeam, runs: 0, wickets: 0, balls: 0, thisOver: [], fallOfWickets: [], closed: false };
  }

  function chipLabel(runsScored, isWicket, extra) {
    if (extra === 'wide') return 'wd';
    if (extra === 'noball') return 'nb';
    if (isWicket) return 'W';
    return String(runsScored);
  }
  function ballLabel(runsScored, isWicket, extra) {
    if (extra === 'wide') return 'Wide +1';
    if (extra === 'noball') return 'No-ball +1';
    if (isWicket) return 'WICKET!';
    if (runsScored === 4) return 'FOUR!';
    if (runsScored === 6) return 'SIX!';
    if (runsScored === 0) return 'Dot ball';
    return runsScored + (runsScored === 1 ? ' run' : ' runs');
  }

  // Applies one ball (runs / wicket / wide / no-ball) to the current innings, auto-starting
  // innings 2 when innings 1 finishes. Never mutates the incoming snap.
  function applyBall(snap, cfg, runsScored, isWicket, extra) {
    var s = clone(snap);
    var idx = s.inningsIdx;
    var inn = s.innings[idx];
    var legal = !extra;

    inn.runs += extra ? 1 + runsScored : runsScored;
    if (isWicket) {
      inn.wickets += 1;
      inn.fallOfWickets.push({ score: inn.runs, overs: oversStr(inn.balls + (legal ? 1 : 0)) });
    }
    inn.thisOver.push(chipLabel(runsScored, isWicket, extra));
    if (legal) {
      inn.balls += 1;
      if (inn.balls % BALLS_PER_OVER === 0) inn.thisOver = [];
    }

    var finished = inn.closed || inn.wickets >= maxWickets(cfg) || inn.balls >= totalBalls(cfg);
    if (finished && idx === 0) {
      s.target = inn.runs + 1;
      s.inningsIdx = 1;
      s.innings[1] = freshInnings(1);
    }
    return { snap: s, label: ballLabel(runsScored, isWicket, extra) };
  }

  /* ---------- render helpers ---------- */
  function ballChip(c) {
    var bg = 'var(--surface)', color = 'var(--ink-soft)';
    if (c === 'W') { bg = 'var(--danger-soft)'; color = 'var(--danger)'; }
    else if (c === '4' || c === '6') { bg = 'var(--accent-soft)'; color = 'var(--accent-deep)'; }
    else if (c === 'wd' || c === 'nb') { bg = 'var(--amber-soft)'; color = 'var(--amber)'; }
    return h('span', { class: 'mono', style: 'width:22px;height:22px;border-radius:50%;background:' + bg + ';color:' + color + ';display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:700' }, c);
  }
  function emptyChip() {
    return h('span', { style: 'width:22px;height:22px;border-radius:50%;border:1px dashed var(--line-soft)' });
  }
  function shortTag(ev) {
    if (ev.action === 'wicket') return 'W';
    if (ev.action === 'wide') return 'wd';
    if (ev.action === 'noball') return 'nb';
    if (ev.action === 'runs') return String(ev.payload.runs);
    return '⏸';
  }
  function tagClass(ev) {
    if (ev.action === 'wicket') return 'chip live';
    if (ev.action === 'runs' && ev.payload && (ev.payload.runs === 4 || ev.payload.runs === 6)) return 'chip accent';
    return 'chip';
  }

  SE.registerSport({
    key: 'cricket', label: 'Cricket', icon: '🏏', priority: 1,
    tagline: 'runs & wickets',
    sampleTeams: ['Reds', 'Blues'],
    defaultConfig: { overs: 5, players: 6 },
    setupFields: [
      { key: 'overs', label: 'Overs', type: 'choice', options: [
        { label: '2', value: 2 }, { label: '5', value: 5 }, { label: '10', value: 10 }, { label: '20', value: 20 }
      ] },
      { key: 'players', label: 'Players a side', type: 'choice', options: [
        { label: '2', value: 2 }, { label: '6', value: 6 }, { label: '11', value: 11 }
      ] },
    ],

    init: function () {
      return { inningsIdx: 0, target: null, innings: [freshInnings(0), null] };
    },

    actions: {
      runs: function (snap, cfg, payload) { return applyBall(snap, cfg, payload.runs, false, null); },
      wicket: function (snap, cfg) { return applyBall(snap, cfg, 0, true, null); },
      wide: function (snap, cfg) { return applyBall(snap, cfg, 0, false, 'wide'); },
      noball: function (snap, cfg) { return applyBall(snap, cfg, 0, false, 'noball'); },
      // Manual declare/close-out — forces the current innings to finish immediately.
      endInnings: function (snap, cfg) {
        var s = clone(snap);
        var idx = s.inningsIdx;
        s.innings[idx].closed = true;
        if (idx === 0) {
          s.target = s.innings[0].runs + 1;
          s.inningsIdx = 1;
          s.innings[1] = freshInnings(1);
        }
        return { snap: s, label: 'Innings closed' };
      },
    },

    isOver: function (snap, cfg) {
      if (snap.inningsIdx !== 1) return null; // innings 1 auto-transitions inside the reducer
      var inn2 = snap.innings[1];
      var maxW = maxWickets(cfg);

      if (inn2.runs >= snap.target) {
        var wktsInHand = maxW - inn2.wickets;
        return { summary: 'Won by ' + wktsInHand + ' wicket' + (wktsInHand === 1 ? '' : 's'), winnerIndex: 1 };
      }
      var finished = inn2.closed || inn2.wickets >= maxW || inn2.balls >= totalBalls(cfg);
      if (finished) {
        var diff = snap.innings[0].runs - inn2.runs;
        if (diff === 0) return { summary: 'Match tied', winnerIndex: null };
        if (diff > 0) return { summary: 'Won by ' + diff + ' run' + (diff === 1 ? '' : 's'), winnerIndex: 0 };
        return { summary: 'Won by ' + (-diff) + ' wicket' + (-diff === 1 ? '' : 's'), winnerIndex: 1 }; // defensive fallback
      }
      return null;
    },

    headline: function (m) {
      var s = m.snapshot, cfg = m.config;
      var inn = s.innings[s.inningsIdx];
      if (s.inningsIdx === 0) return inn.runs + '/' + inn.wickets + ' · ' + oversStr(inn.balls) + ' ov';
      var need = s.target - inn.runs;
      if (need <= 0) return m.teams[inn.battingTeam].name + ' won';
      return 'need ' + need + ' off ' + Math.max(0, totalBalls(cfg) - inn.balls);
    },

    renderScorer: function (el, match, api) {
      var s = match.snapshot, cfg = match.config;
      var idx = s.inningsIdx;
      var inn = s.innings[idx];
      var battingName = match.teams[inn.battingTeam].name;
      var tBalls = totalBalls(cfg);
      var progressPct = Math.min(100, Math.round((100 * inn.balls) / tBalls));

      var top = h('div', { class: 'row', style: 'align-items:flex-end;justify-content:space-between' },
        h('div', { class: 'row', style: 'align-items:flex-end;gap:6px' },
          h('span', { class: 'bignum', style: 'font-size:36px' }, String(inn.runs)),
          h('span', { class: 'bignum', style: 'font-size:22px;opacity:.6' }, '/' + inn.wickets),
          h('span', { class: 'mono', style: 'font-size:11px;opacity:.8;margin-left:4px' }, '(' + oversStr(inn.balls) + ')')
        ),
        h('span', { class: 'mono', style: 'font-size:10.5px;opacity:.85' }, 'CRR ' + runRate(inn.runs, inn.balls))
      );
      var progress = h('div', { style: 'margin-top:8px;height:4px;border-radius:99px;background:rgba(255,255,255,.25);overflow:hidden' },
        h('div', { style: 'width:' + progressPct + '%;height:100%;background:#fff' })
      );
      var chaseRow = idx === 1 ? h('div', { class: 'row mono', style: 'margin-top:8px;font-size:11px;opacity:.9;justify-content:space-between' },
        h('span', null, 'NEED ', h('b', null, String(Math.max(0, s.target - inn.runs))), ' OFF ', h('b', null, String(Math.max(0, tBalls - inn.balls)))),
        h('span', null, 'RRR ', h('b', null, reqRunRate(s.target, inn.runs, tBalls, inn.balls)))
      ) : null;

      var scoreCard = h('div', { class: 'card', style: 'background:linear-gradient(160deg,var(--accent-live),var(--accent-deep));color:#fff;border:none' },
        top, progress, chaseRow);

      var legalCount = inn.thisOver.filter(function (c) { return c !== 'wd' && c !== 'nb'; }).length;
      var empties = [];
      for (var i = 0; i < Math.max(0, BALLS_PER_OVER - legalCount); i++) empties.push(emptyChip());
      var lastWkt = inn.fallOfWickets.length
        ? inn.fallOfWickets[inn.fallOfWickets.length - 1]
        : null;

      var overRow = h('div', { class: 'row', style: 'flex-wrap:wrap;gap:6px' },
        h('span', { class: 'microlabel', style: 'flex:none' }, 'OVER'),
        inn.thisOver.map(ballChip), empties,
        h('span', { class: 'grow' }),
        lastWkt ? h('span', { class: 'mono muted', style: 'font-size:10px' }, 'Last wkt · ' + lastWkt.score + ' (ov ' + lastWkt.overs + ')') : null
      );

      var runVals = [0, 1, 2, 3, 4, 6];
      var runGrid = h('div', { style: 'display:grid;grid-template-columns:repeat(3,1fr);gap:8px' },
        runVals.map(function (n) {
          var boundary = n === 4 || n === 6;
          return h('button', {
            class: 'tapzone' + (boundary ? ' leading' : ''),
            style: 'padding:16px 4px;display:flex;flex-direction:column;align-items:center;gap:2px;font-family:inherit',
            onclick: function () { api.dispatch('runs', { runs: n }); },
          },
            h('span', { class: 'bignum', style: 'font-size:20px' }, String(n)),
            boundary ? h('span', { class: 'microlabel', style: 'color:var(--accent-deep)' }, n === 4 ? 'FOUR' : 'SIX') : null
          );
        })
      );

      var extrasStrip = h('div', { class: 'actionstrip' },
        h('button', { class: 'btn', style: 'background:var(--danger-soft);color:var(--danger);border-color:transparent', onclick: function () { api.dispatch('wicket'); } }, 'OUT'),
        h('button', { class: 'btn ghost', onclick: function () { api.dispatch('wide'); } }, 'Wide'),
        h('button', { class: 'btn ghost', onclick: function () { api.dispatch('noball'); } }, 'No-ball')
      );

      var bottomRow = h('div', { class: 'row', style: 'gap:8px' },
        h('button', { class: 'btn ghost', style: 'flex:none;width:52px', onclick: function () { api.undo(); } }, '↩'),
        h('button', { class: 'btn primary block', onclick: function () { api.dispatch('endInnings'); } }, 'End innings')
      );

      el.appendChild(h('div', { class: 'screen' },
        SE.topbar({
          title: match.teams[0].name + ' vs ' + match.teams[1].name,
          sub: 'OVER ' + oversStr(inn.balls) + (idx === 1 ? ' · CHASING ' + s.target : ''),
          back: '#/home',
        }),
        h('div', { class: 'microlabel' }, battingName.toUpperCase() + ' BATTING'),
        scoreCard,
        overRow,
        runGrid,
        extrasStrip,
        bottomRow
      ));
    },

    renderSpectator: function (el, match) {
      var s = match.snapshot, cfg = match.config;
      var idx = s.inningsIdx;
      var inn1 = s.innings[0];
      var inn2 = s.innings[1];
      var live = match.status === 'live';

      var scoreBlock = h('div', { class: 'card', style: 'background:var(--ink);color:#fff;border:none' },
        h('div', { class: 'row', style: 'justify-content:space-between;align-items:flex-start' },
          h('div', null,
            h('div', { class: 'microlabel', style: 'color:rgba(255,255,255,.6)' }, match.teams[0].name.toUpperCase()),
            h('div', { class: 'bignum', style: 'font-size:24px' }, String(inn1.runs), h('span', { style: 'opacity:.5;font-size:16px' }, '/' + inn1.wickets))
          ),
          idx === 1 ? h('div', { class: 'center' },
            h('div', { class: 'mono', style: 'font-size:9px;letter-spacing:.12em;color:var(--accent-live)' }, 'CHASING'),
            h('div', { style: 'font-size:10px;color:rgba(255,255,255,.6);margin-top:2px' },
              inn2.runs >= s.target ? 'target reached' : 'need ' + Math.max(0, s.target - inn2.runs) + ' off ' + Math.max(0, totalBalls(cfg) - inn2.balls))
          ) : null,
          h('div', { style: 'text-align:right' },
            h('div', { class: 'microlabel', style: 'color:rgba(255,255,255,.6)' }, match.teams[1].name.toUpperCase()),
            inn2
              ? h('div', { class: 'bignum', style: 'font-size:24px;color:var(--accent-live)' }, String(inn2.runs), h('span', { style: 'opacity:.5;font-size:16px' }, '/' + inn2.wickets))
              : h('div', { class: 'mono muted', style: 'font-size:12px' }, 'yet to bat')
          )
        )
      );

      var feed = match.events.slice(-8).reverse().map(function (ev) {
        return h('div', { class: 'card row', style: 'padding:9px 12px' },
          h('span', { class: tagClass(ev) }, shortTag(ev)),
          h('span', { style: 'font-size:12px' }, ev.label)
        );
      });

      el.appendChild(h('div', { class: 'screen' },
        SE.topbar({
          title: match.teams[0].name + ' vs ' + match.teams[1].name,
          sub: 'OVER ' + oversStr((idx === 1 ? inn2 : inn1).balls),
          back: '#/home',
          right: live ? h('span', { class: 'chip live' }, 'LIVE') : null,
        }),
        scoreBlock,
        h('div', { class: 'microlabel' }, 'RECENT BALLS'),
        feed.length ? h('div', { style: 'display:flex;flex-direction:column;gap:8px' }, feed) : h('div', { class: 'muted', style: 'font-size:12px' }, 'No balls bowled yet')
      ));
    },
  });
})();
