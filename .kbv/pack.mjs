// Pack the harness bundle (JS + CSS + inlined fonts) into an RGB PNG with STORED deflate, so the
// preview page can read it back synchronously from the data URL html_preview inlines.
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync, crc32 } from 'node:zlib';
const js = readFileSync('.kbv/dist/kbv.iife.js', 'utf8');
const fonts = readFileSync('.kbv/fonts-inline.css', 'utf8');
const app = readFileSync('.kbv/dist/kbv.css', 'utf8').replace(/@import url\([^)]*fonts\.googleapis[^)]*\);?/g, '');
const payload = Buffer.from(JSON.stringify({ js, fonts, css: app }));
const len = Buffer.alloc(4); len.writeUInt32BE(payload.length);
const data = Buffer.concat([len, payload]);
const W = 1024; const H = Math.ceil(data.length / 3 / W);
const raw = Buffer.alloc(H * (W * 3 + 1));
for (let y = 0; y < H; y++) data.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, Math.min(data.length, (y + 1) * W * 3));
const chunk = (type, body) => {
  const l = Buffer.alloc(4); l.writeUInt32BE(body.length);
  const t = Buffer.from(type); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(Buffer.concat([t, body])) >>> 0);
  return Buffer.concat([l, t, body, c]);
};
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
writeFileSync('.kbv/carrier.png', Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 0 })), chunk('IEND', Buffer.alloc(0))]));
console.log('carrier', W, H, payload.length);
