#!/usr/bin/env node
/* Sinh trang tĩnh cho TỪNG BÀI + sitemap.xml + robots.txt.
   Chạy SAU build-midi-index.js (đọc midi/index.json):

     node tools/build-midi-index.js && node tools/build-pages.js

   Vì sao cần: `/play/?song=fur-elise.mid` chỉ là query param trên đúng một trang,
   nên Google gộp cả thư viện thành 1 kết quả. Mà traffic của loại site này gần như
   toàn bộ là long-tail theo TÊN BÀI ("river flows in you piano nốt"). Mỗi bài phải
   có URL riêng, <title> riêng, mô tả riêng thì mới có cửa.

   Trang sinh ra là HTML tĩnh hoàn toàn (chỉ có 4 dòng JS chặn counter khi chạy
   localhost). Không fetch gì, nên mở bằng file:// cũng xem được.

   File trong bai/ có commit vào repo cho tiện dev — giống midi/index.json — nhưng
   bản trên site luôn là bản CI sinh lại. ĐỪNG SỬA TAY, chạy lại script là mất. */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const IDX = path.join(ROOT, 'midi', 'index.json');
const OUTDIR = path.join(ROOT, 'bai');
const BASE = 'https://luyentm.github.io/mypiano/';

if (!fs.existsSync(IDX)) {
  console.error('Chưa có midi/index.json — chạy `node tools/build-midi-index.js` trước.');
  process.exit(1);
}
const songs = (JSON.parse(fs.readFileSync(IDX, 'utf8')).songs || []);
if (!songs.length) { console.error('midi/index.json không có bài nào.'); process.exit(1); }

