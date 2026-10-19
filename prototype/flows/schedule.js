/* Scheduler ("time optional") + ground type ("rules auto-tune").
   Fragments: 4a-match-scheduler.html, 4b-ground-type.html. */
(function () {
  'use strict';
  var h = SE.h;

  function microlabel(text) {
    return h('div', { style: 'font-size:11px;font-weight:700;letter-spacing:.06em;color:#9aa8a0;text-transform:uppercase' }, text);
  }
  function chipStyle(active, muted) {
    if (active) return 'background:#e7f4ee;border:1.5px solid #12936a;color:#12936a;border-radius:12px;padding:8px 13px;font-size:12px;font-weight:700;cursor:pointer';
    return 'background:#fff;border-radius:12px;padding:8px 13px;font-size:12px;font-weight:600;box-shadow:0 1px 3px rgba(20,40,30,.06);cursor:pointer' + (muted ? ';color:#6b7a72' : '');
  }

  /* ---------- Schedule a game (#/schedule) — 1:1 port of fragment 4a ---------- */
  SE.registerScreen('schedule', function (root) {
    var sports = SE.sportList();
    var s = SE.store.get();
    var cfg = { sport: sports[0] ? sports[0].key : null, day: 'Today', time: '' };
    var title = 'TeamA vs TeamB';

    function sportDef() { return SE.sports[cfg.sport] || { icon: '🏟', label: cfg.sport || 'Sport' }; }
    function matchSub() {
      var ground = SE.store.get().settings.ground || 'turf';
      var tagline = sportDef().tagline;
      return ground.charAt(0).toUpperCase() + ground.slice(1) + ' ground rules' + (tagline ? ' · ' + tagline : '');
    }

    // header
    var header = h('div', { style: 'display:flex;align-items:center;gap:10px' },
      h('span', { style: 'font-size:16px;color:#6b7a72;cursor:pointer', onclick: function () { SE.nav('#/home'); } }, '‹'),
      h('div', { style: 'font-size:18px;font-weight:800' }, 'When do you play?')
    );

    // Play now / Schedule mode toggle
    var modeSeg = h('div', { style: 'display:inline-flex;align-self:flex-start;background:#e7ece8;border-radius:11px;padding:2px' },
      h('span', { style: 'padding:7px 16px;font-size:12px;font-weight:600;color:#9aa8a0;cursor:pointer', onclick: function () { SE.nav('#/pick'); } }, 'Play now'),
      h('span', { style: 'padding:7px 16px;border-radius:9px;background:#fff;font-size:12px;font-weight:700;box-shadow:0 1px 2px rgba(20,40,30,.08)' }, 'Schedule')
    );

    // Day chips: Sun / Today / Sat / pick-a-day
    var dayOptions = [
      { label: 'Sun', value: 'Sun' },
      { label: 'Today', value: 'Today' },
      { label: 'Sat', value: 'Sat' },
      { label: '📅 Pick', value: 'pick', muted: true }
    ];
    var dayIndex = 1;
    var dayBtns = [];
    dayOptions.forEach(function (opt, i) {
      var b = h('span', {
        style: chipStyle(i === dayIndex, opt.muted),
        onclick: function () {
          if (opt.value === 'pick') {
            var val = prompt('Enter a day (e.g. Sat 12 Jul)', '');
            if (!val) return;
            cfg.day = val;
            b.textContent = '📅 ' + val;
          } else {
            cfg.day = opt.value;
          }
          dayIndex = i;
          dayBtns.forEach(function (x, j) { x.setAttribute('style', chipStyle(j === dayIndex, dayOptions[j].muted)); });
        }
      }, opt.label);
      dayBtns.push(b);
    });
    cfg.day = dayOptions[dayIndex].value;
    var dayRow = h('div', { style: 'display:flex;gap:7px' }, dayBtns);

    // Time chips: Morning / Afternoon / Evening / no fixed time
    var timeOptions = [
      { label: 'Morning', value: 'Morning' },
      { label: 'Afternoon', value: 'Afternoon' },
      { label: 'Evening', value: 'Evening' },
      { label: 'No fixed time', value: '', muted: true }
    ];
    var timeIndex = 3;
    var timeBtns = [];
    timeOptions.forEach(function (opt, i) {
      var b = h('span', {
        style: chipStyle(i === timeIndex, opt.muted),
        onclick: function () {
          cfg.time = opt.value;
          timeIndex = i;
          timeBtns.forEach(function (x, j) { x.setAttribute('style', chipStyle(j === timeIndex, timeOptions[j].muted)); });
        }
      }, opt.label);
      timeBtns.push(b);
    });
    cfg.time = timeOptions[timeIndex].value;
    var timeRow = h('div', { style: 'display:flex;gap:7px;flex-wrap:wrap' }, timeBtns);

    var tipCard = h('div', { style: 'background:#fff;border-radius:14px;padding:10px 13px;box-shadow:0 1px 3px rgba(20,40,30,.06);display:flex;align-items:center;gap:9px' },
      h('span', { style: 'font-size:13px' }, '💡'),
      h('span', { style: 'font-size:11px;color:#6b7a72;flex:1' },
        'No fixed time? It sits in ', h('b', { style: 'color:#14201a' }, 'Upcoming'), ' — start it whenever the teams show up.'
      )
    );

    // Match card: tap the icon to cycle sport, Edit to rename the title
    var titleLine = h('div', { style: 'font-size:13px;font-weight:700' }, title);
    var subLine = h('div', { style: 'font-size:11px;color:#6b7a72' }, matchSub());
    var iconEl = h('span', {
      style: 'font-size:16px;cursor:pointer',
      onclick: function () {
        if (!sports.length) return;
        var idx = 0;
        sports.forEach(function (d, i) { if (d.key === cfg.sport) idx = i; });
        cfg.sport = sports[(idx + 1) % sports.length].key;
        iconEl.textContent = sportDef().icon;
        subLine.textContent = matchSub();
      }
    }, sportDef().icon);
    var matchCard = h('div', { style: 'background:#fff;border-radius:16px;padding:12px 14px;box-shadow:0 1px 3px rgba(20,40,30,.07);display:flex;align-items:center;gap:10px' },
      iconEl,
      h('div', { style: 'flex:1' }, titleLine, subLine),
      h('span', {
        style: 'font-size:12px;color:#12936a;font-weight:700;cursor:pointer',
        onclick: function () {
          var val = prompt('Match title', title);
          if (val && val.trim()) { title = val.trim(); titleLine.textContent = title; }
        }
      }, 'Edit')
    );

    // Reminder toggle
    var remindOn = true;
    var remindKnob = h('div', { style: 'position:absolute;top:2px;width:17px;height:17px;border-radius:50%;background:#fff;right:2px' });
    var remindTrack = h('div', {
      style: 'width:36px;height:21px;border-radius:11px;position:relative;cursor:pointer;background:#12936a',
      onclick: function () {
        remindOn = !remindOn;
        remindTrack.setAttribute('style', 'width:36px;height:21px;border-radius:11px;position:relative;cursor:pointer;background:' + (remindOn ? '#12936a' : '#dfe7e1'));
        remindKnob.setAttribute('style', 'position:absolute;top:2px;width:17px;height:17px;border-radius:50%;background:#fff;' + (remindOn ? 'right:2px' : 'left:2px'));
      }
    }, remindKnob);
    var reminderRow = h('div', { style: 'display:flex;align-items:center;justify-content:space-between;background:#fff;border-radius:14px;padding:11px 14px;box-shadow:0 1px 3px rgba(20,40,30,.06)' },
      h('span', { style: 'font-size:12px;font-weight:600' }, 'Remind both teams 1 hr before'),
      remindTrack
    );

    var saveBtn = h('div', {
      style: 'background:#12936a;color:#fff;border-radius:16px;padding:14px 0;text-align:center;font-size:15px;font-weight:700;box-shadow:0 12px 22px -12px rgba(18,147,106,.7);cursor:pointer',
      onclick: function () {
        if (!cfg.sport) return;
        var when = [cfg.day, cfg.time].filter(function (x) { return x; }).join(' · ');
        SE.store.update(function (st) { st.scheduled.push({ sport: cfg.sport, title: title, when: when }); });
      }
    }, 'Save to Upcoming');

    var scheduledList = s.scheduled.length ? h('div', { style: 'display:flex;flex-direction:column;gap:8px' },
      s.scheduled.map(function (g, i) {
        var def = SE.sports[g.sport] || { icon: '🏟', label: g.sport };
        return h('div', { style: 'background:#fff;border-radius:16px;padding:12px 14px;box-shadow:0 1px 3px rgba(20,40,30,.07);display:flex;align-items:center;gap:10px' },
          h('span', { style: 'font-size:16px' }, def.icon),
          h('div', { style: 'flex:1' },
            h('div', { style: 'font-size:13px;font-weight:700' }, g.title),
            h('div', { class: 'mono', style: 'font-size:11px;color:#6b7a72' }, g.when || 'time TBD — sits in Upcoming')
          ),
          h('span', { style: 'background:#e7f4ee;color:#12936a;border-radius:99px;padding:6px 12px;font-size:11px;font-weight:700;cursor:pointer', onclick: function () { SE.nav('#/setup/' + g.sport); } }, 'Start'),
          h('span', { style: 'font-size:12px;color:#9aa8a0;cursor:pointer;padding:4px', onclick: function () { SE.store.update(function (st) { st.scheduled.splice(i, 1); }); } }, '✕')
        );
      })
    ) : h('div', { style: 'text-align:center;color:#6b7a72;font-size:12px;padding:20px' }, 'Nothing scheduled yet.');

    root.appendChild(h('div', { style: 'flex:1;display:flex;flex-direction:column;background:#f4f6f3;color:#14201a' },
      h('div', { style: 'flex:1;display:flex;flex-direction:column;padding:8px 15px;gap:11px;padding-bottom:calc(20px + env(safe-area-inset-bottom))' },
        header,
        modeSeg,
        microlabel('Day'), dayRow,
        microlabel('Time'), timeRow,
        tipCard,
        microlabel('Match'), matchCard,
        reminderRow,
        saveBtn,
        microlabel('SCHEDULED (' + s.scheduled.length + ')'),
        scheduledList
      )
    ));
  });

  /* ---------- Ground type (#/ground) — 1:1 port of fragment 4b ---------- */
  var GROUNDS = [
    { value: 'turf', label: 'Turf', icon: '📦', note: 'nets or boundaries around',
      rules: ['Net/wall rebounds = live ball', 'Tighter boundary scoring', 'No run-up limits'] },
    { value: 'concrete', label: 'Concrete', icon: '🛣️', note: 'hard surface, tight space',
      rules: ['Bounce-heavy calls', 'Safety-first contact rules', 'Shorter boundaries'] },
    { value: 'indoor', label: 'Indoor', icon: '🏟️', note: 'walls in play, standard court',
      rules: ['Wall-in-play rules where relevant', 'Standard court dimensions', 'No weather stoppages'] },
    { value: 'grass', label: 'Grass', icon: '🌱', note: 'open field, standard rules',
      rules: ['Full standard rules', 'No boundary shortcuts', 'Weather delays allowed'] }
  ];

  SE.registerScreen('ground', function (root) {
    var s = SE.store.get();
    var current = s.settings.ground || 'turf';
    var active = GROUNDS.filter(function (g) { return g.value === current; })[0] || GROUNDS[0];

    function ruleOn(idx) {
      var overrides = s.settings.groundRules && s.settings.groundRules[current];
      return !overrides || overrides[idx] !== false;
    }
    function toggleRule(idx) {
      SE.store.update(function (st) {
        st.settings.groundRules = st.settings.groundRules || {};
        st.settings.groundRules[current] = st.settings.groundRules[current] || {};
        st.settings.groundRules[current][idx] = !ruleOn(idx);
      });
    }
    function resetRules() {
      SE.store.update(function (st) {
        st.settings.groundRules = st.settings.groundRules || {};
        st.settings.groundRules[current] = {};
      });
    }
    var tunedCount = active.rules.filter(function (_, i) { return ruleOn(i); }).length;

    root.appendChild(h('div', { style: 'flex:1;display:flex;flex-direction:column;background:#f4f6f3;color:#14201a' },
      h('div', { style: 'flex:1;display:flex;flex-direction:column;padding:8px 15px;gap:10px;padding-bottom:calc(20px + env(safe-area-inset-bottom))' },

        h('div', { style: 'display:flex;align-items:center;gap:10px' },
          h('span', { style: 'font-size:16px;color:#6b7a72;cursor:pointer', onclick: function () { SE.nav('#/home'); } }, '‹'),
          h('div', null,
            h('div', { style: 'font-size:18px;font-weight:800' }, 'Where are you playing?'),
            h('div', { style: 'font-size:11px;color:#6b7a72' }, 'Rules adjust to the ground — change any of them after')
          )
        ),

        h('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:9px' },
          GROUNDS.map(function (g) {
            var on = g.value === current;
            return h('div', {
              style: on
                ? 'background:#e7f4ee;border:1.5px solid #12936a;border-radius:16px;padding:12px;color:#12936a;cursor:pointer'
                : 'background:#fff;border-radius:16px;padding:12px;box-shadow:0 1px 3px rgba(20,40,30,.06);cursor:pointer',
              onclick: function () { SE.store.update(function (st) { st.settings.ground = g.value; }); }
            },
              h('div', { style: 'font-size:20px' }, g.icon),
              h('div', { style: 'font-size:13px;font-weight:700;margin-top:5px' }, g.label),
              h('div', { style: 'font-size:10px;margin-top:2px;color:' + (on ? '#3e8266' : '#9aa8a0') }, g.note)
            );
          })
        ),

        h('div', { style: 'background:#fff;border-radius:16px;padding:12px 14px;box-shadow:0 1px 3px rgba(20,40,30,.07);display:flex;flex-direction:column;gap:9px' },
          h('div', { style: 'display:flex;align-items:center;justify-content:space-between' },
            h('span', { style: 'font-size:11px;font-weight:700;letter-spacing:.06em;color:#9aa8a0;text-transform:uppercase' }, active.label.toUpperCase() + ' RULES · ' + tunedCount + ' TUNED'),
            h('span', { style: 'font-size:11px;color:#12936a;font-weight:700;cursor:pointer', onclick: resetRules }, 'Reset')
          ),
          active.rules.map(function (label, idx) {
            var on = ruleOn(idx);
            return h('div', { style: 'display:flex;align-items:center;justify-content:space-between' },
              h('span', { style: 'font-size:12px;font-weight:600' }, label),
              h('div', {
                style: 'width:34px;height:20px;border-radius:10px;position:relative;cursor:pointer;background:' + (on ? '#12936a' : '#dfe7e1'),
                onclick: function () { toggleRule(idx); }
              }, h('div', { style: 'position:absolute;top:2px;width:16px;height:16px;border-radius:50%;background:#fff;' + (on ? 'right:2px' : 'left:2px') }))
            );
          })
        ),

        h('div', { style: 'font-size:11px;color:#6b7a72;padding:0 2px' },
          'Saved as ', h('b', { style: 'color:#14201a' }, '"' + active.label + ' setup"'), ' — reused automatically next time you play here.'
        ),

        h('div', { style: 'flex:1' }),

        h('div', {
          style: 'background:#12936a;color:#fff;border-radius:16px;padding:14px 0;text-align:center;font-size:15px;font-weight:700;box-shadow:0 12px 22px -12px rgba(18,147,106,.7);cursor:pointer',
          onclick: function () { SE.nav('#/home'); }
        }, 'Continue →')
      )
    ));
  });
})();
