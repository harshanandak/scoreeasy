/* Shell screens: Home, Sport picker, Match setup, dev Board. Synthesized in the
   HiFi board's language (no source screen exists for these — the board starts at scorers). */
(function () {
  'use strict';
  var h = SE.h;

  /* ---------- Home — Floodlight ---------- */
  SE.registerScreen('home', function (root) {
    var ui = SE.ui;
    var live = SE.liveMatches();
    var sched = SE.store.get().scheduled;
    var hero = sched.filter(function (g) { return g.when; })[0];
    var rest = sched.filter(function (g) { return g !== hero; });

    function sportMark(key, size) {
      return SE.hasIcon(key)
        ? h('span', { style: 'display:inline-flex;color:var(--fl-ink)' }, SE.icon(key, size || 26))
        : h('span', { style: 'font-size:' + (size || 22) + 'px' }, (SE.sports[key] || {}).icon || '🏟');
    }

    root.appendChild(ui.screen(
      h('div', { class: 'fl-scroll', style: 'display:flex;flex-direction:column;gap:12px;padding:22px 18px 14px' },

        // wordmark (clean, no mark)
        h('div', { style: 'display:flex;align-items:center;justify-content:space-between' },
          h('div', { style: 'font-size:20px;font-weight:800;letter-spacing:-.01em;text-transform:uppercase' },
            'Score', h('span', { style: 'color:var(--fl-amber)' }, 'Easy')),
          ui.iconBtn(SE.icon('more', 20), function () { SE.nav('#/board'); })
        ),

        (hero || rest.length) ? ui.microlabel('Upcoming') : null,

        hero ? (function () {
          var def = SE.sports[hero.sport] || { label: hero.sport };
          return h('div', { class: 'fl-card', style: 'padding:14px 16px;display:flex;flex-direction:column;gap:10px' },
            h('div', { style: 'display:flex;align-items:center;gap:10px' },
              sportMark(hero.sport, 26),
              h('div', { style: 'flex:1' },
                h('div', { style: 'font-size:15px;font-weight:700;letter-spacing:-.01em' }, hero.title),
                h('div', { style: 'font-size:11px;color:var(--fl-ink-dim)' }, def.label + ' · tap start when ready')
              ),
              h('span', { style: 'font-family:var(--fl-data);font-size:10px;color:var(--fl-amber);font-weight:600' }, hero.when.toUpperCase())
            ),
            h('div', { style: 'display:flex;gap:8px' },
              h('span', { class: 'fl-primary', style: 'flex:1;padding:11px 0;font-size:13px', onclick: function () { SE.nav('#/setup/' + hero.sport); } }, 'Start now'),
              h('span', { class: 'fl-primary ghost', style: 'width:84px;padding:11px 0;font-size:13px', onclick: function () { SE.nav('#/schedule'); } }, 'Edit')
            )
          );
        })() : null,

        rest.map(function (g) {
          var def = SE.sports[g.sport] || { label: g.sport };
          return h('div', { class: 'fl-card', style: 'padding:12px 14px;display:flex;align-items:center;gap:11px' },
            sportMark(g.sport, 24),
            h('div', { style: 'flex:1' },
              h('div', { style: 'font-size:13px;font-weight:700;letter-spacing:-.01em' }, g.title),
              h('div', { style: 'font-size:11px;color:var(--fl-ink-faint)' }, g.when ? g.when : 'No fixed time — start when ready')
            ),
            h('span', { class: 'fl-btn', style: 'flex:none;padding:8px 14px', onclick: function () { SE.nav('#/setup/' + g.sport); } }, 'Start')
          );
        }),

        !hero && !rest.length ? h('a', { class: 'fl-card', style: 'padding:14px;display:flex;align-items:center;gap:11px;text-decoration:none;color:inherit', href: '#/schedule' },
          h('span', { style: 'display:inline-flex;color:var(--fl-ink)' }, SE.icon('history', 24)),
          h('div', { style: 'flex:1' },
            h('div', { style: 'font-size:13px;font-weight:700' }, 'Schedule a game'),
            h('div', { style: 'font-size:11px;color:var(--fl-ink-faint)' }, 'Time optional — just pick teams')
          ),
          h('span', { style: 'color:var(--fl-ink-faint)' }, '›')
        ) : null,

        live.length ? ui.microlabel('Live now') : null,
        live.map(function (m) {
          var def = SE.sports[m.sport];
          return h('a', { class: 'fl-card', style: 'padding:13px 14px;display:flex;flex-direction:column;gap:9px;text-decoration:none;color:inherit', href: '#/score/' + m.id },
            h('div', { style: 'display:flex;align-items:center;gap:9px' },
              sportMark(m.sport, 22),
              h('span', { style: 'flex:1;font-size:14px;font-weight:700;letter-spacing:-.01em' }, m.teams[0].name + ' vs ' + m.teams[1].name),
              ui.liveChip(true)
            ),
            h('div', { style: 'display:flex;align-items:center;justify-content:space-between' },
              h('span', { style: 'font-size:12px;color:var(--fl-ink-dim)' }, def.label),
              h('span', { style: 'font-family:var(--fl-num);font-size:22px;font-weight:800;color:var(--fl-amber);letter-spacing:-.02em' }, def.headline ? def.headline(m) : 'in play')
            )
          );
        }),

        h('div', {
          class: 'fl-primary', style: 'flex:none;margin-top:6px;display:flex;align-items:center;justify-content:space-between;padding:15px 16px',
          onclick: function () { SE.nav('#/pick'); }
        }, h('span', null, '＋ New game'), h('span', { style: 'font-size:17px' }, '›'))
      ),

      h('div', { class: 'fl-tabs' },
        h('a', { class: 'fl-tab on', href: '#/home' }, SE.icon('home', 21), 'Home'),
        h('a', { class: 'fl-tab play', href: '#/pick' }, SE.icon('play', 21), 'Play'),
        h('a', { class: 'fl-tab', href: '#/records' }, SE.icon('history', 21), 'History'),
        h('a', { class: 'fl-tab', href: '#/board' }, SE.icon('more', 21), 'More')
      )
    ));
  });

  /* ---------- Sport picker (Floodlight) ---------- */
  SE.registerScreen('pick', function (root) {
    var ui = SE.ui;
    root.appendChild(ui.screen(
      ui.header({ title: 'Pick a sport', sub: 'What are we playing?', onBack: function () { SE.nav('#/home'); } }),
      h('div', { class: 'fl-scroll', style: 'display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:8px 16px calc(16px + env(safe-area-inset-bottom));align-content:start' },
        SE.sportList().map(function (def) {
          return h('div', {
            class: 'fl-card', style: 'padding:18px 8px;display:flex;flex-direction:column;align-items:center;gap:9px;cursor:pointer;-webkit-tap-highlight-color:transparent',
            onclick: function () { SE.nav('#/setup/' + def.key); }
          },
            SE.hasIcon(def.key) ? h('span', { style: 'display:inline-flex;color:var(--fl-ink)' }, SE.icon(def.key, 34)) : h('div', { style: 'font-size:30px' }, def.icon),
            h('div', { style: 'font-family:var(--fl-data);font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase' }, def.label),
            def.tagline ? h('div', { class: 'fl-microlabel', style: 'font-size:8px;color:var(--fl-ink-faint)' }, def.tagline) : null
          );
        })
      )
    ));
  });

  /* ---------- Match setup (Floodlight, driven by def.setupFields) ---------- */
  SE.registerScreen('setup', function (root, args) {
    var ui = SE.ui;
    var def = SE.sports[args[0]];
    if (!def) return SE.nav('#/pick');
    var cfg = JSON.parse(JSON.stringify(def.defaultConfig || {}));
    var names = [def.sampleTeams ? def.sampleTeams[0] : 'Team A', def.sampleTeams ? def.sampleTeams[1] : 'Team B'];

    var PILL_OFF = 'flex:1;height:34px;border-radius:10px;border:1px solid var(--fl-line-2);background:transparent;display:flex;align-items:center;justify-content:center;font-size:12px;letter-spacing:.08em;color:var(--fl-ink-dim);cursor:pointer';
    var PILL_ON = 'flex:1;height:34px;border-radius:10px;border:1px solid var(--fl-amber);background:rgba(255,195,0,.1);display:flex;align-items:center;justify-content:center;font-size:12px;letter-spacing:.08em;font-weight:600;color:var(--fl-amber);cursor:pointer';
    var fieldsWrap = h('div', { style: 'display:flex;flex-direction:column;gap:11px' });
    (def.setupFields || []).forEach(function (f) {
      if (f.type === 'choice') {
        var seg = h('div', { style: 'display:flex;gap:6px' });
        f.options.forEach(function (opt) {
          var b = h('div', { style: cfg[f.key] === opt.value ? PILL_ON : PILL_OFF, onclick: function () {
            cfg[f.key] = opt.value;
            Array.prototype.forEach.call(seg.children, function (c) { c.style.cssText = PILL_OFF; });
            b.style.cssText = PILL_ON;
          } }, opt.label);
          seg.appendChild(b);
        });
        fieldsWrap.appendChild(h('div', { style: 'display:flex;flex-direction:column;gap:6px' },
          h('div', { class: 'fl-microlabel' }, f.label), seg));
      } else if (f.type === 'number') {
        fieldsWrap.appendChild(h('div', { style: 'display:flex;flex-direction:column;gap:6px' },
          h('div', { class: 'fl-microlabel' }, f.label),
          h('input', { type: 'number', value: cfg[f.key], min: f.min || 1, max: f.max || 999,
            style: 'width:100%;box-sizing:border-box;font-family:var(--fl-data);font-size:13px;padding:10px 11px;border:1px solid var(--fl-line-2);border-radius:10px;background:var(--fl-panel);color:var(--fl-ink);outline:none',
            oninput: function (e) { cfg[f.key] = +e.target.value; } })
        ));
      }
    });

    var inputStyle = 'width:100%;box-sizing:border-box;font-family:var(--fl-ui);font-size:14px;font-weight:500;padding:11px 12px;border:1px solid var(--fl-line-2);border-radius:10px;background:var(--fl-panel);color:var(--fl-ink);outline:none';
    var in1 = h('input', { style: inputStyle, value: names[0], oninput: function (e) { names[0] = e.target.value; } });
    var in2 = h('input', { style: inputStyle, value: names[1], oninput: function (e) { names[1] = e.target.value; } });

    root.appendChild(ui.screen(
      ui.header({ title: def.icon + ' ' + def.label, sub: 'Two taps to play', onBack: function () { SE.nav('#/pick'); } }),
      h('div', { class: 'fl-scroll', style: 'display:flex;flex-direction:column;gap:11px;padding:6px 16px 0' },
        h('div', { class: 'fl-card', style: 'padding:14px;display:flex;flex-direction:column;gap:10px' },
          ui.microlabel('Teams'),
          in1,
          h('div', { style: 'text-align:center;font-family:var(--fl-data);font-size:10px;letter-spacing:.2em;color:var(--fl-ink-faint)' }, 'VS'),
          in2
        ),
        fieldsWrap.children.length ? h('div', { class: 'fl-card', style: 'padding:14px;display:flex;flex-direction:column;gap:11px' },
          ui.microlabel('Format'),
          fieldsWrap
        ) : null
      ),
      h('div', { style: 'flex:none;padding:12px 16px calc(16px + env(safe-area-inset-bottom))' },
        h('div', { class: 'fl-primary', onclick: function () {
          var id = SE.newMatch(def.key, [
            { name: in1.value.trim() || 'Team A' },
            { name: in2.value.trim() || 'Team B' }
          ], cfg);
          SE.nav('#/score/' + id);
        } }, 'Start scoring →')
      )
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