const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/* "fur-elise.mid" -> "fur-elise". Chỉ giữ [a-z0-9-] để URL không bao giờ phải encode. */
const slugOf = f => f.replace(/\.midi?$/i, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const kb = n => n < 1024 ? n + ' B' : (n / 1024).toFixed(1) + ' KB';

/* Giữ y hệt bảng trong library/index.html — hai chỗ lệch nhau là người đọc thấy ngay. */
const BANDS = [
  [150, 'Rất dễ',  '#6fc38a'],
  [300, 'Dễ',      '#8ec36f'],
  [450, 'Vừa',     '#edb04a'],
  [600, 'Khá khó', '#e08e4a'],
  [750, 'Khó',     '#e0704a'],
  [1001, 'Rất khó', '#d95a6a']
];
const band = d => BANDS.find(b => d < b[0]) || BANDS[BANDS.length - 1];

/* Lời khuyên theo mức độ. Mỗi bài một đoạn khác nhau là để trang không thành
   20 bản sao của cùng một khuôn — Google gọi đó là thin content và bỏ qua. */
const ADVICE = {
  'Rất dễ': 'Bài này hợp để tập ngay cả khi bạn chưa đọc được nốt: bật gợi ý phím rồi nhìn phím sáng mà bấm. Cứ tập tay phải cho thuộc giai điệu trước, xong mới ghép tay trái.',
  'Dễ': 'Tay trái ở mức này thường chỉ giữ hợp âm hoặc nốt dài, nên cách nhanh nhất là tập riêng tay phải tới khi không phải nhìn màn hình nữa, rồi mới bật lại tay trái.',
  'Vừa': 'Đừng chạy hết bài từ đầu. Kéo hai tay cầm trên thanh tua để khoanh lấy một câu 4–8 ô nhịp, cày ở tốc độ 60–70% cho tới khi trơn rồi mới nới tốc độ lên.',
  'Khá khó': 'Ở mức này chỗ vấp thường nằm ở vài ô nhịp cố định chứ không rải đều cả bài. Tìm đúng chỗ đó, khoanh đoạn lặp, hạ tốc độ xuống 50% và tập từng tay một.',
  'Khó': 'Bài dài và dày, nên chia thành từng đoạn mà tập chứ đừng đánh liền mạch. Bật số ngón để giữ thế tay cố định — sai thế tay ở tốc độ chậm thì lên tốc độ là tắc.',
  'Rất khó': 'Bài này cần nền tảng kỹ thuật sẵn. Dùng màn nốt rơi để nhớ mặt bài và soát lại chỗ quên, còn phần khó thật thì vẫn phải tập chậm từng tay trên đàn.'
};

const pageFor = (s, i) => {
  const slug = slugOf(s.file);
  const [, label, color] = band(s.difficulty);
  const url = BASE + 'bai/' + slug + '/';
  const prev = songs[i - 1], next = songs[i + 1];

  const who = s.composer ? ' của ' + s.composer : '';
  const title = s.title + (s.composer ? ' — ' + s.composer : '') + ' | Nốt rơi piano - mypiano';
  let desc = 'Tập ' + s.title + who + ' bằng nốt rơi, chạy thẳng trong trình duyệt. '
    + 'Độ khó ' + label.toLowerCase() + ' (' + s.difficulty + '/1000). '
    + (s.note || '');
  desc = desc.trim();
  if (desc.length > 158) desc = desc.slice(0, 157).replace(/[\s,;.–—-]+\S*$/, '') + '…';

  const near = songs.filter((o, j) => j !== i).slice(Math.max(0, i - 3), Math.max(0, i - 3) + 6);

  const link = o => '<a href="../' + slugOf(o.file) + '/">' + esc(o.title) + '</a>';

  return `<!DOCTYPE html>
<!--
  mypiano — piano falling notes
  Required Notice: Copyright © 2026 luyentm (https://github.com/luyentm/mypiano)
  PolyForm Noncommercial License 1.0.0 — phi thương mại. Sao chép/sửa đổi thì giữ
  nguyên dòng Required Notice ở trên. Xem LICENSE.

  TRANG NÀY SINH TỰ ĐỘNG bằng tools/build-pages.js — sửa tay là mất.
  Nguồn: midi/meta.json (qua midi/index.json).
-->
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="mypiano">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url)}">
<style>
  :root{
    --bg:#0d1017; --card:#131822; --line:#232a38;
    --text:#d3dae6; --dim:#78849a; --rh:#edb04a; --lh:#57a8d4;
  }
  *{box-sizing:border-box}
  body{margin:0; background:var(--bg); color:var(--text); min-height:100vh;
    font:400 15px/1.65 system-ui,-apple-system,Segoe UI,Roboto,sans-serif; -webkit-text-size-adjust:100%}
  .wrap{max-width:760px; margin:0 auto; padding:0 20px}
  a{color:var(--lh)}

  nav{position:sticky; top:0; z-index:9; background:rgba(13,16,23,.86);
    backdrop-filter:blur(8px); border-bottom:1px solid var(--line)}
  nav .wrap{display:flex; align-items:center; gap:16px; height:56px; max-width:960px}
  nav .brand{font-weight:600; font-size:15px; color:var(--text); text-decoration:none;
    display:flex; align-items:center; gap:8px}
  nav .brand i{color:var(--rh); font-style:normal; font-size:18px}
  nav a{color:var(--dim); text-decoration:none; font-size:14px}
  nav a:hover{color:var(--text)}
  nav .spacer{margin-left:auto}

  .crumb{font-size:13px; color:var(--dim); margin:22px 0 0}
  .crumb a{color:var(--dim); text-decoration:none}
  .crumb a:hover{color:var(--text)}

  h1{font-size:27px; line-height:1.25; margin:10px 0 6px; letter-spacing:-.4px}
  .by{color:var(--lh); font-size:15px; margin:0 0 16px}

  .lv{display:flex; align-items:center; gap:10px; margin:0 0 22px; max-width:420px}
  .lv .bar{flex:1; height:5px; border-radius:3px; background:#232a38; overflow:hidden}
  .lv .bar i{display:block; height:100%; border-radius:3px}
  .lv .lvl{font-size:13px; font-weight:600; white-space:nowrap}
  .lv .num{font-size:12.5px; color:var(--dim); font-variant-numeric:tabular-nums; white-space:nowrap}

  .cta{display:inline-flex; align-items:center; gap:9px; background:var(--rh); color:#1a1200;
    font-weight:700; font-size:16px; text-decoration:none; border-radius:11px;
    padding:14px 26px; margin-bottom:10px}
  .cta:hover{background:#f6bd5d}
  .sub{font-size:13px; color:var(--dim); margin:0 0 26px}

  h2{font-size:17px; margin:30px 0 9px; letter-spacing:-.2px}
  p{margin:0 0 13px}
  .note{background:var(--card); border:1px solid var(--line); border-left:3px solid var(--lh);
    border-radius:9px; padding:13px 15px; color:var(--text); font-size:14.5px; margin:0 0 13px}
  ul{margin:0 0 13px; padding-left:20px}
  li{margin-bottom:5px}
  .facts{list-style:none; padding:0; font-size:13.5px; color:var(--dim)}
  .facts b{color:var(--text); font-weight:600}
  .near{display:flex; flex-wrap:wrap; gap:8px; padding:0; list-style:none; margin:0 0 13px}
  .near li{margin:0}
  .near a{display:inline-block; background:var(--card); border:1px solid var(--line);
    border-radius:8px; padding:7px 12px; font-size:13.5px; text-decoration:none; color:var(--text)}
  .near a:hover{border-color:#313c52; color:var(--rh)}

  footer{border-top:1px solid var(--line); margin-top:36px; padding:20px 0 40px;
    color:var(--dim); font-size:12.5px}
  footer a{color:var(--dim)}
  footer .wrap{display:flex; flex-wrap:wrap; gap:14px; align-items:center}
  .hit{position:absolute; left:-9999px; width:1px; height:1px; opacity:0; pointer-events:none}
</style>
</head>
<body>

<nav>
  <div class="wrap">
    <a class="brand" href="../../"><i>♪</i> mypiano</a>
    <span class="spacer"></span>
    <a href="../../library/">Thư viện</a>
    <a href="../../play/">Chơi</a>
  </div>
</nav>

<div class="wrap">
  <p class="crumb"><a href="../../">mypiano</a> › <a href="../../library/">Thư viện</a> › ${esc(s.title)}</p>
  <h1>${esc(s.title)}</h1>
  ${s.composer ? '<p class="by">' + esc(s.composer) + '</p>' : ''}

  <div class="lv">
    <span class="lvl" style="color:${color}">${label}</span>
    <span class="bar"><i style="width:${s.difficulty / 10}%;background:${color}"></i></span>
    <span class="num">${s.difficulty}/1000</span>
  </div>

  <a class="cta" href="../../play/?song=${encodeURIComponent(s.file)}">▶ Tập bài này</a>
  <p class="sub">Mở thẳng trong trình duyệt — không cài đặt, không tài khoản, không mất phí.</p>

  <h2>Về bản MIDI này</h2>
  ${s.note ? '<p class="note">' + esc(s.note) + '</p>' : ''}
  <p>Trong thư viện ${songs.length} bài xếp từ dễ tới khó, đây là bài dễ thứ <b>${i + 1}</b>.
     ${ADVICE[label]}</p>

  <h2>Tập thế nào</h2>
  <p>Nốt rơi từ trên xuống và chạm bàn phím 88 phím đúng lúc nốt kêu, nên bạn chỉ cần
     nhìn phím nào sáng thì bấm phím đó. Vài thứ hay dùng khi tập ${esc(s.title)}:</p>
  <ul>
    <li><b>Chậm lại</b> — kéo tốc độ xuống 50–70%, nốt rơi chậm theo, tiếng vẫn đúng cao độ.</li>
    <li><b>Tập từng tay</b> — tắt tiếng một tay mà nốt vẫn rơi, để tự đánh tay đó.</li>
    <li><b>Đoạn lặp</b> — kéo hai tay cầm trên thanh tua để cày đi cày lại đúng một câu.</li>
    <li><b>Chưa biết nốt cũng tập được</b> — phím ghi Đô Rê Mi, hoặc đổi sang số phím 1–88 / số bậc 1–7.</li>
    <li><b>Số ngón 1–5</b> in trên nốt ở những chỗ chắc chắn, cùng đếm vào và gõ nhịp trước khi vào bài.</li>
  </ul>

  <h2>Thông tin file</h2>
  <ul class="facts">
    <li>File MIDI: <b>${esc(s.file)}</b> · ${kb(s.bytes || 0)}</li>
    <li>Độ khó: <b>${s.difficulty}/1000</b> (${label})</li>
    ${s.composer ? '<li>Tác giả: <b>' + esc(s.composer) + '</b></li>' : ''}
  </ul>

  <h2>Bài khác trong thư viện</h2>
  <ul class="near">
${near.map(o => '    <li>' + link(o) + '</li>').join('\n')}
  </ul>
  <p>${prev ? 'Dễ hơn một bậc: ' + link(prev) + '. ' : ''}${next ? 'Khó hơn một bậc: ' + link(next) + '. ' : ''}<a href="../../library/">Xem cả ${songs.length} bài →</a></p>
</div>

<footer>
  <div class="wrap">
    <span>mypiano — falling notes cho người tập piano</span>
    <a href="https://github.com/luyentm/mypiano/blob/main/LICENSE">© 2026 luyentm · PolyForm NC 1.0.0</a>
    <a href="https://github.com/luyentm/mypiano">Mã nguồn</a>
  </div>
</footer>

<img class="hit" data-hit="https://hits.sh/luyentm.github.io/mypiano.svg" alt="" aria-hidden="true">
<script>
/* hits.sh cộng 1 mỗi lần ảnh .svg được tải, mà URL badge hardcode tên miền thật —
   mở localhost lúc dev cũng bị tính. Chỉ gắn src khi đang chạy trên site thật. */
for (const el of document.querySelectorAll('img[data-hit]')){
  if (location.hostname === 'luyentm.github.io') el.src = el.dataset.hit;
  else (el.closest('a') || el).remove();
}
</script>
</body>
</html>
`;
};

/* --- ghi trang từng bài, dọn thư mục của bài đã bị gỡ khỏi midi/ --- */
fs.mkdirSync(OUTDIR, { recursive: true });
const want = new Set(songs.map(s => slugOf(s.file)));

const dup = songs.map(s => slugOf(s.file)).filter((v, i, a) => a.indexOf(v) !== i);
if (dup.length) { console.error('Hai file MIDI ra cùng một slug: ' + dup.join(', ')); process.exit(1); }

for (const d of fs.readdirSync(OUTDIR, { withFileTypes: true })) {
  if (d.isDirectory() && !want.has(d.name)) {
    fs.rmSync(path.join(OUTDIR, d.name), { recursive: true, force: true });
    console.log('gỡ bai/' + d.name + '/ (bài không còn trong midi/)');
  }
}
songs.forEach((s, i) => {
  const dir = path.join(OUTDIR, slugOf(s.file));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), pageFor(s, i));
});

