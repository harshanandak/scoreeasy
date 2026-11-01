// Paste into preview_evaluate: min text contrast on the page, compositing translucent backgrounds.
(() => {
  const c = document.createElement('canvas'); c.width = c.height = 1;
  const x = c.getContext('2d', { willReadFrequently: true });
  const rgba = (s) => { x.clearRect(0, 0, 1, 1); x.fillStyle = 'rgba(0,0,0,0)'; x.fillStyle = s; x.fillRect(0, 0, 1, 1); const d = x.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const over = (top, bot) => { const a = top[3]; return [0, 1, 2].map((i) => top[i] * a + bot[i] * (1 - a)).concat(1); };
  const bgOf = (el) => { const stack = []; for (let n = el; n; n = n.parentElement) { const b = rgba(getComputedStyle(n).backgroundColor); if (b[3] > 0) { stack.push(b); if (b[3] >= 1) break; } } let out = [255, 255, 255, 1]; for (let i = stack.length - 1; i >= 0; i--) out = over(stack[i], out); return out; };
  const lum = (p) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(p[0]) + 0.7152 * f(p[1]) + 0.0722 * f(p[2]); };
  const ratio = (a, b) => { const [h, l] = [lum(a), lum(b)].sort((m, n) => n - m); return (h + 0.05) / (l + 0.05); };
  const rows = [];
  for (const el of document.querySelectorAll('body *')) {
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own || !el.offsetWidth || el.closest('.sr-only')) continue;
    const cs = getComputedStyle(el);
    const bg = bgOf(el);
    const fg = over(rgba(cs.color), bg);
    rows.push({ t: el.textContent.trim().slice(0, 28), r: Math.round(ratio(fg, bg) * 100) / 100, px: parseFloat(cs.fontSize), w: cs.fontWeight });
  }
  rows.sort((a, b) => a.r - b.r);
  return { dark: document.documentElement.classList.contains('dark'), n: rows.length, min: rows[0], under45: rows.filter((r) => r.r < 4.5) };
})()
