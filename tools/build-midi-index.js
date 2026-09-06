#!/usr/bin/env node
/* Quét folder midi/ rồi ghi midi/index.json cho trang thư viện đọc.
   Chạy: node tools/build-midi-index.js

   MỖI bài BẮT BUỘC có `difficulty` (1–1000) trong midi/meta.json — thiếu là script
   fail, CI đỏ, không deploy. Thư viện sắp xếp theo đúng con số này để chơi từ dễ tới khó.
   Cách chấm: `node tools/analyze-midi.js midi/bai.mid` lấy số liệu rồi đối chiếu
   bảng rubric trong CLAUDE.md. */
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'midi');
const META = path.join(DIR, 'meta.json');
const OUT = path.join(DIR, 'index.json');

/* "fur-elise.mid" -> "Fur Elise" — dùng khi meta.json không khai title */
const titleFromFile = f => f.replace(/\.midi?$/i, '')
  .replace(/[-_]+/g, ' ').trim()
  .replace(/\s+/g, ' ')
  .replace(/(^|\s)\S/g, c => c.toUpperCase());

let meta = {};
if (fs.existsSync(META)) {
  try { meta = JSON.parse(fs.readFileSync(META, 'utf8')); }
  catch (e) { console.error('midi/meta.json hỏng: ' + e.message); process.exit(1); }
}

const files = fs.readdirSync(DIR).filter(f => /\.midi?$/i.test(f)).sort();

const missing = [];
const songs = files.map(f => {
  const m = meta[f] || {};
  const d = m.difficulty;
  if (!Number.isInteger(d) || d < 1 || d > 1000) missing.push(f);
  return {
    file: f,
    title: m.title || titleFromFile(f),
    composer: m.composer || '',
    note: m.note || '',
    difficulty: d,
    bytes: fs.statSync(path.join(DIR, f)).size
  };
}).sort((a, b) => (a.difficulty - b.difficulty) || a.title.localeCompare(b.title, 'vi'));

if (missing.length) {
  console.error('Thiếu difficulty (số nguyên 1–1000) trong midi/meta.json cho: ' + missing.join(', '));
  console.error('Chấm bằng: node tools/analyze-midi.js midi/<file> rồi theo rubric trong CLAUDE.md.');
  process.exit(1);
}

const unknown = Object.keys(meta).filter(k => !files.includes(k));
if (unknown.length) console.warn('meta.json khai file không tồn tại: ' + unknown.join(', '));

fs.writeFileSync(OUT, JSON.stringify({ count: songs.length, songs }, null, 2) + '\n');
console.log('midi/index.json: ' + songs.length + ' bài' +
  (songs.length ? ' — ' + songs.map(s => s.title + ' (' + s.difficulty + ')').join(', ') : ''));
