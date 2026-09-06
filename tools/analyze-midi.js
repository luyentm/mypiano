#!/usr/bin/env node
/* Đo các chỉ số của một file MIDI để chấm độ khó (thang 1–1000).
   Chạy: node tools/analyze-midi.js midi/ten-bai.mid
   Script chỉ đưa SỐ LIỆU; con số difficulty cuối cùng do người (hoặc Claude)
   chấm theo bảng rubric trong CLAUDE.md rồi ghi vào midi/meta.json. */
const fs = require('fs');
const path = require('path');

/* dùng đúng parser + khâu chuẩn hoá của app, không viết lại lần hai */
const SRC = fs.readFileSync(path.join(__dirname, '..', 'play/index.html'), 'utf8');
const grab = (from, to) => SRC.slice(SRC.indexOf(from), SRC.indexOf(to, SRC.indexOf(from)));
eval(grab('function parseMidi', '/* ======'));
eval(grab('function normalize(data)', 'function load(data, name)'));

const file = process.argv[2];
if (!file) { console.error('cách dùng: node tools/analyze-midi.js <file.mid>'); process.exit(1); }
const buf = fs.readFileSync(file);
const data = parseMidi(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));

const clean = normalize(data);
const notes = clean.notes.slice().sort((a, b) => a.start - b.start);

const dur = notes.reduce((m, n) => Math.max(m, n.end), 0);
const pitches = notes.map(n => n.midi);
const lo = Math.min(...pitches), hi = Math.max(...pitches);
const black = notes.filter(n => [1,3,6,8,10].includes(n.midi % 12)).length;

/* mật độ nốt: cửa sổ trượt 1 giây */
const starts = notes.map(n => n.start).sort((a, b) => a - b);
const dens = [];
for (let t = 0; t + 1 <= dur; t += 0.25) {
  let c = 0;
  for (const s of starts) { if (s >= t && s < t + 1) c++; else if (s >= t + 1) break; }
  dens.push(c);
}
dens.sort((a, b) => a - b);
const pct = p => dens.length ? dens[Math.min(dens.length - 1, Math.floor(dens.length * p))] : 0;

/* đa âm tối đa (số nốt cùng vang) */
const ev = [];
for (const n of notes) { ev.push([n.start, 1], [n.end, -1]); }
ev.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
let cur = 0, maxPoly = 0;
for (const [, d] of ev) { cur += d; if (cur > maxPoly) maxPoly = cur; }

/* khoảng cách onset nhỏ nhất kéo dài (đo tốc độ chạy ngón) */
const gaps = [];
for (let i = 1; i < starts.length; i++) { const g = starts[i] - starts[i-1]; if (g > 0.012) gaps.push(g); }
gaps.sort((a, b) => a - b);
const g5 = gaps.length ? gaps[Math.floor(gaps.length * 0.05)] : 0;

const names = data.trackNames || [];
const rh = notes.filter(n => n.hand === 0), lh = notes.filter(n => n.hand === 1);

/* quãng rộng nhất phải bấm cùng lúc trong một tay */
const spread = arr => {
  let mx = 0;
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length && arr[j].start < arr[i].end - 0.02; j++)
      if (arr[j].start <= arr[i].start + 0.02) mx = Math.max(mx, Math.abs(arr[j].midi - arr[i].midi));
  }
  return mx;
};

const out = {
  file: path.basename(file),
  'thời lượng': dur.toFixed(1) + 's',
  'số nốt': notes.length + (clean.dropped ? ' (bỏ ' + clean.dropped + ' nốt nhân bản)' : ''),
  'track': names.length ? names.map((n, i) => i + ':' + (n || '—')).join(' ') : '(không tên)',
  'quãng': lo + '–' + hi + ' (' + (hi - lo) + ' nửa cung, ' + ((hi - lo) / 12).toFixed(1) + ' quãng tám)',
  'phím đen': (black / notes.length * 100).toFixed(0) + '%',
  'nốt/giây trung bình': (notes.length / dur).toFixed(1),
  'nốt/giây (p50 / p90 / max)': pct(0.5) + ' / ' + pct(0.9) + ' / ' + (dens[dens.length-1] || 0),
  'onset nhanh nhất (p5)': (g5 * 1000).toFixed(0) + 'ms  ≈ ' + (g5 ? (60 / g5 / 4).toFixed(0) : '—') + ' bpm nốt móc kép',
  'đa âm tối đa': maxPoly,
  'tay phải / tay trái': rh.length + ' / ' + lh.length,
  'quãng rộng nhất cùng lúc (RH / LH)': spread(rh) + ' / ' + spread(lh) + ' nửa cung',
  'ô nhịp': data.grid.filter(g => g.bar).length
};
for (const [k, v] of Object.entries(out)) console.log(k.padEnd(36) + ': ' + v);
