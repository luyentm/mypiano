#!/usr/bin/env node
/* Sinh trang tĩnh cho TỪNG BÀI + trang giấy phép + sitemap.xml + robots.txt.
   Chạy SAU build-midi-index.js (đọc midi/index.json):

     node tools/build-midi-index.js && node tools/build-pages.js

   Vì sao cần trang từng bài: `/play/?song=fur-elise.mid` chỉ là query param trên đúng
   một trang, nên Google gộp cả thư viện thành 1 kết quả. Mà traffic của loại site này
   gần như toàn bộ là long-tail theo TÊN BÀI ("river flows in you piano nốt"). Mỗi bài
   phải có URL riêng, <title> riêng, mô tả riêng thì mới có cửa.

   Vì sao trang giấy phép cũng sinh tự động: bảng bản quyền của 20 file .mid phải khớp
   với thư viện thật. Viết tay thì thêm một bài là bảng nói dối ngay, mà đây là trang
   không được phép sai.

   Trang sinh ra là HTML tĩnh hoàn toàn (chỉ có mấy dòng JS chặn counter khi chạy
   localhost). Không fetch gì, nên mở bằng file:// cũng xem được.

   File trong bai/ và giay-phep/ có commit vào repo cho tiện dev — giống midi/index.json —
   nhưng bản trên site luôn là bản CI sinh lại. ĐỪNG SỬA TAY, chạy lại script là mất. */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const IDX = path.join(ROOT, 'midi', 'index.json');
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

/* "fur-elise.mid" -> "fur-elise". Chỉ giữ [a-z0-9-] để URL không bao giờ phải encode.
   Phải khớp Y HỆT slugOf() trong library/index.html. */
