/* Shell screens: Home, Sport picker, Match setup, dev Board. Synthesized in the
   HiFi board's language (no source screen exists for these — the board starts at scorers). */
(function () {
  'use strict';
  var h = SE.h;

  /* ---------- Home — 1:1 port of fragment 4c (home with upcoming) ---------- */
  SE.registerScreen('home', function (root) {
    var live = SE.liveMatches();
    var sched = SE.store.get().scheduled;
    var hero = sched.filter(function (g) { return g.when; })[0];
    var rest = sched.filter(function (g) { return g !== hero; });

    function microlabel(text) {
      return h('div', { style: 'font-size:11px;font-weight:700;letter-spacing:.06em;color:#9aa8a0;text-transform:uppercase;margin-top:2px' }, text);
    }
    function tabItem(label, active, href) {
      return h('a', { href: href, style: 'display:flex;flex-direction:column;align-items:center;gap:3px;font-size:10px;font-weight:600;text-decoration:none;color:' + (active ? '#12936a' : '#b3bdb6') },
        h('div', { style: 'width:18px;height:18px;border-radius:6px;border:2px solid currentColor;' + (active ? 'background:#e7f4ee' : '') }),
        label
      );
    }

    root.appendChild(h('div', { style: 'flex:1;display:flex;flex-direction:column;background:#f4f6f3;color:#14201a' },
      h('div', { style: 'flex:1;display:flex;flex-direction:column;padding:10px 15px;gap:11px' },

        h('div', { style: 'display:flex;align-items:center;justify-content:space-between' },
          h('div', { style: 'font-size:19px;font-weight:800;letter-spacing:-.02em' }, 'Score', h('span', { style: 'color:#12936a' }, 'Easy')),
          h('div', { style: 'width:32px;height:32px;border-radius:50%;background:#dfe7e1;cursor:pointer', onclick: function () { SE.nav('#/board'); } })
        ),

        (hero || rest.length) ? microlabel('Upcoming') : null,

        hero ? (function () {
          var def = SE.sports[hero.sport] || { icon: '🏟', label: hero.sport };
          return h('div', { style: 'background:#14201a;color:#fff;border-radius:18px;padding:13px 15px;display:flex;flex-direction:column;gap:9px' },
            h('div', { style: 'display:flex;align-items:center;justify-content:space-between' },
              h('span', { style: 'font-size:14px;font-weight:700' }, hero.title),
              h('span', { class: 'mono', style: 'font-size:10px;color:#3fd598' }, hero.when.toUpperCase())
            ),
            h('div', { style: 'font-size:11px;color:rgba(255,255,255,.6)' }, def.label + ' · tap start when ready'),
            h('div', { style: 'display:flex;gap:8px;margin-top:2px' },
              h('span', { style: 'flex:1;background:#12936a;border-radius:11px;padding:9px 0;text-align:center;font-size:12px;font-weight:700;cursor:pointer', onclick: function () { SE.nav('#/setup/' + hero.sport); } }, 'Start now'),
              h('span', { style: 'width:74px;background:rgba(255,255,255,.12);border-radius:11px;padding:9px 0;text-align:center;font-size:12px;font-weight:600;cursor:pointer', onclick: function () { SE.nav('#/schedule'); } }, 'Edit')
            )
          );
        })() : null,

        rest.map(function (g) {
          var def = SE.sports[g.sport] || { icon: '🏟', label: g.sport };
          return h('div', { style: 'background:#fff;border-radius:16px;padding:12px 14px;box-shadow:0 1px 3px rgba(20,40,30,.07);display:flex;align-items:center;gap:10px' },
            h('span', { style: 'font-size:15px' }, def.icon),
            h('div', { style: 'flex:1' },
              h('div', { style: 'font-size:13px;font-weight:700' }, g.title),
              h('div', { style: 'font-size:11px;color:#6b7a72' }, g.when ? g.when : 'No fixed time — start when ready')
            ),
            h('span', { style: 'background:#e7f4ee;color:#12936a;border-radius:99px;padding:6px 12px;font-size:11px;font-weight:700;cursor:pointer', onclick: function () { SE.nav('#/setup/' + g.sport); } }, 'Start')
          );
        }),

        !hero && !rest.length ? h('a', { style: 'background:#fff;border-radius:16px;padding:12px 14px;box-shadow:0 1px 3px rgba(20,40,30,.07);display:flex;align-items:center;gap:10px;text-decoration:none;color:inherit', href: '#/schedule' },
          h('span', { style: 'font-size:15px' }, '🗓'),
          h('div', { style: 'flex:1' },
            h('div', { style: 'font-size:13px;font-weight:700' }, 'Schedule a game'),
            h('div', { style: 'font-size:11px;color:#6b7a72' }, 'Time optional — just pick teams')
          ),
          h('span', { style: 'color:#9aa8a0' }, '›')
        ) : null,

        live.length ? microlabel('Active') : null,
        live.map(function (m) {
          var def = SE.sports[m.sport];
          return h('a', { style: 'background:#fff;border-radius:16px;padding:13px;box-shadow:0 1px 3px rgba(20,40,30,.07);display:flex;flex-direction:column;gap:8px;text-decoration:none;color:inherit', href: '#/score/' + m.id },
            h('div', { style: 'display:flex;align-items:center;justify-content:space-between' },
              h('span', { style: 'font-size:14px;font-weight:700' }, m.teams[0].name + ' vs ' + m.teams[1].name),
              h('span', { style: 'display:inline-flex;align-items:center;gap:5px;font-size:10px;font-weight:700;color:#d64f43' },
                h('span', { style: 'width:6px;height:6px;border-radius:50%;background:#d64f43;animation:se-pulse 1.4s infinite' }), 'LIVE')
            ),
            h('div', { style: 'display:flex;align-items:center;justify-content:space-between' },
              h('span', { style: 'font-size:12px;color:#6b7a72' }, def.icon + ' ' + def.label),
              h('span', { class: 'mono', style: 'font-size:20px;font-weight:500' }, def.headline ? def.headline(m) : 'in play')
            )
          );
        }),

        h('div', { style: 'flex:1' }),

        h('div', {
          style: 'background:#12936a;color:#fff;border-radius:16px;padding:13px 15px;display:flex;align-items:center;justify-content:space-between;box-shadow:0 12px 22px -12px rgba(18,147,106,.7);cursor:pointer',
          onclick: function () { SE.nav('#/pick'); }
        }, h('span', { style: 'font-size:15px;font-weight:700' }, '＋ New game'), h('span', { style: 'font-size:17px' }, '›'))
      ),

      h('div', { style: 'height:50px;flex:none;border-top:1px solid #e7ebe7;background:#fff;display:grid;grid-template-columns:repeat(4,1fr);align-items:center' },
        tabItem('Home', true, '#/home'),
        tabItem('Play', false, '#/pick'),
        tabItem('History', false, '#/records'),
        tabItem('More', false, '#/board')
      )
    ));
  });

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
