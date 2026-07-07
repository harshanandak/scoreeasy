/* Scheduler ("time optional") + ground type ("rules auto-tune").
   Fragments: 4a-match-scheduler.html, 4b-ground-type.html. */
(function () {
  'use strict';
  var h = SE.h;

  /* ---------- Schedule a game (#/schedule) ---------- */
  SE.registerScreen('schedule', function (root) {
    var sports = SE.sportList();
    var s = SE.store.get();
    var cfg = { sport: sports[0] ? sports[0].key : null };

    var seg = h('div', { class: 'seg' });
    sports.forEach(function (def) {
      var b = h('button', {
        class: cfg.sport === def.key ? 'on' : '',
        onclick: function () {
          cfg.sport = def.key;
          Array.prototype.forEach.call(seg.children, function (c) { c.className = ''; });
          b.className = 'on';
        }
      }, def.icon + ' ' + def.label);
      seg.appendChild(b);
    });

    var titleInput = h('input', { value: 'TeamA vs TeamB' });
    var whenInput = h('input', { placeholder: 'e.g. Sat 5 PM — leave blank for Upcoming' });

    root.appendChild(h('div', { class: 'screen' },
      SE.topbar({ title: 'Schedule a game', sub: 'Time optional', back: '#/home' }),

      h('div', { class: 'card', style: 'display:flex;flex-direction:column;gap:12px' },
        sports.length ? h('div', { class: 'field' }, h('label', null, 'Sport'), seg) : null,
        h('div', { class: 'field' }, h('label', null, 'Title'), titleInput),
        h('div', { class: 'field' }, h('label', null, 'When (optional)'), whenInput)
      ),

      h('div', { class: 'card row', style: 'gap:9px' },
        h('span', null, '💡'),
        h('span', { class: 'muted', style: 'font-size:11px;flex:1' },
          'No fixed time? It sits in Upcoming — start it whenever the teams show up.')
      ),

      h('button', {
        class: 'btn primary big block',
        onclick: function () {
          if (!cfg.sport) return;
          var title = titleInput.value.trim() || 'TeamA vs TeamB';
          var when = whenInput.value.trim();
          SE.store.update(function (st) { st.scheduled.push({ sport: cfg.sport, title: title, when: when }); });
        }
      }, 'Save to Upcoming'),

      h('div', { class: 'microlabel' }, 'SCHEDULED (' + s.scheduled.length + ')'),
      s.scheduled.length ? h('div', { style: 'display:flex;flex-direction:column;gap:8px' },
        s.scheduled.map(function (g, i) {
          var def = SE.sports[g.sport] || { icon: '🏟', label: g.sport };
          return h('div', { class: 'card row', style: 'padding:12px' },
            h('div', { style: 'font-size:20px' }, def.icon),
            h('div', { class: 'grow' },
              h('div', { style: 'font-weight:700' }, g.title),
              h('div', { class: 'mono muted', style: 'font-size:11px' }, g.when || 'time TBD — sits in Upcoming')
            ),
            h('button', {
              class: 'btn', style: 'padding:8px 12px',
              onclick: function () { SE.nav('#/setup/' + g.sport); }
            }, 'Play now'),
            h('button', {
              class: 'btn ghost', style: 'padding:8px 10px',
              onclick: function () { SE.store.update(function (st) { st.scheduled.splice(i, 1); }); }
            }, '✕')
          );
        })
      ) : h('div', { class: 'card center muted', style: 'font-size:12px;padding:20px' }, 'Nothing scheduled yet.')
    ));
  });

  /* ---------- Ground type (#/ground) ---------- */
  var GROUNDS = [
    { value: 'turf', label: 'Turf', icon: '📦', note: 'nets or boundaries around',
      tunes: 'Wall/net rebounds count as live play, tighter boundary scoring, no run-up limits.' },
    { value: 'concrete', label: 'Concrete', icon: '🛣️', note: 'hard surface, tight space',
      tunes: 'Shorter boundaries, bounce-heavy calls, safety-first contact rules.' },
    { value: 'indoor', label: 'Indoor', icon: '🏟️', note: 'walls in play, standard court',
      tunes: 'Wall-in-play rules where relevant, standard court dimensions, no weather stoppages.' },
    { value: 'grass', label: 'Grass', icon: '🌱', note: 'open field, standard rules',
      tunes: 'Full standard rules, no boundary shortcuts, weather delays allowed.' }
  ];

  SE.registerScreen('ground', function (root) {
    var s = SE.store.get();
    var current = s.settings.ground || 'turf';
    var active = GROUNDS.filter(function (g) { return g.value === current; })[0] || GROUNDS[0];

    root.appendChild(h('div', { class: 'screen' },
      SE.topbar({ title: 'Where are you playing?', sub: 'Rules auto-tune to the ground', back: '#/home' }),

      h('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:9px' },
        GROUNDS.map(function (g) {
          var on = g.value === current;
          return h('button', {
            class: 'tapzone' + (on ? ' leading' : ''),
            style: 'padding:12px;text-align:left;font-family:inherit',
            onclick: function () { SE.store.update(function (st) { st.settings.ground = g.value; }); }
          },
            h('div', { style: 'font-size:20px' }, g.icon),
            h('div', { style: 'font-size:13px;font-weight:700;margin-top:5px' }, g.label),
            h('div', { class: 'muted', style: 'font-size:10px;margin-top:2px' }, g.note)
          );
        })
      ),

      h('div', { class: 'card' },
        h('div', { class: 'microlabel', style: 'margin-bottom:8px' }, active.label.toUpperCase() + ' AUTO-TUNES'),
        h('div', { class: 'muted', style: 'font-size:12px;line-height:1.5' }, active.tunes)
      ),

      h('div', { class: 'muted', style: 'font-size:11px' }, 'Change any of these after — this just sets sensible defaults.')
    ));
  });
})();
