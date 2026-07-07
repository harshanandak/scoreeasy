/* Result moment + rematch sheet. Generic over any sport def — reads only
   match.result, match.teams, match.config, match.events, and (optionally)
   def.headline. Fragments: 3a-result-moment.html, 3b-rematch-sheet.html. */
(function () {
  'use strict';
  var h = SE.h;

  /* ---------- Result takeover (#/result/:id) ---------- */
  SE.registerScreen('result', function (root, args) {
    var m = SE.store.get().matches[args[0]];
    if (!m) return SE.nav('#/home');
    if (m.status === 'live') return SE.nav('#/score/' + m.id);

    var def = SE.sports[m.sport];
    var result = m.result || { summary: 'Match ended', winnerIndex: null };
    var winner = result.winnerIndex != null ? m.teams[result.winnerIndex] : null;
    var durSecs = m.endedAt && m.startedAt ? Math.max(0, Math.round((m.endedAt - m.startedAt) / 1000)) : 0;
    var events = m.events || [];
    var lastEvents = events.slice(-5).reverse();

    root.appendChild(h('div', { class: 'screen' },

      h('div', {
        class: 'card', style: 'background:linear-gradient(160deg,var(--accent-live),var(--accent));' +
          'color:#fff;text-align:center;padding:22px 16px'
      },
        h('div', { class: 'mono', style: 'font-size:10px;letter-spacing:.2em;opacity:.75' },
          (def.label || m.sport).toUpperCase() + ' · FULL TIME'),
        h('div', { style: 'font-size:26px;font-weight:800;letter-spacing:-.02em;margin-top:8px' },
          winner ? winner.name.toUpperCase() + ' WIN' : 'MATCH OVER'),
        h('div', { style: 'font-size:13px;opacity:.85;margin-top:3px' }, result.summary),
        h('div', { class: 'row mono', style: 'justify-content:center;gap:18px;margin-top:14px;font-size:13px' },
          m.teams.map(function (t, i) {
            return h('span', { style: i === result.winnerIndex ? 'font-weight:600' : 'opacity:.75' }, t.name);
          })
        )
      ),

      h('div', { class: 'row', style: 'gap:8px' },
        h('div', { class: 'card center', style: 'flex:1;padding:10px' },
          h('div', { class: 'bignum', style: 'font-size:16px' }, SE.fmtClock(durSecs)),
          h('div', { class: 'microlabel', style: 'margin-top:2px' }, 'DURATION')),
        h('div', { class: 'card center', style: 'flex:1;padding:10px' },
          h('div', { class: 'bignum', style: 'font-size:16px' }, String(events.length)),
          h('div', { class: 'microlabel', style: 'margin-top:2px' }, 'EVENTS')),
        def.headline ? h('div', { class: 'card center', style: 'flex:1;padding:10px' },
          h('div', { class: 'mono', style: 'font-size:12px;font-weight:600' }, def.headline(m)),
          h('div', { class: 'microlabel', style: 'margin-top:2px' }, 'FINAL')) : null
      ),

      lastEvents.length ? h('div', { class: 'card' },
        h('div', { class: 'microlabel', style: 'margin-bottom:8px' }, 'LAST FEW PLAYS'),
        lastEvents.map(function (ev) {
          return h('div', { class: 'row', style: 'padding:4px 0;font-size:12px' },
            h('span', { class: 'grow' }, ev.label),
            h('span', { class: 'mono muted', style: 'font-size:10px' },
              new Date(ev.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
          );
        })
      ) : null,

      h('div', { class: 'spacer', style: 'flex:1' }),

      h('div', { class: 'row', style: 'gap:8px' },
        h('a', { class: 'btn ghost', style: 'flex:1', href: '#/records' }, 'Records'),
        h('a', { class: 'btn ghost', style: 'flex:1', href: '#/home' }, 'Home')
      ),
      h('button', {
        class: 'btn primary big block',
        onclick: function () { SE.nav('#/rematch/' + m.id); }
      }, 'Rematch ↻')
    ));
  });

  /* ---------- Rematch sheet (#/rematch/:id) ---------- */
  SE.registerScreen('rematch', function (root, args) {
    var m = SE.store.get().matches[args[0]];
    if (!m) return SE.nav('#/home');
    var def = SE.sports[m.sport];
    var names = [m.teams[0].name, m.teams[1].name];
    var swapped = false;

    var team1El = h('span', { style: 'font-weight:700;font-size:13px' }, names[0]);
    var team2El = h('span', { style: 'font-weight:700;font-size:13px' }, names[1]);
    var swapBtn = h('button', {
      class: 'chip accent', style: 'cursor:pointer',
      onclick: function () {
        swapped = !swapped;
        team1El.textContent = swapped ? names[1] : names[0];
        team2El.textContent = swapped ? names[0] : names[1];
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
      return h('span', { class: 'chip accent' }, (f ? f.label : k) + ' ' + val);
    });

    root.appendChild(h('div', { class: 'screen' },
      SE.topbar({ title: 'Rematch', sub: 'Setup carried over', back: '#/result/' + m.id }),

      h('div', { class: 'card', style: 'display:flex;flex-direction:column;gap:12px' },
        h('div', { class: 'row', style: 'justify-content:space-between' },
          h('div', { class: 'row' }, team1El, h('span', { class: 'mono muted', style: 'font-size:11px' }, 'vs'), team2El),
          swapBtn
        ),
        h('div', { style: 'display:flex;flex-wrap:wrap;gap:6px' },
          h('span', { class: 'chip' }, def.icon + ' ' + def.label),
          cfgChips
        )
      ),

      h('div', { class: 'spacer', style: 'flex:1' }),

      h('button', {
        class: 'btn primary big block',
        onclick: function () {
          var teams = swapped
            ? [{ name: names[1] }, { name: names[0] }]
            : [{ name: names[0] }, { name: names[1] }];
          var id = SE.newMatch(m.sport, teams, m.config);
          SE.nav('#/score/' + id);
        }
      }, 'Start rematch →')
    ));
  });
})();
