/* SE.icons / SE.icon — the funky monoline SVG set lifted from scoreeasy.app.
   Free-flowing hand-drawn sport marks + dock glyphs. Gives the app its character
   back (vs flat emoji). SE.icon(name, size) returns an inline-SVG span. */
(function () {
  'use strict';
  var h = SE.h;

  // sport marks — viewBox 0 0 32 32, stroke currentColor
  var SPORTS = {
    cricket: '<path d="M6 28l3.5-5"/><path d="M9.5 23l4-6.5c0.8-1.3 2.5-1.5 3.5-0.5l1.5 1.5c0.8 0.8 0.5 2.2-0.5 3l-6.5 4z"/><line x1="22" y1="8" x2="22" y2="22"/><line x1="25" y1="8" x2="25" y2="22"/><line x1="28" y1="8" x2="28" y2="22"/><path d="M21.5 8.5c0.8-1 1.8-1 2.8 0"/><path d="M24.5 8.5c0.8-1 1.8-1 2.8 0"/>',
    football: '<circle cx="16" cy="16" r="13.5"/><path d="M16 8.5l4.5 3.2-1.8 5.3h-5.5l-1.8-5.3z"/><path d="M16 8.5l0-6"/><path d="M20.5 11.7l5-2.5"/><path d="M18.7 17l3.5 4.5"/><path d="M13.2 17l-3.5 4.5"/><path d="M11.5 11.7l-5-2.5"/>',
    basketball: '<circle cx="16" cy="16" r="13.5"/><path d="M2.5 16h27"/><path d="M16 2.5v27"/><path d="M5 5.5c3.5 4 5.5 7 5.8 10.5"/><path d="M5.2 26c3.2-3.8 5.2-6.8 5.6-10"/><path d="M27 5.5c-3.5 4-5.5 7-5.8 10.5"/><path d="M26.8 26c-3.2-3.8-5.2-6.8-5.6-10"/>',
    volleyball: '<circle cx="16" cy="16" r="13.5"/><path d="M16 2.5c0 0-1.2 6.8 3.5 12.5s11.2 5.8 11.2 5.8"/><path d="M4.2 8.5c0 0 6.2 2.2 12.8 0s9-7.2 9-7.2"/><path d="M4 22c0 0 5.5-4.5 4.8-12S3.5 3 3.5 3"/><path d="M16 29.5c0 0 1-7-3.8-12.5S1.5 11.5 1.5 11.5"/><path d="M28 22.5c0 0-6 2-12.5-.5s-8.8-7.5-8.8-7.5"/><path d="M28.5 9c0 0-5.8 4.2-5 12s5 8.5 5 8.5"/>',
    kabaddi: '<circle cx="12" cy="7" r="3"/><path d="M12 10l-2.5 7 4.5 4"/><path d="M10.5 14h7"/><path d="M17.5 14l3-3"/><path d="M14 21l-1.5 6"/><path d="M14 21l5 4"/><path d="M22 7h5"/><path d="M24.5 4.5v5"/><path d="M23 20c2 0 3.5-1 4-3"/>',
    badminton: '<ellipse cx="16" cy="24" rx="3.5" ry="2.5"/><path d="M12.5 24c-2-4-3.5-10-2-16"/><path d="M19.5 24c2-4 3.5-10 2-16"/><path d="M10.5 8c1.5-1 3.2-1.5 5.5-1.5s4 0.5 5.5 1.5"/><path d="M13 21c-0.5-3.5-0.5-8 1-13"/><path d="M19 21c0.5-3.5 0.5-8-1-13"/><path d="M16 22v-15"/>',
    tennis: '<ellipse cx="18" cy="11" rx="7.5" ry="9" transform="rotate(-20 18 11)"/><line x1="14" y1="6" x2="14.5" y2="17"/><line x1="18" y1="4" x2="18.5" y2="18.5"/><line x1="22" y1="5" x2="22" y2="16"/><line x1="11.5" y1="9" x2="24" y2="7.5"/><line x1="11" y1="13" x2="24.5" y2="11.5"/><path d="M12 18.5l-4.5 7"/><circle cx="6" cy="6.5" r="2.8"/><path d="M4 4.5c1.2 1 2.5 2.8 2.5 4.2"/>',
    hockey: '<path d="M8 3l10 18"/><path d="M18 21c1 1.8 3 2.8 6 2.8"/><path d="M9.5 3.5l10 18"/><path d="M19.5 21.5c1 1.5 2.8 2.2 5.5 2.2"/><path d="M24 23.8v1.2"/><ellipse cx="14" cy="27.5" rx="4.5" ry="1.8"/>',
  };

  // dock / ui glyphs — viewBox 0 0 24 24
  var UI = {
    home: '<path d="M4 10.5 12 4l8 6.5"/><path d="M6.5 10v9h11v-9"/><path d="M10 19v-5h4v5"/>',
    play: '<path d="M8 5l11 7-11 7z" fill="currentColor" stroke="none"/>',
    history: '<path d="M3.5 12a8.5 8.5 0 1 0 2.8-6.3"/><path d="M3.2 3.5v3.6h3.6"/><path d="M12 7.5v5l3.2 1.9"/>',
    more: '<circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none"/>',
    trophy: '<path d="M8 4h8v4a4 4 0 0 1-8 0z"/><path d="M8 6H5v1a3 3 0 0 0 3 3"/><path d="M16 6h3v1a3 3 0 0 1-3 3"/><path d="M12 12v4"/><path d="M9 20h6"/><path d="M10 16h4l1 4h-6z"/>',
  };

  // logo mark — a bold monoline "score dial": ball outline + rising tick, viewBox 0 0 32 32
  var LOGO = '<circle cx="16" cy="16" r="13"/><path d="M9 19l4-4 3 2 6-7"/><path d="M22 8h-3M22 8v3"/>';

  function svg(inner, vb, size, sw, stroke) {
    return h('span', { class: 'svgic', style: 'display:inline-flex;line-height:0;color:inherit',
      html: '<svg width="' + size + '" height="' + size + '" viewBox="' + vb + '" fill="none" stroke="' + (stroke || 'currentColor') + '" stroke-width="' + sw + '" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>' });
  }

  SE.icon = function (name, size, stroke) {
    size = size || 26;
    if (SPORTS[name]) return svg(SPORTS[name], '0 0 32 32', size, 1.6, stroke);
    if (UI[name]) return svg(UI[name], '0 0 24 24', size, 1.8, stroke);
    return h('span', null, '');
  };
  SE.logoMark = function (size) { return svg(LOGO, '0 0 32 32', size || 26, 2, 'currentColor'); };
  SE.hasIcon = function (name) { return !!SPORTS[name]; };
})();
