#!/usr/bin/env node
/* Quét folder midi/ rồi ghi midi/index.json cho trang thư viện đọc.
   Chạy: node tools/build-midi-index.js

   MỖI bài BẮT BUỘC có trong midi/meta.json:
   - `difficulty` (1–1000) — thư viện sắp xếp theo đúng con số này để chơi từ dễ tới khó.
     Cách chấm: `node tools/analyze-midi.js midi/bai.mid` lấy số liệu rồi đối chiếu
     bảng rubric trong CLAUDE.md.
   - `rights` — "pd" (bản nhạc gốc thuộc phạm vi công cộng) hoặc "cop" (còn bản quyền).
     Trang /giay-phep/ in bảng này ra, nên thiếu là trang ghi công nói dối.
   Thiếu bất kỳ cái nào là script fail, CI đỏ, không deploy. */
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

/* Trạng thái của BẢN NHẠC GỐC, không phải của bản soạn MIDI — bản soạn có thể có
   bản quyền riêng kể cả khi bản nhạc đã hết hạn. Xem mục "Giấy phép" trong CLAUDE.md. */
const RIGHTS = ['pd', 'cop'];

let meta = {};
if (fs.existsSync(META)) {
  try { meta = JSON.parse(fs.readFileSync(META, 'utf8')); }
  catch (e) { console.error('midi/meta.json hỏng: ' + e.message); process.exit(1); }
}

const files = fs.readdirSync(DIR).filter(f => /\.midi?$/i.test(f)).sort();

const noDiff = [], noRights = [];
const songs = files.map(f => {
  const m = meta[f] || {};
  const d = m.difficulty;
  if (!Number.isInteger(d) || d < 1 || d > 1000) noDiff.push(f);
  if (!RIGHTS.includes(m.rights)) noRights.push(f);
  return {
    file: f,
    title: m.title || titleFromFile(f),
    composer: m.composer || '',
    note: m.note || '',
    difficulty: d,
    rights: m.rights,
    rightsNote: m.rightsNote || '',
    bytes: fs.statSync(path.join(DIR, f)).size
  };
}).sort((a, b) => (a.difficulty - b.difficulty) || a.title.localeCompare(b.title, 'vi'));

if (noDiff.length) {
  console.error('Thiếu difficulty (số nguyên 1–1000) trong midi/meta.json cho: ' + noDiff.join(', '));
  console.error('Chấm bằng: node tools/analyze-midi.js midi/<file> rồi theo rubric trong CLAUDE.md.');
}
if (noRights.length) {
  console.error('Thiếu rights ("pd" hoặc "cop") trong midi/meta.json cho: ' + noRights.join(', '));
  console.error('pd = bản nhạc gốc thuộc phạm vi công cộng, cop = còn bản quyền.');
  console.error('Trang /giay-phep/ in bảng này ra — đừng đoán bừa, tra năm mất của tác giả.');
}
if (noDiff.length || noRights.length) process.exit(1);

const unknown = Object.keys(meta).filter(k => !files.includes(k));
if (unknown.length) console.warn('meta.json khai file không tồn tại: ' + unknown.join(', '));

fs.writeFileSync(OUT, JSON.stringify({ count: songs.length, songs }, null, 2) + '\n');
console.log('midi/index.json: ' + songs.length + ' bài' +
  (songs.length ? ' — ' + songs.map(s => s.title + ' (' + s.difficulty + ')').join(', ') : ''));