const slugOf = f => f.replace(/\.midi?$/i, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const kb = n => n < 1024 ? n + ' B' : (n / 1024).toFixed(1) + ' KB';

/* Giữ y hệt bảng trong library/index.html — hai chỗ lệch nhau là người đọc thấy ngay. */
const BANDS = [
  [150, 'Rất dễ',  '#7ef0b4', '#093a24'],
  [300, 'Dễ',      '#c8ef7c', '#2c3a06'],
  [450, 'Vừa',     '#ffd97a', '#412c00'],
  [600, 'Khá khó', '#ffb27a', '#4a2200'],
  [750, 'Khó',     '#ff9a91', '#4d1109'],
  [1001,'Rất khó', '#ff92bd', '#4d0a29']
];
const band = d => BANDS.find(b => d < b[0]) || BANDS[BANDS.length - 1];

/* Lời khuyên theo mức độ. Mỗi bài một đoạn khác nhau là để trang không thành
   20 bản sao của cùng một khuôn — Google gọi đó là thin content và bỏ qua. */
const ADVICE = {
  'Rất dễ': 'Bài này hợp để tập ngay cả khi bạn chưa đọc được nốt: bật gợi ý phím rồi nhìn phím sáng mà bấm. Cứ tập tay phải cho thuộc giai điệu trước, xong mới ghép tay trái.',
  'Dễ': 'Tay trái ở mức này thường chỉ giữ hợp âm hoặc nốt dài, nên cách nhanh nhất là tập riêng tay phải tới khi không phải nhìn màn hình nữa, rồi mới bật lại tay trái.',
  'Vừa': 'Đừng chạy hết bài từ đầu. Kéo hai tay cầm trên thanh tua để khoanh lấy một câu 4–8 ô nhịp, cày ở tốc độ 60–70% cho tới khi trơn rồi mới nới tốc độ lên.',
  'Khá khó': 'Ở mức này chỗ vấp thường nằm ở vài ô nhịp cố định chứ không rải đều cả bài. Tìm đúng chỗ đó, khoanh đoạn lặp, hạ tốc độ xuống 50% và tập từng tay một.',
  'Khó': 'Bài dài và dày, nên chia thành từng đoạn mà tập chứ đừng đánh liền mạch. Khoanh ô nhịp giúp mắt chỉ phải quét đúng nhóm phím của ô nhịp đang chơi thay vì cả bàn phím.',
  'Rất khó': 'Bài này cần nền tảng kỹ thuật sẵn. Dùng màn nốt rơi để nhớ mặt bài và soát lại chỗ quên, còn phần khó thật thì vẫn phải tập chậm từng tay trên đàn.'
};

/* Bộ CSS dùng chung cho mọi trang sinh ra. Gom ở đây là để KHÔNG lệch nhau giữa các
   trang; file xuất ra vẫn tự chứa đúng như ràng buộc của dự án. */
const CSS = `  /* ==========================================================================
     GLASSMORPHISM — gradient xanh → tím → hồng sen, mọi mặt phẳng là kính mờ
     viền sáng, CHỮ TRẮNG. Bốn thứ làm nên style này, thiếu cái nào cũng hỏng:
       1) nền gradient BÃO HOÀ, cố định khi cuộn — cái để nhìn xuyên qua;
       2) mặt kính = một lớp trắng rất mỏng (.14) + backdrop-filter blur;
       3) VIỀN SÁNG 1px rõ rệt — đây mới là thứ vẽ ra hình tấm kính, nền mỏng
          như trên gần như không thấy nếu bỏ viền đi;
       4) vệt loé chéo + bóng đổ tối mềm, để kính nổi khỏi nền.

     Vì sao gradient phải TỐI (L ≈ .058–.078) chứ không tươi sáng như nhiều
     mẫu trên mạng: kính là lớp TRẮNG đè lên nền, nên nền càng sáng thì mặt
     kính càng sáng và chữ trắng càng chìm. Đo ở mốc sáng nhất (hồng sen),
     kính .14 + loé .05 cho chữ trắng 5.4:1; nền sáng thêm một nấc là tụt
     xuống dưới 4.5. Muốn đổi màu nền thì chạy lại phép đo trước.
     ========================================================================== */
  :root{
    --g1:#17409c; --g2:#33359f; --g3:#4b2ea6; --g4:#6d2478; --g5:#822369;
    --text:#ffffff;
    --dim:rgba(255,255,255,.88);        /* chữ phụ — gần trắng là CỐ Ý, xem đo bên dưới */
    --rh:#ffb648; --lh:#4fd0f5; --mint:#5ce6a8; --grape:#c89cff;

    --glass:rgba(255,255,255,.14);
    --glass-hi:rgba(255,255,255,.18);   /* hover chỉ nhích nhẹ; sáng hơn là chữ trắng chìm */
    --glass-lo:rgba(255,255,255,.09);
    --line:rgba(255,255,255,.42);       /* viền sáng — chữ ký của style này */
    --line2:rgba(255,255,255,.16);
    --blur:saturate(150%) blur(16px);
    --edge:inset 0 1px 0 rgba(255,255,255,.45);
    --sheen:linear-gradient(135deg, rgba(255,255,255,.20) 0%,
      rgba(255,255,255,.03) 40%, rgba(255,255,255,.09) 100%);
    --sh:var(--edge), 0 10px 30px -12px rgba(6,2,28,.65);
    --sh-hi:var(--edge), 0 18px 40px -14px rgba(6,2,28,.8);
  }
  *{box-sizing:border-box}
  html{background:var(--g3)}
  /* Nền đứng yên khi cuộn: kính trôi qua vùng màu khác nhau, đó mới ra cảm giác
     tấm kính thật. Hai vệt tròn chỉ để nền đỡ phẳng, alpha thấp để không kéo độ
     sáng nền vượt mốc đã đo. */
  body::before{
    content:''; position:fixed; inset:0; z-index:-1; pointer-events:none;
    background:
      radial-gradient(38vmax 32vmax at 14% 10%,  rgba(56,132,255,.30), transparent 68%),
      radial-gradient(34vmax 30vmax at 88% 88%,  rgba(255,86,170,.24), transparent 68%),
      linear-gradient(135deg, var(--g1) 0%, var(--g2) 26%, var(--g3) 50%,
        var(--g4) 78%, var(--g5) 100%);
  }
  body{margin:0; color:var(--text); background:transparent;
    -webkit-text-size-adjust:100%}
  a{color:var(--text)}
  /* Link trong thân bài phải xanh nhạt + gạch chân: trên nền tím chữ đã là trắng,
     không còn màu nào để phân biệt link với chữ thường mà vẫn đủ tương phản.
     Bọc :where() để luật này có độ ưu tiên bằng 0 phần class — mọi link đã có
     kiểu riêng (nav, footer, .crumb, .toc, .near, .btn, .cta, card) tự đè lên nó,
     không phải viết một rừng ngoại lệ. */
  :where(.wrap) p a, :where(.wrap) li a, dd a{color:#9fe6ff; text-decoration:underline;
    text-underline-offset:2px}
  :where(.wrap) p a:hover, :where(.wrap) li a:hover, dd a:hover{color:#fff}

  nav{position:sticky; top:0; z-index:9; background-color:rgba(255,255,255,.10);
    -webkit-backdrop-filter:var(--blur); backdrop-filter:var(--blur);
    border-bottom:1px solid var(--line2);
    box-shadow:var(--edge), 0 12px 34px -26px #000}
  nav .brand{font-weight:800; font-size:16px; color:var(--text); text-decoration:none;
    display:flex; align-items:center; gap:9px; margin-right:10px}
  nav .brand i{width:28px; height:28px; border-radius:10px; flex:none; font-style:normal;
    background:linear-gradient(150deg,#ffd08a,#ff9d24); color:#3d2200; font-size:16px;
    display:grid; place-items:center;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.6), 0 6px 16px -6px rgba(255,157,36,.9)}
  nav a{color:var(--dim); text-decoration:none; font-size:14px; font-weight:500;
    padding:7px 11px; border-radius:11px; white-space:nowrap; border:1px solid transparent}
  nav a:hover{color:var(--text); background-color:var(--glass); border-color:var(--line);
    box-shadow:var(--edge)}
  /* 375px: nav phải vừa đúng một hàng. Không bóp thì mục cuối bị đẩy ra ngoài mép. */
  @media (max-width:560px){
    nav .wrap{gap:2px; height:54px}
    nav .brand{font-size:15px; gap:7px; margin-right:4px}
    nav .brand i{width:25px; height:25px; font-size:14px}
    nav a{font-size:13px; padding:6px 7px}
    nav .cur{font-size:13px; padding:6px 7px}
    nav a[href$="#tinh-nang"]{display:none}   /* mục trong trang, bỏ được */
  }
  nav .spacer{margin-left:auto}

  .btn{display:inline-block; border-radius:16px; padding:12px 22px; font-size:14.5px;
    font-weight:600; text-decoration:none; color:var(--text);
    background-color:var(--glass); border:1px solid var(--line);
    -webkit-backdrop-filter:var(--blur); backdrop-filter:var(--blur);
    box-shadow:var(--sh); transition:transform .16s, box-shadow .16s, background-color .16s,
      border-color .16s}
  .btn:hover{background-color:var(--glass-hi); border-color:rgba(255,255,255,.62);
    box-shadow:var(--sh-hi); transform:translateY(-1px)}
  .btn:active{transform:translateY(1px)}
  /* Nút chính giữ màu cam của app — cam trên nền tím nổi bật hẳn, và đúng quy ước
     cam = tay phải mà trẻ thấy ở màn chơi. Vẫn là kính, chỉ là kính nhuộm cam đậm. */
  .btn.primary{color:#3d2200; font-weight:700; border-color:rgba(255,255,255,.55);
    background-image:linear-gradient(160deg, rgba(255,201,120,.96), rgba(255,157,36,.92));
    box-shadow:inset 0 1px 0 rgba(255,255,255,.6), 0 14px 32px -12px rgba(255,157,36,.65)}
  .btn.primary:hover{background-image:linear-gradient(160deg, rgba(255,214,146,1), rgba(255,172,62,.96))}

  code, kbd{background-color:var(--glass); border:1px solid var(--line2); border-radius:8px;
    padding:1px 6px; font-size:12.5px; color:var(--text)}
  kbd{border-bottom-width:2px; font:inherit; font-size:12.5px}

  footer a{color:var(--dim); text-decoration:none}
  footer a:hover{color:var(--text); text-decoration:underline}

  /* Máy không có backdrop-filter thì mặt kính .14 gần như trong veo, chữ chồng
     thẳng lên gradient — đục hẳn lên cho đọc được. */
  @supports not ((-webkit-backdrop-filter:blur(1px)) or (backdrop-filter:blur(1px))){
    :root{--glass:rgba(38,26,86,.72); --glass-hi:rgba(52,38,104,.78);
      --glass-lo:rgba(30,20,72,.62)}
    nav{background-color:rgba(30,22,80,.86)}
  }
  /* Người bật "giảm trong suốt" của hệ điều hành: bỏ hẳn phần nhìn xuyên. */
  @media (prefers-reduced-transparency:reduce){
    :root{--glass:#5a4aa8; --glass-hi:#6a59b8; --glass-lo:#4a3c92; --blur:none}
    nav{background-color:#4e3f9c}
  }

  body{min-height:100vh; font:400 15px/1.68 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
  .wrap{max-width:760px; margin:0 auto; padding:0 20px}
  nav .wrap{display:flex; align-items:center; gap:6px; height:60px; max-width:980px}
  nav .cur{color:var(--text); font-size:14px; font-weight:700; padding:7px 11px}

  .crumb{font-size:13px; color:var(--dim); margin:24px 0 0}
  .crumb a{color:var(--dim); text-decoration:none}
  .crumb a:hover{color:var(--text)}

  h1{font-size:31px; line-height:1.18; margin:10px 0 6px; letter-spacing:-.7px; font-weight:800}
  h2{font-size:19px; margin:32px 0 10px; letter-spacing:-.3px; font-weight:800}
  p{margin:0 0 13px}
  ul{margin:0 0 13px; padding-left:22px}
  li{margin-bottom:6px}
  footer{border-top:1px solid var(--line2); margin-top:40px;
    background-color:rgba(255,255,255,.08);
    -webkit-backdrop-filter:var(--blur); backdrop-filter:var(--blur); box-shadow:var(--edge);
    padding:20px 0 calc(38px + env(safe-area-inset-bottom)); color:var(--dim); font-size:12.5px}
  footer .wrap{display:flex; flex-wrap:wrap; gap:14px; align-items:center; max-width:980px}
  .hit{position:absolute; left:-9999px; width:1px; height:1px; opacity:0; pointer-events:none}

  /* Luật gom vệt loé, phải nằm CUỐI file: mọi luật ở trên dùng background-color chứ
     không dùng shorthand "background:", nên không có gì xoá mất vệt — kể cả các luật
     :hover (chúng chỉ đổi màu). Ai thêm mặt kính mới thì phải theo đúng hai điều đó.
     Cố tình KHÔNG gom .btn.primary / .cta / .demo: chúng đã có gradient riêng làm nền,
     gán thêm là mất luôn màu của chúng. */
  nav, footer, .btn, code, kbd, .box, .tw, .note, .near a, .toc a{
    background-image:var(--sheen);
  }`;

/* Chặn badge hits.sh khi chạy localhost — URL badge hardcode tên miền thật nên mở
   localhost lúc dev cũng +1 vào bộ đếm của site thật. Giống hệt 3 trang chính. */
const HIT_TAG = `<img class="hit" data-hit="https://hits.sh/luyentm.github.io/mypiano.svg" alt="" aria-hidden="true">
<script>
/* hits.sh cộng 1 mỗi lần ảnh .svg được tải, mà URL badge hardcode tên miền thật —
   mở localhost lúc dev cũng bị tính. Chỉ gắn src khi đang chạy trên site thật. */
for (const el of document.querySelectorAll('img[data-hit]')){
  if (location.hostname === 'luyentm.github.io') el.src = el.dataset.hit;
  else (el.closest('a') || el).remove();
}
</script>`;

const NOTICE = `<!DOCTYPE html>
<!--
  mypiano — piano falling notes
  Required Notice: Copyright © 2026 luyentm (https://github.com/luyentm/mypiano)
  PolyForm Noncommercial License 1.0.0 — phi thương mại. Sao chép/sửa đổi thì giữ
  nguyên dòng Required Notice ở trên. Xem LICENSE.

  TRANG NÀY SINH TỰ ĐỘNG bằng tools/build-pages.js — sửa tay là mất.
-->`;

/* up = số cấp phải lùi để về gốc site ("../../" cho bai/<slug>/, "../" cho giay-phep/) */
const head = (title, desc, url, extraCss) => `${NOTICE}
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
<style>${CSS}
${extraCss}
</style>
</head>
<body>
`;

/* here === 'giay-phep' thì mục đó in thành chữ thường thay vì tự link về chính nó. */
const nav = (up, here) => `<nav>
  <div class="wrap">
    <a class="brand" href="${up}"><i>♪</i> mypiano</a>
    <span class="spacer"></span>
    <a href="${up}library/">Thư viện</a>
    <a href="${up}play/">Chơi</a>
    ${here === 'giay-phep'
      ? '<span class="cur" aria-current="page">Giấy phép</span>'
      : `<a href="${up}giay-phep/">Giấy phép</a>`}
  </div>
</nav>
`;

const foot = up => `<footer>
  <div class="wrap">
    <span>mypiano — falling notes cho người tập piano</span>
    <a href="${up}giay-phep/">Giấy phép &amp; ghi công</a>
    <a href="https://github.com/luyentm/mypiano">Mã nguồn</a>
  </div>
</footer>

${HIT_TAG}
</body>
</html>
`;

/* ==========================================================================
   TRANG TỪNG BÀI
   ========================================================================== */
const SONG_CSS = `
  .by{color:#9fe6ff; font-size:15.5px; font-weight:600; margin:0 0 18px}
  .lv{display:flex; align-items:center; gap:10px; margin:0 0 24px; max-width:420px}
  .lv .bar{flex:1; height:7px; border-radius:5px; overflow:hidden;
    background:rgba(0,0,0,.22); box-shadow:inset 0 1px 2px rgba(0,0,0,.3)}
  .lv .bar i{display:block; height:100%; border-radius:5px; box-shadow:0 0 10px -1px currentColor}
  /* Viên thuốc tô đầy, không phải chữ màu — xem ghi chú ở library/index.html */
  .lv .lvl{font-size:12px; font-weight:800; white-space:nowrap; border-radius:20px;
    padding:4px 12px; box-shadow:inset 0 1px 0 rgba(255,255,255,.5)}
  .lv .num{font-size:12.5px; color:var(--dim); font-variant-numeric:tabular-nums; white-space:nowrap}
  .cta{display:inline-flex; align-items:center; gap:9px; color:#3d2200;
    background-image:linear-gradient(160deg, rgba(255,201,120,.96), rgba(255,157,36,.92));
    border:1px solid rgba(255,255,255,.55);
    font-weight:800; font-size:17px; text-decoration:none; border-radius:20px;
    padding:15px 30px; margin-bottom:12px;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.6), 0 18px 38px -14px rgba(255,157,36,.7);
    transition:transform .16s, box-shadow .16s, background-image .16s}
  .cta:hover{background-image:linear-gradient(160deg, rgba(255,214,146,1), rgba(255,172,62,.96));
    transform:translateY(-1px)}
  .cta:active{transform:translateY(1px)}
  .sub{font-size:13.5px; color:var(--dim); margin:0 0 28px}
  .note{background-color:var(--glass); border:1px solid var(--line); border-left:4px solid var(--lh);
    -webkit-backdrop-filter:var(--blur); backdrop-filter:var(--blur);
    border-radius:18px; padding:14px 17px; color:var(--text); font-size:14.5px; margin:0 0 14px;
    box-shadow:var(--sh)}
  .facts{list-style:none; padding:0; font-size:13.5px; color:var(--dim)}
  .facts b{color:var(--text); font-weight:700}
  .near{display:flex; flex-wrap:wrap; gap:8px; padding:0; list-style:none; margin:0 0 14px}
  .near li{margin:0}
  .near a{display:inline-block; background-color:var(--glass); border:1px solid var(--line);
    -webkit-backdrop-filter:var(--blur); backdrop-filter:var(--blur);
    border-radius:14px; padding:8px 13px; font-size:13.5px; text-decoration:none;
    color:var(--text); box-shadow:var(--sh)}
  .near a:hover{background-color:var(--glass-hi); border-color:rgba(255,255,255,.62);
    box-shadow:var(--sh-hi)}
  @media (prefers-reduced-motion:reduce){ .cta:hover{transform:none} }`;

const pageFor = (s, i) => {
  const slug = slugOf(s.file);
  const [, label, color, ink] = band(s.difficulty);
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

  return head(title, desc, url, SONG_CSS) + nav('../../') + `
<div class="wrap">
  <p class="crumb"><a href="../../">mypiano</a> › <a href="../../library/">Thư viện</a> › ${esc(s.title)}</p>
  <h1>${esc(s.title)}</h1>
  ${s.composer ? '<p class="by">' + esc(s.composer) + '</p>' : ''}

  <div class="lv">
    <span class="lvl" style="background:${color};color:${ink}">${label}</span>
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
    <li><b>Đếm vào và gõ nhịp</b> — có mốc phách trong tai trước khi vào bài, đỡ phải tự đoán.</li>
  </ul>

  <h2>Thông tin file</h2>
  <ul class="facts">
    <li>File MIDI: <b>${esc(s.file)}</b> · ${kb(s.bytes || 0)}</li>
    <li>Độ khó: <b>${s.difficulty}/1000</b> (${label})</li>
    ${s.composer ? '<li>Tác giả: <b>' + esc(s.composer) + '</b></li>' : ''}
    <li>Bản quyền bản nhạc gốc: <b>${s.rights === 'pd' ? 'phạm vi công cộng' : 'còn bản quyền'}</b> — <a href="../../giay-phep/">xem trang ghi công</a></li>
  </ul>

  <h2>Bài khác trong thư viện</h2>
  <ul class="near">
${near.map(o => '    <li>' + link(o) + '</li>').join('\n')}
  </ul>
  <p>${prev ? 'Dễ hơn một bậc: ' + link(prev) + '. ' : ''}${next ? 'Khó hơn một bậc: ' + link(next) + '. ' : ''}<a href="../../library/">Xem cả ${songs.length} bài →</a></p>
</div>

` + foot('../../');
};

/* ==========================================================================
   TRANG GIẤY PHÉP & GHI CÔNG
   ========================================================================== */
const LIC_CSS = `
  .lead{color:var(--dim); font-size:14.5px; margin:0 0 26px}
  .box{background-color:var(--glass); border:1px solid var(--line); border-radius:18px;
    -webkit-backdrop-filter:var(--blur); backdrop-filter:var(--blur);
    padding:16px 18px; margin:0 0 16px; box-shadow:var(--sh)}
  .box.warn{border-left:4px solid var(--rh)}
  .box h3{margin:0 0 8px; font-size:15px; font-weight:700}
  .box p:last-child{margin-bottom:0}
  dl{margin:0 0 15px; font-size:14.5px}
  dt{color:var(--dim); font-size:12.5px; margin-top:11px; font-weight:700;
    text-transform:uppercase; letter-spacing:.04em}
  dd{margin:2px 0 0}
  .tw{overflow-x:auto; margin:0 0 15px; border:1px solid var(--line); border-radius:18px;
    background-color:var(--glass); -webkit-backdrop-filter:var(--blur); backdrop-filter:var(--blur);
    box-shadow:var(--sh)}
  table{border-collapse:collapse; width:100%; font-size:13.5px; min-width:520px}
  th,td{text-align:left; padding:11px 14px; border-bottom:1px solid var(--line2); vertical-align:top}
  th{color:var(--dim); font-weight:700; font-size:12px; background-color:rgba(255,255,255,.10);
    text-transform:uppercase; letter-spacing:.04em}
  tr:last-child td{border-bottom:0}
  td .f{display:block; color:var(--dim); font-size:11.5px; font-variant-numeric:tabular-nums}
  /* Thẻ bản quyền tô đầy pastel + mực tối, cùng lý do với viên thuốc mức độ:
     chữ màu trên kính tím không đạt 4.5:1. */
  .tag{display:inline-block; border-radius:20px; padding:3px 11px; font-size:11.5px;
    font-weight:800; white-space:nowrap; box-shadow:inset 0 1px 0 rgba(255,255,255,.5)}
  .tag.pd{background:#7ef0b4; color:#093a24}
  .tag.cop{background:#ff92bd; color:#4d0a29}
  .toc{list-style:none; padding:0; margin:0 0 28px; font-size:14px;
    display:flex; flex-wrap:wrap; gap:8px}
  .toc li{margin:0}
  .toc a{display:inline-block; text-decoration:none; color:var(--text);
    padding:6px 13px; border-radius:14px;
    background-color:var(--glass); border:1px solid var(--line);
    -webkit-backdrop-filter:var(--blur); backdrop-filter:var(--blur); box-shadow:var(--sh)}
  .toc a:hover{background-color:var(--glass-hi); border-color:rgba(255,255,255,.62);
    box-shadow:var(--sh-hi)}`;

const licensePage = () => {
  const pd = songs.filter(s => s.rights === 'pd');
  const cop = songs.filter(s => s.rights !== 'pd');
  const title = 'Giấy phép & ghi công — mypiano';
  const desc = 'Toàn bộ bản quyền của mypiano: mã nguồn PolyForm Noncommercial 1.0.0, '
    + 'mẫu tiếng đàn Salamander Grand Piano (CC BY 3.0, Alexander Holm), và tình trạng '
    + 'bản quyền của từng file MIDI trong thư viện.';

  const row = s => `      <tr>
        <td>${esc(s.title)}<span class="f">${esc(s.file)}</span></td>
        <td>${esc(s.composer || '—')}</td>
        <td><span class="tag ${s.rights === 'pd' ? 'pd' : 'cop'}">${s.rights === 'pd' ? 'Phạm vi công cộng' : 'Còn bản quyền'}</span>${
          s.rightsNote ? '<span class="f">' + esc(s.rightsNote) + '</span>' : ''}</td>
      </tr>`;

  return head(title, desc, BASE + 'giay-phep/', LIC_CSS) + nav('../', 'giay-phep') + `
<div class="wrap">
  <p class="crumb"><a href="../">mypiano</a> › Giấy phép &amp; ghi công</p>
  <h1>Giấy phép &amp; ghi công</h1>
  <p class="lead">Trang này liệt kê đầy đủ mọi thứ trong mypiano không phải do tác giả tự viết,
     kèm giấy phép của từng thứ. Bảng file MIDI sinh tự động từ thư viện thật nên không bao giờ
     lệch với danh sách bài đang chạy.</p>

  <ul class="toc">
    <li><a href="#code">1. Mã nguồn</a></li>
    <li><a href="#audio">2. Mẫu tiếng đàn Grand piano</a></li>
    <li><a href="#synth">3. Tiếng đàn Digital</a></li>
    <li><a href="#libs">4. Thư viện lập trình &amp; phông chữ</a></li>
    <li><a href="#midi">5. File MIDI trong thư viện (${songs.length} bài)</a></li>
    <li><a href="#third">6. Dịch vụ ngoài</a></li>
    <li><a href="#privacy">7. Dữ liệu của người dùng</a></li>
  </ul>

  <h2 id="code">1. Mã nguồn</h2>
  <dl>
    <dt>Tác giả</dt><dd>luyentm — <a href="https://github.com/luyentm/mypiano">github.com/luyentm/mypiano</a></dd>
    <dt>Bản quyền</dt><dd>Copyright © 2026 luyentm</dd>
    <dt>Giấy phép</dt><dd><a href="https://github.com/luyentm/mypiano/blob/main/LICENSE">PolyForm Noncommercial License 1.0.0</a></dd>
  </dl>
  <p>Được tự do dùng, sao chép, sửa đổi và phân phối cho mục đích <b>phi thương mại</b>
     (học tập, nghiên cứu, dùng cá nhân, tổ chức phi lợi nhuận). Dùng cho mục đích thương mại
     phải xin giấy phép riêng từ chủ sở hữu.</p>
  <p>Mọi bản sao — kể cả bản đã sửa — bắt buộc kèm theo giấy phép và <b>giữ nguyên dòng bắt đầu
     bằng <code>Required Notice:</code></b>. Dòng đó nằm trong file <code>LICENSE</code> và lặp
     lại ở đầu mỗi file HTML của site.</p>
  <div class="box">
    <h3>Đây không phải open source theo định nghĩa OSI</h3>
    <p>Vì có điều khoản hạn chế lĩnh vực sử dụng (phi thương mại) nên đúng tên gọi là
       <b>source-available</b>. OSI không công nhận giấy phép hạn chế lĩnh vực sử dụng là
       open source.</p>
  </div>

  <h2 id="audio">2. Mẫu tiếng đàn Grand piano</h2>
  <p>Bộ tiếng &ldquo;Grand piano&rdquo; dùng 30 file <code>.mp3</code> trong thư mục
     <code>audio/piano/</code>, là bản thu đàn <b>Yamaha C5</b> thuộc bộ
     <b>Salamander Grand Piano</b>.</p>
  <dl>
    <dt>Tác giả</dt><dd>Alexander Holm</dd>
    <dt>Giấy phép</dt><dd><a href="https://creativecommons.org/licenses/by/3.0/">Creative Commons Attribution 3.0 Unported (CC BY 3.0)</a></dd>
    <dt>Nguồn gốc bộ mẫu</dt><dd><a href="https://freepats.zenvoid.org/Piano/acoustic-grand-piano.html">freepats.zenvoid.org — Acoustic Grand Piano</a></dd>
    <dt>Bản mp3 cụ thể lấy từ</dt><dd><a href="https://tonejs.github.io/audio/salamander/">kho audio của dự án Tone.js</a> (chỉ lấy file âm thanh, không dùng thư viện Tone.js)</dd>
  </dl>
  <div class="box warn">
    <h3>File đã được sửa đổi so với bản gốc</h3>
    <p>CC BY 3.0 buộc phải nói rõ nếu có sửa đổi. Ở đây có hai sửa đổi, làm bằng code lúc
       chạy trong trình duyệt: <b>cắt còn 6 giây</b> (bản gốc dài tới 25 giây) kèm vuốt nhỏ
       0,25 giây ở cuối, và <b>trộn stereo xuống mono</b>. Cả hai chỉ để giảm bộ nhớ từ
       ~160 MB xuống ~31 MB. Không đổi cao độ, không thêm hiệu ứng vào bản thu.</p>
  </div>
  <p>CC BY 3.0 cho phép dùng cho cả mục đích thương mại, miễn là ghi công tác giả. Đây là
     giấy phép của riêng phần âm thanh, <b>độc lập</b> với giấy phép PolyForm Noncommercial
     của mã nguồn.</p>

  <h2 id="synth">3. Tiếng đàn Digital</h2>
  <p>Bộ tiếng mặc định không dùng bản thu nào cả: mỗi nốt được tổng hợp lúc chạy bằng hai
     oscillator (triangle + sine cách nhau một quãng tám) qua một envelope ADSR, viết trực
     tiếp trong <code>play/index.html</code>. Không có bản quyền bên thứ ba.</p>
  <p>Đuôi vang cũng vậy — đáp ứng xung được dựng bằng code từ nhiễu trắng tắt dần, không
     tải file impulse response nào.</p>

  <h2 id="libs">4. Thư viện lập trình &amp; phông chữ</h2>
  <p><b>Không có.</b> Site không dùng bất kỳ thư viện, framework hay tài nguyên ngoài nào:</p>
  <ul>
    <li>Không CDN, không <code>&lt;script src&gt;</code> hay <code>&lt;link href&gt;</code> ra ngoài.</li>
    <li>Không npm, không bundler, không <code>node_modules</code> — repo không có <code>package.json</code>.</li>
    <li>Không thư viện nhạc: bộ đọc file Standard MIDI File và engine tiếng đàn đều tự viết.</li>
    <li>Không thư viện đồ hoạ: vẽ bằng Canvas 2D thuần.</li>
    <li>Không phông chữ tải về — dùng phông hệ thống của chính máy bạn
        (<code>system-ui</code>, San Francisco trên Apple, Segoe UI trên Windows, Roboto trên Android).</li>
  </ul>
  <p>CI của repo có kiểm tra tự động chặn mọi tài nguyên ngoài, nên ràng buộc này không thể
     vô tình bị phá.</p>

  <h2 id="midi">5. File MIDI trong thư viện</h2>
  <div class="box warn">
    <h3>File .mid không thuộc phạm vi giấy phép của mã nguồn</h3>
    <p>Cột bên dưới nói về <b>bản nhạc gốc</b>. Kể cả khi bản nhạc đã thuộc phạm vi công cộng,
       <b>bản soạn MIDI cụ thể vẫn có thể có bản quyền riêng của người soạn</b> — hai thứ đó
       tách rời nhau. Các file này được đưa lên để phục vụ việc học và tập đàn cá nhân.</p>
    <p>Nếu bạn giữ bản quyền một bản nhạc hoặc bản soạn ở đây và muốn gỡ xuống, mở một issue
       tại <a href="https://github.com/luyentm/mypiano/issues">github.com/luyentm/mypiano/issues</a>
       kèm tên file, file sẽ được gỡ.</p>
  </div>
  <p>Trong ${songs.length} bài: <b>${pd.length}</b> bài có bản nhạc gốc thuộc phạm vi công cộng,
     <b>${cop.length}</b> bài còn bản quyền.</p>
  <div class="tw">
    <table>
      <thead><tr><th>Bài</th><th>Tác giả</th><th>Bản nhạc gốc</th></tr></thead>
      <tbody>
${songs.map(row).join('\n')}
      </tbody>
    </table>
  </div>
  <p>Nếu bạn tự thêm file <code>.mid</code> vào bản sao của mình thì chỉ thêm file bạn có
     quyền phân phối.</p>

  <h2 id="third">6. Dịch vụ ngoài</h2>
  <p>Site tải đúng <b>một</b> thứ từ máy chủ khác: ảnh badge đếm lượt truy cập của
     <a href="https://hits.sh">hits.sh</a>. Không có Google Analytics, không quảng cáo,
     không pixel theo dõi, không mạng xã hội nhúng.</p>
  <p>Vì badge là một ảnh tải từ máy chủ của hits.sh nên dịch vụ đó nhìn thấy địa chỉ IP và
     user agent của người xem, giống mọi ảnh trên internet. Badge chỉ đếm số lượt, không đặt
     cookie và không nhận diện được cá nhân.</p>

  <h2 id="privacy">7. Dữ liệu của người dùng</h2>
  <ul>
    <li><b>Không có tài khoản, không có máy chủ.</b> Site là mấy file tĩnh trên GitHub Pages.</li>
    <li><b>File MIDI bạn mở từ máy không được gửi đi đâu cả</b> — trình duyệt tự đọc và tự
        phân tích ngay tại chỗ.</li>
    <li><b>Tuỳ chọn được lưu trong <code>localStorage</code></b> của trình duyệt (khoá
        <code>mypiano.v1</code>): tốc độ, âm lượng, bộ tiếng, chế độ gợi ý, bài đang tập dở.
        Dữ liệu nằm trên máy bạn, xoá dữ liệu duyệt web là mất.</li>
  </ul>
</div>

` + foot('../');
};

/* ==========================================================================
   GHI FILE
   ========================================================================== */
const dup = songs.map(s => slugOf(s.file)).filter((v, i, a) => a.indexOf(v) !== i);
if (dup.length) { console.error('Hai file MIDI ra cùng một slug: ' + dup.join(', ')); process.exit(1); }

const OUTDIR = path.join(ROOT, 'bai');
fs.mkdirSync(OUTDIR, { recursive: true });
const want = new Set(songs.map(s => slugOf(s.file)));
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

fs.mkdirSync(path.join(ROOT, 'giay-phep'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'giay-phep', 'index.html'), licensePage());

/* --- sitemap.xml ---
   Cố tình KHÔNG ghi <lastmod>: CI checkout nông nên mọi file đều mang đúng một
   ngày, ghi vào chỉ là số liệu bịa. Thiếu lastmod không sao, Google vẫn crawl. */
const urls = [BASE, BASE + 'play/', BASE + 'library/', BASE + 'giay-phep/']
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

console.log('bai/: ' + songs.length + ' trang · giay-phep/: 1 trang · sitemap.xml: ' +
  urls.length + ' URL · robots.txt');
