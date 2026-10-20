/* SE.ui — Floodlight shared components. Every screen builds from these so the
   whole app reads as one system. Classic script; depends on SE.h from core.js. */
(function () {
  'use strict';
  var h = SE.h;
  var ui = (SE.ui = {});

  // full-bleed dark screen root
  ui.screen = function () {
    var el = h('div', { class: 'fl' });
    for (var i = 0; i < arguments.length; i++) if (arguments[i]) el.appendChild(arguments[i]);
    return el;
  };

  ui.iconBtn = function (glyph, onClick) {
    return h('div', { class: 'fl-ic', onclick: onClick }, glyph);
  };

  // header: { title, sub, onBack, right } — right is an optional node
  ui.header = function (o) {
    return h('div', { class: 'fl-head' },
      o.onBack === null ? h('div', { style: 'width:34px' }) : ui.iconBtn('‹', o.onBack || function () { SE.nav('#/home'); }),
      h('div', { class: 'fl-title' },
        h('b', null, o.title),
        o.sub ? h('span', null, o.sub) : null
      ),
      o.right || h('div', { style: 'width:34px' })
    );
  };

  ui.banner = function (text) {
    return h('div', { class: 'fl-banner' }, text);
  };

  // score half: { team, value, serving, leading, onTap, cue }
  ui.scoreHalf = function (o, side) {
    var cls = 'fl-side ' + (side || '') + (o.serving ? ' serving' : '') + (o.leading === true ? ' lead' : o.leading === false ? ' trail' : '');
    return h('div', { class: cls, onclick: o.onTap },
      o.serving ? h('div', { class: 'fl-dot' }) : null,
      h('div', { class: 'fl-team' }, o.team),
      h('div', { class: 'fl-num' }, String(o.value)),
      o.cue ? h('div', { class: 'fl-cue' }, o.cue) : null
    );
  };

  // board wraps two halves (or arbitrary children)
  ui.board = function () {
    var el = h('div', { class: 'fl-board' });
    for (var i = 0; i < arguments.length; i++) if (arguments[i]) el.appendChild(arguments[i]);
    return el;
  };

  // mono chip row — pass array of {label, value} or raw nodes
  ui.chips = function (items) {
    return h('div', { class: 'fl-chips' },
      items.filter(Boolean).map(function (it, i) {
        if (it.nodeType) return it;
        return h('span', null, it.label + ' ', it.value != null ? h('b', null, String(it.value)) : null);
      })
    );
  };

  // outlined action buttons — array of {label, onTap, on}
  ui.actions = function (items, scroll) {
    return h('div', { class: 'fl-acts' + (scroll ? ' scroll' : '') },
      items.filter(Boolean).map(function (it) {
        return h('div', { class: 'fl-btn' + (it.on ? ' on' : ''), onclick: it.onTap }, it.label);
      })
    );
  };

  // footer: { onUndo, primaryLabel, onPrimary, primaryGhost }
  ui.footer = function (o) {
    return h('div', { class: 'fl-foot' },
      o.onUndo ? h('div', { class: 'fl-undo', onclick: o.onUndo }, '↩') : null,
      o.primaryLabel ? h('div', { class: 'fl-primary' + (o.primaryGhost ? ' ghost' : ''), onclick: o.onPrimary }, o.primaryLabel) : null
    );
  };

  // share/viewer meta line: { left, leftTap, viewers, onShare }
  ui.meta = function (o) {
    return h('div', { class: 'fl-meta' },
      o.left ? h('span', { class: 'lnk', onclick: o.leftTap }, o.left) : h('span', null, ''),
      h('span', { class: 'lnk', onclick: o.onShare },
        (o.viewers != null ? '👁 ' + o.viewers + ' · ' : '') + 'Share live ↗')
    );
  };

  ui.microlabel = function (t) { return h('div', { class: 'fl-microlabel' }, t); };

  ui.liveChip = function (isLive) {
    return isLive
      ? h('span', { class: 'fl-livechip' }, h('span', { class: 'd' }), 'Live')
      : h('span', { class: 'fl-microlabel', style: 'color:var(--fl-ink-dim)' }, 'Final');
  };
})();
