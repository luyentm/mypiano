#!/usr/bin/env node
/* Quét folder midi/ rồi ghi midi/index.json cho trang thư viện đọc.
   Chạy: node tools/build-midi-index.js
   CI chạy lệnh này trước khi deploy, nên chỉ cần `git add midi/bai-moi.mid` là xong;
   chạy tay khi muốn test ở máy (python3 -m http.server). */
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
const songs = files.map(f => {
  const m = meta[f] || {};
  return {
    file: f,
    title: m.title || titleFromFile(f),
    composer: m.composer || '',
    note: m.note || '',
    bytes: fs.statSync(path.join(DIR, f)).size
  };
}).sort((a, b) => a.title.localeCompare(b.title, 'vi'));

const unknown = Object.keys(meta).filter(k => !files.includes(k));
if (unknown.length) console.warn('meta.json khai file không tồn tại: ' + unknown.join(', '));

fs.writeFileSync(OUT, JSON.stringify({ count: songs.length, songs }, null, 2) + '\n');
console.log('midi/index.json: ' + songs.length + ' bài' + (songs.length ? ' — ' + songs.map(s => s.title).join(', ') : ''));
