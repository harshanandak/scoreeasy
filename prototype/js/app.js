/* Shell screens: Home, Sport picker, Match setup, dev Board. Synthesized in the
   HiFi board's language (no source screen exists for these — the board starts at scorers). */
(function () {
  'use strict';
  var h = SE.h;

  /* ---------- Home ---------- */
  SE.registerScreen('home', function (root) {
    var live = SE.liveMatches();
    var done = SE.doneMatches().slice(0, 4);
    var sched = SE.store.get().scheduled.slice(0, 3);

    root.appendChild(h('div', { class: 'screen' },
      h('div', { class: 'row', style: 'padding:6px 2px' },
        h('div', null,
          h('div', { class: 'microlabel' }, 'SCOREEASY'),
          h('div', { style: 'font-weight:800;font-size:22px;letter-spacing:-0.02em' }, 'Game day')
        ),
        h('div', { class: 'spacer' }),
        h('a', { class: 'chip', href: '#/records' }, '🏆 Records'),
        h('a', { class: 'chip', href: '#/board' }, '≣')
      ),

      h('button', { class: 'btn primary big block', onclick: function () { SE.nav('#/pick'); } }, '+ Start a match'),

      live.length ? section('LIVE NOW', live.map(function (m) {
        var def = SE.sports[m.sport];
        return h('div', { class: 'card row', style: 'padding:12px' },
          h('div', { style: 'font-size:22px' }, def.icon),
          h('div', { class: 'grow' },
            h('div', { style: 'font-weight:700' }, m.teams[0].name + ' vs ' + m.teams[1].name),
            h('div', { class: 'sub mono muted', style: 'font-size:11px' }, def.label + ' · ' + (def.headline ? def.headline(m) : 'in play'))
          ),
          h('span', { class: 'chip live' }, 'LIVE'),
          h('a', { class: 'btn', style: 'padding:8px 12px', href: '#/score/' + m.id }, 'Score'),
          h('a', { class: 'btn ghost', style: 'padding:8px 10px', href: '#/watch/' + m.id }, '👁')
        );
      })) : null,

      sched.length ? section('UPCOMING', sched.map(function (g, i) {
        var def = SE.sports[g.sport] || { icon: '🏟', label: g.sport };
        return h('div', { class: 'card row', style: 'padding:12px' },
          h('div', { style: 'font-size:20px' }, def.icon),
          h('div', { class: 'grow' },
            h('div', { style: 'font-weight:700' }, g.title),
            h('div', { class: 'mono muted', style: 'font-size:11px' }, g.when || 'time TBD')
          ),
          h('button', {
            class: 'btn', style: 'padding:8px 12px',
            onclick: function () { SE.nav('#/setup/' + g.sport); }
          }, 'Play now')
        );
      })) : null,

      h('a', { class: 'card row', href: '#/schedule', style: 'padding:12px;text-decoration:none;color:inherit' },
        h('div', { style: 'font-size:20px' }, '🗓'),
        h('div', { class: 'grow' },
          h('div', { style: 'font-weight:700' }, 'Schedule a game'),
          h('div', { class: 'muted', style: 'font-size:12px' }, 'Time optional — just pick teams')
        ),
        h('div', { class: 'muted' }, '›')
      ),

      done.length ? section('RECENT', done.map(function (m) {
        var def = SE.sports[m.sport];
        return h('a', { class: 'card row', href: '#/result/' + m.id, style: 'padding:12px;text-decoration:none;color:inherit' },
          h('div', { style: 'font-size:20px' }, def.icon),
          h('div', { class: 'grow' },
            h('div', { style: 'font-weight:700;font-size:14px' }, m.teams[0].name + ' vs ' + m.teams[1].name),
            h('div', { class: 'mono muted', style: 'font-size:11px' }, (m.result && m.result.summary) || 'finished')
          ),
          h('div', { class: 'muted' }, '›')
        );
      })) : null
    ));
  });

  function section(label, children) {
    return h('div', { style: 'display:flex;flex-direction:column;gap:8px' },
      h('div', { class: 'microlabel', style: 'padding:2px 4px' }, label),
      children
    );
  }

  /* ---------- Sport picker ---------- */
  SE.registerScreen('pick', function (root) {
    root.appendChild(h('div', { class: 'screen' },
      SE.topbar({ title: 'Pick a sport', sub: 'What are we playing?' }),
      h('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:10px' },
        SE.sportList().map(function (def) {
          return h('button', {
            class: 'tapzone', style: 'padding:18px 12px;display:flex;flex-direction:column;align-items:center;gap:8px;border-width:1px;font-family:inherit',
            onclick: function () { SE.nav('#/setup/' + def.key); }
          },
            h('div', { style: 'font-size:34px' }, def.icon),
            h('div', { style: 'font-weight:700;font-size:15px' }, def.label),
            def.tagline ? h('div', { class: 'mono muted', style: 'font-size:10px' }, def.tagline) : null
          );
        })
      )
    ));
  });

  /* ---------- Match setup (generic, driven by def.setupFields) ---------- */
  SE.registerScreen('setup', function (root, args) {
    var def = SE.sports[args[0]];
    if (!def) return SE.nav('#/pick');
    var cfg = JSON.parse(JSON.stringify(def.defaultConfig || {}));
    var names = [def.sampleTeams ? def.sampleTeams[0] : 'Team A', def.sampleTeams ? def.sampleTeams[1] : 'Team B'];

    var fieldsWrap = h('div', { style: 'display:flex;flex-direction:column;gap:12px' });
    (def.setupFields || []).forEach(function (f) {
      if (f.type === 'choice') {
        var seg = h('div', { class: 'seg' });
        f.options.forEach(function (opt) {
          var b = h('button', { class: cfg[f.key] === opt.value ? 'on' : '', onclick: function () {
            cfg[f.key] = opt.value;
            Array.prototype.forEach.call(seg.children, function (c) { c.className = ''; });
            b.className = 'on';
          } }, opt.label);
          seg.appendChild(b);
        });
        fieldsWrap.appendChild(h('div', { class: 'field' }, h('label', null, f.label), seg));
      } else if (f.type === 'number') {
        fieldsWrap.appendChild(h('div', { class: 'field' },
          h('label', null, f.label),
          h('input', { type: 'number', value: cfg[f.key], min: f.min || 1, max: f.max || 999,
            oninput: function (e) { cfg[f.key] = +e.target.value; } })
        ));
      }
    });

    var in1 = h('input', { value: names[0], oninput: function (e) { names[0] = e.target.value; } });
    var in2 = h('input', { value: names[1], oninput: function (e) { names[1] = e.target.value; } });

    root.appendChild(h('div', { class: 'screen' },
      SE.topbar({ title: def.label + ' setup', sub: 'Two taps to play', back: '#/pick' }),
      h('div', { class: 'card', style: 'display:flex;flex-direction:column;gap:12px' },
        h('div', { class: 'field' }, h('label', null, 'Team 1'), in1),
        h('div', { class: 'center microlabel' }, 'VS'),
        h('div', { class: 'field' }, h('label', null, 'Team 2'), in2)
      ),
      fieldsWrap.children.length ? h('div', { class: 'card' },
        h('div', { class: 'microlabel', style: 'margin-bottom:10px' }, 'FORMAT'),
        fieldsWrap
      ) : null,
      h('div', { class: 'spacer', style: 'flex:1' }),
      h('button', { class: 'btn primary big block', onclick: function () {
        var id = SE.newMatch(def.key, [
          { name: in1.value.trim() || 'Team A' },
          { name: in2.value.trim() || 'Team B' }
        ], cfg);
        SE.nav('#/score/' + id);
      } }, 'Start scoring →')
    ));
  });

  /* ---------- Scorer + spectator mounts (delegate to sport def) ---------- */
  SE.registerScreen('score', function (root, args) {
    var m = SE.store.get().matches[args[0]];
    if (!m) return SE.nav('#/home');
    if (m.status === 'done') return SE.nav('#/result/' + m.id);
    var def = SE.sports[m.sport];
    var api = {
      dispatch: function (action, payload) {
        var ended = SE.dispatch(m.id, action, payload);
        if (ended) SE.nav('#/result/' + m.id);
      },
      undo: function () { SE.undo(m.id); },
      end: function (result) { SE.endMatch(m.id, result); SE.nav('#/result/' + m.id); },
      nav: SE.nav,
    };
    def.renderScorer(root, m, api);
  });

  SE.registerScreen('watch', function (root, args) {
    var m = SE.store.get().matches[args[0]];
    if (!m) return SE.nav('#/home');
    var def = SE.sports[m.sport];
    def.renderSpectator(root, m);
  });

  /* ---------- Dev board ---------- */
  SE.registerScreen('board', function (root) {
    var s = SE.store.get();
    root.appendChild(h('div', { class: 'screen' },
      SE.topbar({ title: 'Dev board', sub: 'all routes + data' }),
      h('div', { class: 'card', style: 'display:flex;flex-wrap:wrap;gap:8px' },
        ['#/home', '#/pick', '#/records', '#/schedule', '#/ground'].map(function (r) {
          return h('a', { class: 'chip', href: r }, r);
        }),
        SE.sportList().map(function (d) { return h('a', { class: 'chip accent', href: '#/setup/' + d.key }, d.icon + ' ' + d.key); })
      ),
      h('div', { class: 'card' },
        h('div', { class: 'microlabel', style: 'margin-bottom:8px' }, 'MATCHES (' + Object.keys(s.matches).length + ')'),
        Object.keys(s.matches).map(function (k) {
          var m = s.matches[k];
          return h('div', { class: 'row', style: 'padding:6px 0' },
            h('span', { class: 'chip ' + (m.status === 'live' ? 'live' : '') }, m.status),
            h('div', { class: 'grow mono', style: 'font-size:12px' }, m.sport + ' · ' + m.teams[0].name + '–' + m.teams[1].name),
            h('a', { class: 'chip', href: '#/score/' + k }, 'score'),
            h('a', { class: 'chip', href: '#/watch/' + k }, 'watch'),
            h('a', { class: 'chip', href: '#/result/' + k }, 'result')
          );
        })
      ),
      h('button', { class: 'btn danger block', onclick: function () { if (confirm('Wipe all prototype data?')) { SE.store.reset(); SE.nav('#/home'); } } }, 'Reset all data')
    ));
  });
})();
