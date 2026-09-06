#!/usr/bin/env node
/* Sinh file .mid thật cho thư viện từ mảng DEMOS trong play/index.html.
   Chạy: node tools/make-demo-midi.js
   Mục đích: có sẵn vài bài trong midi/ để thư viện không rỗng, đồng thời
   là bài test end-to-end cho parser (ghi ra rồi đọc lại bằng chính parseMidi). */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'play/index.html'), 'utf8');
const from = src.indexOf('const DEMOS = {');
const to = src.indexOf('\n};', from);
if (from < 0 || to < 0) { console.error('Không tìm thấy DEMOS trong play/index.html'); process.exit(1); }
const DEMOS = eval('(' + src.slice(from + 'const DEMOS = '.length, to + 2) + ')');

const PPQ = 480;
const vlq = n => { const b = [n & 0x7f]; n >>>= 7; while (n > 0) { b.unshift((n & 0x7f) | 0x80); n >>>= 7; } return b; };
const u32 = n => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const chunk = (id, body) => [...Buffer.from(id, 'ascii'), ...u32(body.length), ...body];

/* [tick, [bytes...]] -> track bytes (delta time) */
function track(events) {
  events.sort((a, b) => a[0] - b[0] || a[2] - b[2]);
  let prev = 0, out = [];
  for (const [tick, bytes] of events) { out.push(...vlq(tick - prev), ...bytes); prev = tick; }
  out.push(...vlq(0), 0xff, 0x2f, 0);          /* end of track */
  return chunk('MTrk', out);
}

function build(demo) {
  /* unit = nốt nhỏ nhất của bài; beatUnits unit = 1 phách; den = mẫu số nhịp */
  const den = demo.bpb === 3 ? 8 : 4;                       /* 3/8 hay 4/4 */
  const unitsPerQuarter = demo.beatUnits * (den / 4);       /* bao nhiêu unit trong 1 nốt đen */
  const ticksPerUnit = PPQ / unitsPerQuarter;
  const usPerQuarter = Math.round(demo.unit * unitsPerQuarter * 1e6);

  const meta = [
    [0, [0xff, 0x51, 3, (usPerQuarter >> 16) & 255, (usPerQuarter >> 8) & 255, usPerQuarter & 255], 0],
    [0, [0xff, 0x58, 4, demo.bpb, Math.log2(den), 24, 8], 1]
  ];
  const notes = (arr, vel) => {
    const ev = [];
    for (const [t, d, m] of arr) {
      const on = Math.round((t + demo.lead) * ticksPerUnit);
      const off = Math.round((t + demo.lead + d) * ticksPerUnit);
      ev.push([on, [0x90, m, vel], 1], [off, [0x80, m, 0], 0]);   /* off ưu tiên trước on cùng tick */
    }
    return ev;
  };
  return Buffer.from([
    ...chunk('MThd', [0, 1, 0, 3, (PPQ >> 8) & 255, PPQ & 255]),   /* format 1, 3 track, ppq */
    ...track(meta), ...track(notes(demo.rh, 96)), ...track(notes(demo.lh, 74))
  ]);
}

const OUT = path.join(ROOT, 'midi');
fs.mkdirSync(OUT, { recursive: true });
for (const [key, demo] of Object.entries(DEMOS)) {
  const name = key === 'elise' ? 'fur-elise.mid' : 'canon-in-d.mid';
  const buf = build(demo);
  fs.writeFileSync(path.join(OUT, name), buf);
  console.log(name.padEnd(18), buf.length + ' bytes', '←', demo.label);
}
