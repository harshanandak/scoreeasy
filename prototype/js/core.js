/* ScoreEasy prototype core: SE global — DOM helper, store, router, sport registry.
   Classic script (no modules) so file:// works. Everything else registers onto SE. */
(function () {
  'use strict';

  var SE = (window.SE = {});

  /* ---------- DOM helper ---------- */
  // h('div', {class:'card', onclick:fn, style:'...'}, child, [children], 'text')
  SE.h = function (tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null || v === false) return;
        if (k.indexOf('on') === 0 && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'html') el.innerHTML = v;
        else el.setAttribute(k === 'class' ? 'class' : k, v === true ? '' : v);
      });
    }
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  };
  function append(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) return c.forEach(function (x) { append(el, x); });
    el.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
  }

  /* ---------- Store ---------- */
  var KEY = 'se-proto-v1';
  var chan = 'BroadcastChannel' in window ? new BroadcastChannel('se-proto') : null;
  var listeners = [];

  function blank() { return { matches: {}, scheduled: [], settings: { ground: 'turf' } }; }
  function load() {
    try { return Object.assign(blank(), JSON.parse(localStorage.getItem(KEY)) || {}); }
    catch (e) { return blank(); }
  }

  var state = load();

  SE.store = {
    get: function () { return state; },
    // mutate via fn(state) then persist + notify all tabs
    update: function (fn) {
      fn(state);
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
      if (chan) chan.postMessage('update');
      notify();
    },
    subscribe: function (fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (l) { return l !== fn; }); }; },
    reset: function () { state = blank(); localStorage.removeItem(KEY); if (chan) chan.postMessage('update'); notify(); },
  };
  function notify() { listeners.forEach(function (l) { try { l(state); } catch (e) { console.error(e); } }); }

  // cross-tab: reload state and re-render
  function external() { state = load(); notify(); }
  if (chan) chan.onmessage = external;
  window.addEventListener('storage', function (e) { if (e.key === KEY) external(); });

  /* ---------- Sport registry ---------- */
  SE.sports = {};
  SE.registerSport = function (def) { SE.sports[def.key] = def; };
  SE.sportList = function () {
    return Object.keys(SE.sports).map(function (k) { return SE.sports[k]; })
      .sort(function (a, b) { return (a.priority || 99) - (b.priority || 99); });
  };

  /* ---------- Match engine (event-sourced) ---------- */
  SE.newMatch = function (sportKey, teams, config) {
    var def = SE.sports[sportKey];
    var id = 'm' + Math.random().toString(36).slice(2, 8);
    SE.store.update(function (s) {
      s.matches[id] = {
        id: id, sport: sportKey, teams: teams, config: config,
        status: 'live', events: [], snapshot: def.init(config),
        startedAt: Date.now(), endedAt: null, result: null,
      };
    });
    return id;
  };

  SE.replay = function (match) {
    var def = SE.sports[match.sport];
    var snap = def.init(match.config);
    match.events.forEach(function (ev) {
      snap = def.actions[ev.action](snap, match.config, ev.payload).snap;
    });
    return snap;
  };

  // dispatch returns the result object if this action ended the match
  SE.dispatch = function (matchId, action, payload) {
    var ended = null;
    SE.store.update(function (s) {
      var m = s.matches[matchId];
      if (!m || m.status !== 'live') return;
      var def = SE.sports[m.sport];
      var out = def.actions[action](m.snapshot, m.config, payload);
      m.snapshot = out.snap;
      m.events.push({ action: action, payload: payload == null ? null : payload, label: out.label || action, ts: Date.now() });
      var res = def.isOver(m.snapshot, m.config);
      if (res) { m.status = 'done'; m.endedAt = Date.now(); m.result = res; ended = res; }
    });
    return ended;
  };

  SE.undo = function (matchId) {
    SE.store.update(function (s) {
      var m = s.matches[matchId];
      if (!m || !m.events.length) return;
      m.events.pop();
      m.snapshot = SE.replay(m);
      if (m.status === 'done') { m.status = 'live'; m.endedAt = null; m.result = null; }
    });
  };

  SE.endMatch = function (matchId, result) {
    SE.store.update(function (s) {
      var m = s.matches[matchId];
      if (!m) return;
      m.status = 'done';
      m.endedAt = Date.now();
      m.result = result || { summary: 'Match ended', winnerIndex: null };
    });
  };

  /* ---------- Router ---------- */
  SE.screens = {};
  SE.registerScreen = function (name, render) { SE.screens[name] = render; };
  SE.nav = function (hash) { location.hash = hash; };

  var cleanups = [];
  SE.onCleanup = function (fn) { cleanups.push(fn); };
  SE.interval = function (fn, ms) { var t = setInterval(fn, ms); SE.onCleanup(function () { clearInterval(t); }); return t; };

  function route() {
    var parts = (location.hash || '#/home').slice(2).split('/');
    return { name: parts[0] || 'home', args: parts.slice(1) };
  }

  var rendering = false;
  function render() {
    if (rendering) return; // dispatch inside render guard
    rendering = true;
    cleanups.forEach(function (fn) { try { fn(); } catch (e) {} });
    cleanups = [];
    var root = document.getElementById('app');
    root.innerHTML = '';
    var r = route();
    var fn = SE.screens[r.name] || SE.screens.home;
    try { fn(root, r.args, state); }
    catch (e) {
      console.error(e);
      root.appendChild(SE.h('div', { class: 'screen' }, SE.h('div', { class: 'card' }, 'Screen error: ' + e.message)));
    }
    rendering = false;
  }

  window.addEventListener('hashchange', render);
  SE.store.subscribe(function () { render(); });
  window.addEventListener('DOMContentLoaded', render);
  SE.render = render;

  /* ---------- Shared UI bits ---------- */
  SE.topbar = function (opts) {
    return SE.h('div', { class: 'topbar' },
      SE.h('a', { class: 'back', href: opts.back || '#/home', 'aria-label': 'Back' }, '‹'),
      SE.h('div', null,
        SE.h('div', { class: 'title' }, opts.title),
        opts.sub ? SE.h('div', { class: 'sub' }, opts.sub) : null
      ),
      SE.h('div', { class: 'spacer' }),
      opts.right || null
    );
  };

  SE.fmtClock = function (secs) {
    var m = Math.floor(secs / 60), s = Math.floor(secs % 60);
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  };

  SE.liveMatches = function () {
    var s = SE.store.get();
    return Object.keys(s.matches).map(function (k) { return s.matches[k]; })
      .filter(function (m) { return m.status === 'live'; })
      .sort(function (a, b) { return b.startedAt - a.startedAt; });
  };
  SE.doneMatches = function () {
    var s = SE.store.get();
    return Object.keys(s.matches).map(function (k) { return s.matches[k]; })
      .filter(function (m) { return m.status === 'done'; })
      .sort(function (a, b) { return b.endedAt - a.endedAt; });
  };
})();