/* --- sitemap.xml ---
   Cố tình KHÔNG ghi <lastmod>: CI checkout nông nên mọi file đều mang đúng một
   ngày, ghi vào chỉ là số liệu bịa. Thiếu lastmod không sao, Google vẫn crawl. */
const urls = [BASE, BASE + 'play/', BASE + 'library/']
  .concat(songs.map(s => BASE + 'bai/' + slugOf(s.file) + '/'));
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'),
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map(u => '  <url><loc>' + esc(u) + '</loc></url>').join('\n') +
  '\n</urlset>\n');

/* --- robots.txt ---
   LƯU Ý: với GitHub Pages dạng project (luyentm.github.io/mypiano/), file này KHÔNG
   có tác dụng — crawler chỉ đọc luyentm.github.io/robots.txt ở repo gốc của user.
   Vẫn ghi ra vì (a) đúng ngay lập tức nếu sau này gắn tên miền riêng, (b) sitemap
   thì cứ nộp thẳng trong Google Search Console là được. */
fs.writeFileSync(path.join(ROOT, 'robots.txt'),
  'User-agent: *\nAllow: /\n\nSitemap: ' + BASE + 'sitemap.xml\n');

console.log('bai/: ' + songs.length + ' trang · sitemap.xml: ' + urls.length + ' URL · robots.txt');
