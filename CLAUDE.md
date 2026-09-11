# mypiano — piano falling notes

Site tĩnh 3 trang cho người tập piano: nốt rơi từ trên xuống chạm bàn phím 88 phím
đúng lúc nốt kêu. Tự parse file MIDI, tự tổng hợp tiếng. Không backend, không build step.

Live: <https://luyentm.github.io/mypiano/>

| Đường dẫn | File | Việc |
| --- | --- | --- |
| `/` | [index.html](index.html) | Trang giới thiệu app + hero canvas mô phỏng màn chơi (không có tiếng) |
| `/play/` | [play/index.html](play/index.html) | App thật: nốt rơi, bàn phím, transport. Nhận `?song=<file>.mid` để nạp bài từ thư viện |
| `/library/` | [library/index.html](library/index.html) | Thư viện: đọc `midi/index.json`, bấm một bài là sang `/play/?song=…` |
| `/bai/<slug>/` | sinh tự động | Trang giới thiệu từng bài (SEO + link chia sẻ), CTA sang `/play/?song=…` |
| `/giay-phep/` | sinh tự động | Giấy phép & ghi công: mã nguồn, mẫu tiếng đàn, bảng bản quyền từng file MIDI |
| — | `midi/` | File `.mid` + `meta.json` (tên/tác giả tuỳ chọn) + `index.json` (sinh tự động) |
| — | `audio/piano/` | 30 mẫu Salamander Grand Piano (CC BY 3.0) cho bộ tiếng "grand" |
| — | `tools/` | Script bảo trì chạy bằng node, không phải phần của site |
| — | `sitemap.xml`, `robots.txt` | Sinh tự động cùng `bai/` và `giay-phep/` |

## Ràng buộc cứng — không được phá

Đây là dự án **HTML + JS thuần**, không phải Nuxt/Vue và sẽ không chuyển sang framework.

- **Mỗi trang là một file HTML tự chứa**: HTML + CSS + JS inline trong đúng file đó.
  Không tách file `.css`/`.js` riêng, không có "component" dùng chung — CSS lặp lại giữa
  3 trang là cố ý, đổi lại là mở file nào cũng chạy được file đó.
- **Vanilla JS**. Không TypeScript, không Nuxt/Vue/React, không npm, không bundler,
  không `package.json`, không `node_modules`.
- **Không tài nguyên ngoài**: không CDN, không script/style/font, không `import()` từ URL.
  Ngoại lệ DUY NHẤT: ảnh badge đếm lượt của hits.sh (xem mục "Đếm lượt truy cập").
  CI chặn mọi `<img src="https://…">` không phải hits.sh.
- **Không thư viện nhạc**: parser Standard MIDI File tự viết, engine tiếng đàn tự viết.
  Không `@tonejs/midi`, không `smplr`, không Tone.js, không soundfont runtime.
  Sample thu sẵn thì ĐƯỢC, với điều kiện file nằm trong repo (`audio/`) và tự giải mã bằng
  `decodeAudioData` — xem mục "Hai bộ tiếng đàn".
- **Render bằng Canvas 2D**. Không SVG, không three.js, không tạo DOM element cho từng nốt.
- **`localStorage` chỉ để nhớ tuỳ chọn của người dùng** (khoá `mypiano.v1`) — xem mục
  "Ghi nhớ tuỳ chọn". Không dùng nó làm nơi chứa dữ liệu bài hát hay cache file.

CI chặn phần lớn các vi phạm này — xem job `check` trong [.github/workflows/deploy.yml](.github/workflows/deploy.yml).

## Bản đồ `play/index.html`

| Mục | Dòng | Nội dung |
| --- | --- | --- |
| 1 | ~316 | `parseMidi()` — SMF format 0/1: VLQ, running status, note on/off, tempo (0x51), time signature (0x58), tên track (0x03), tempo map tick→giây |
| 2 | ~456 | State toàn cục: `notes`, `grid`, `duration`, `maxDur`, `geom`, canvas context |
| 3 | ~567 | Audio: `initAudio()`, `voice()` (2 oscillator + ADSR), `killVoices()` |
| 4 | ~807 | Đồng hồ: `songTime()`, `songToAudio()`, `anchorAt()` |
| 5 | ~817 | `normalize()` (bỏ track nhân bản + gán tay), `load()`, `computeRange()` |
| 6 | ~928 | `buildGeom()`, `resize()` — bảng geometry 88 phím + DPI |
| 7 | ~972 | `drawFalling()`, `drawKeys()` — vòng vẽ |
| 8 | ~1377 | Scheduler 25ms + `frame()` (rAF) |
| 9 | ~1530 | Transport: `play/pause/stop/seekTo/setRate` |
| 10 | ~1637 | UI binding, `setHand()`, `setPanel()`, toàn màn hình, `countSong()`, `loadFromLibrary()`, overlay hết bài / trống, drag-drop, phím tắt, khởi động |

**Không còn bài demo hardcode** (đã gỡ cùng menu chọn bài trong header).
`/play/` không tham số sẽ nạp **bài dễ nhất** trong `midi/index.json`; thư viện rỗng
hoặc nạp lỗi thì hiện overlay `#empty` (Mở thư viện / Mở file từ máy).
Vì vậy `/play/` bắt buộc phải chạy qua http — mở bằng `file://` sẽ không fetch được gì.

## Quyết định kỹ thuật phải giữ

- **Đồng hồ**: song position lấy DUY NHẤT từ `audioCtx.currentTime`.
  Cấm `performance.now()`, cấm cộng dồn delta của rAF — sẽ drift lệch audio.
  (Hero ở trang chủ dùng `performance.now()` được, vì nó không phát tiếng.)
- **Hai đồng hồ**: rAF chỉ để vẽ; một `setInterval(25ms)` riêng lo lên lịch nốt,
  schedule trước `AHEAD = 0.5s` bằng `osc.start(preciseTime)`.
  **Đừng hạ `AHEAD` xuống**: nốt nào timer tới trễ hơn độ dài của nó sẽ bị dòng
  `if (n.end < now) continue` vứt bỏ vĩnh viễn (schedIdx đã đi qua). Bài dày có nốt
  chỉ 0.15s, nên 0.1s chỉ chịu được cú khựng ~240ms; 0.5s chịu được ~640ms.
- **Tab chuyển sang nền thì `pause()`** — trình duyệt bóp `setInterval` xuống
  1 lần/giây (đã đo 800ms/tick), scheduler nuốt ~70% số nốt và phát ra một mớ sai bét.
  Dừng hẳn tử tế hơn, vị trí đã được `savePos()` giữ lại.
- **Culling**: `notes` sort theo `start`, mỗi frame binary search (`lowerBound`).
  Phải lùi window lại `maxDur` nếu không nốt bass/pedal dài sẽ biến mất khỏi màn hình.
- **Geometry**: precompute `{x, w, black}` cho từng phím một lần, tách khỏi danh sách nốt.
  Resize chỉ tính lại bảng phím. Phím đen: `[1,3,6,8,10].includes(midi % 12)`.
- **Vẽ**: nốt phím trắng trước, phím đen sau (đè lên trên).
  KHÔNG `ctx.shadowBlur` — giết perf; muốn glow thì vẽ thêm lớp rect mờ phía sau.
  `drawKeys()` chỉ vẽ lại khi tập phím đang sáng đổi (so `lastKeySig`).
- **DPI**: `canvas.width = clientWidth * devicePixelRatio` rồi `ctx.scale(dpr, dpr)`, hook `ResizeObserver`.
- **Chế độ "thu gọn" phím BẬT MẶC ĐỊNH** (quét min/max MIDI của bài, chỉ render khoảng đó).
  Trước đây chỉ bật khi viewport < 600px — sai đúng vào thiết bị đích: iPad ngang là
  1024px nên rơi vào nhánh 88 phím, phím trắng chỉ **19.7px**, hẹp hơn ngón tay trẻ con,
  trong khi Happy Birthday chỉ dùng 23/88 phím. Thu gọn cho **42.7px**, rộng 2.2 lần.
- **Bốn thứ dành riêng cho người chưa biết nốt** (đo trên iPad ngang 1024px):
  - Chú thích tay (`header .leg`) phải nằm NGOÀI panel, vì panel tự thu khi bấm Chơi —
    mà lúc đang chơi mới là lúc cần biết cam = tay phải nhất.
  - **Đô giữa (MIDI 60) in nhãn trong viên thuốc đậm** (`keyBadge()`), các Đô khác để
    chữ thường. Đây là mốc neo mọi giáo trình vỡ lòng dạy tìm trước tiên. Cố ý KHÔNG
    thêm ký hiệu mới — chỉ làm nổi cái nhãn đã có, đỡ một thứ phải học.
  - Tên nốt mặc định **Đô Rê Mi** (`noteLang = 'solfa'`), có tuỳ chọn đổi sang C D E.
    (Chỉ có tác dụng ở chế độ gợi ý `note` — xem mục "Hai chế độ SỐ" bên dưới.)
    Trẻ Việt học solfège; chữ cái là thứ phải học thêm chứ không giúp học nhanh hơn.
  - Nhãn chỉ in trên phím đang kêu / sắp bấm và trên các phím Đô — in hết 88 phím
    thì thành rừng chữ.
- **Audio**: `MAX_VOICES = 96`, chạm trần thì **CƯỚP voice cũ nhất** (`stealOldest()`),
  tuyệt đối không bỏ nốt mới. Trần cũ 16 + bỏ nốt mới đã làm He's a Pirate (16 nốt/giây)
  rơi 15% số nốt, nghe y như đánh sai giai điệu — bug này rất khó thấy vì phần nhìn
  vẫn đúng, chỉ tiếng là thiếu. Đo lại sau khi sửa: đỉnh 25 voice, rơi 0%.
  Trần đã phải nâng hai lần vì pedal ngân: 48 → 64 (Für Elise đỉnh 39) → 96
  (Golden Hour 2024 nốt + pedal 140 mốc, đo thực tế chạm hẳn 64 và cướp voice 6 lần
  trong 8 giây; với trần 96 thì đỉnh 67, cướp 0 lần).
  Đuôi voice cắt ở `rel + 0.45s` (sample) / `rel + 0.4s` (synth) — sau đó envelope đã im,
  giữ lâu hơn chỉ tổ chiếm chỗ. `retire()` là chỗ DUY NHẤT giảm `voiceCount`, gọi từ cả
  `onended` lẫn `stealOldest` và có cờ `dead` chống trừ hai lần.
  `actx.resume()` phải nằm trong user gesture đầu tiên — nếu không iOS Safari sẽ im lặng.
- **Chuẩn hoá file thật (`normalize()`)** — file MIDI ngoài đời hay có **2 bộ track y hệt nhau**
  (bắn ra 2 channel/2 thiết bị; Für Elise hiện tại là ví dụ: 611+440 nốt lặp lại ở channel 12/13).
  Nạp cả hai thì nốt kêu đôi, ăn voice và hình bị chồng mờ. Cách xử: so "dấu vân tay" từng track
  (`midi:round(start*8)`), trùng > 80% thì bỏ track sau. Đừng gỡ bước này.
- **Màu theo TAY, không theo thứ tự track** (`n.hand`): ưu tiên tên track (`Piano RH` / `LH` /
  `right` / `left` / `treble` / `bass`), không có tên mới đoán theo cao độ mốc C4.
  Gán theo thứ tự track là sai với file có nhiều hơn 2 track nhạc.
  Tay phải `--rh`, tay trái `--lh`.
  **File một track (format 0) thì màu tay chỉ là phỏng đoán** — Canon in D là ví dụ:
  tay trái vừa ôm bè trầm D1 vừa rải lên tới F#4, vắt qua mốc C4 nên một phần bè rải
  bị tô màu tay phải. Đã thử thay mốc cứng C4 bằng 2-means trên cao độ: cho mốc 57,
  **tệ hơn** (vì hai cụm cao độ không trùng với hai tay). Tách đúng cần bám vết bè
  theo thời gian, không phải một ngưỡng cao độ — đừng phí công với ngưỡng nữa.
  Muốn màu đúng thì kiếm file có track tên `Right Hand` / `Left Hand`.
- **Bố cục màn chơi tối ưu cho iPad/điện thoại NẰM NGANG** — chiều cao là thứ khan hiếm
  nhất, nên: transport gom vào top bar (một nút play/pause duy nhất, không có nút Dừng
  riêng), thanh tua bám sát mép dưới top bar để lúc nào cũng tua được, "lượt tập" cũng
  nằm trên top bar, và panel chỉnh ở đáy **tự thu lại khi bấm Chơi**.
  Top bar chia `grid-template-columns: 1fr auto 1fr` — thông tin trái, **nút Chơi màu cam
  chính giữa** (nút chính của cả app, to 74×40 để dễ trúng ngón tay), thao tác dồn phải.
  Grid chứ không phải flex + margin auto, để nút Chơi nằm đúng tâm màn bất kể hai bên
  dài ngắn thế nào. `.btn` phải `white-space:nowrap` không thì nhãn xuống dòng và top bar
  cao vọt lên ở màn hẹp.
  Panel chỉ mở lại khi bấm thanh tay cầm — cố tình KHÔNG tự bung ra lúc pause, vì
  play/pause liên tục sẽ làm layout nhảy. Lúc thu, thanh tay cầm in tóm tắt
  (`panelSummary()`) để vẫn biết đang ở tốc độ / tiếng đàn nào.
  Đo trên 844×390 (điện thoại ngang): vùng nốt rơi 144px → 220px khi thu panel.
- **Gợi ý phím sắp bấm** — combo box `hintMode` bốn chế độ, mặc định `note`:
  `note` (hiện tên nốt, hành vi cũ) · `abs` (số phím 1–88) · `deg` (số bậc theo C 1–7) · `off`.
  Cơ chế sáng dần + vệt dẫn là CHUNG cho ba chế độ đầu; chúng chỉ khác nhau ở
  **hệ nhãn** in ra. `hintOn()` = khác `off`, `numMode()` = `abs` hoặc `deg`.
  Từng thử in TÊN NỐT lên thân nốt rơi rồi bỏ: người tập không cần đọc tên nốt,
  họ cần biết *bấm phím nào, ngay bây giờ*.
  Cách đang dùng — phím trên bàn phím sáng dần lên khi nốt tới gần, kèm **vệt dẫn**
  nối đáy nốt xuống thẳng phím của nó:
  - `HINT_LEAD = 1.2s`, `p = 1 - (start - now)/HINT_LEAD` (0 = còn xa, 1 = sắp bấm).
  - Tô **kín cả phím**, chỉ đậm dần `0.10 + 0.42p²`. Bình phương để lúc còn xa chỉ nhen
    nhẹ, tới sát mới bừng. Đã thử kiểu vệt màu dâng dần từ trên xuống như đếm ngược —
    **rối hơn hẳn, đừng làm lại**: một tín hiệu (độ đậm) là đủ.
  - Trần độ đậm cố ý thấp hơn phím đang kêu, để không lẫn "sắp bấm" với "đang kêu".
  - **Vệt dẫn là KHỐI CHỮ NHẬT LIỀN, không phải đường nét đứt** (`TRAIL_STOPS`,
    `KEY_STOPS`, `vgrad()`). Rộng đúng bằng thân nốt, chạy từ đáy nốt xuống vạch chạm
    rồi tiếp tục xuống thân phím. Bản đầu là nét đứt 1px: trên iPad/điện thoại mảnh
    quá gần như không thấy, mà nét đứt còn cắt vụn đúng cái cột lẽ ra phải liền mạch.
    Gradient mờ ở trên, bừng ở sát vạch chạm; xuống thân phím thì ĐẢO LẠI (đậm ở mép
    trên, nhạt dần xuống) để hai bên khớp nhau thành một cột.
  - **Vệt dẫn KHÔNG dùng `HINT_LEAD`** — nó bám nốt **gần phím nhất của mỗi phím**
    (map `trails`) và hiện ngay từ lúc nốt ló ra ở mép trên. Bản đầu gắn nó vào
    `HINT_LEAD` nên cột chỉ bật lên khi còn 1.2s: **sát quá**, thấy được thì tay đã
    không kịp dóng. `notes` sort theo `start` nên cái gặp trước chính là cái gần nhất,
    không cần so sánh gì thêm.
    Độ đậm cả cột theo `q = yTop / HF` (0 = vừa ló, 1 = chạm phím): `0.20 + 0.80q²`.
    Đo alpha tại vạch chạm ở He's a Pirate: nốt còn 3.2s = **0.11–0.14**, còn 2.3s
    = 0.18, còn 0.2–0.35s = **0.48–0.51** — xa thì chỉ nhen, gần mới rõ.
  - **Phím trên bàn phím thì VẪN chỉ sáng trong `HINT_LEAD`.** Sáng sớm hơn là gần như
    cả bàn phím lúc nào cũng sáng, mất luôn nghĩa "sắp phải bấm". Hai thứ này cố ý
    lệch nhau: cột dẫn cho biết *nốt nào đang tới*, phím sáng cho biết *bấm ngay bây giờ*.
  - **Gradient trải đúng cả vùng rơi (`0 → HF`) và neo ở vạch chạm**, nên độ mờ chỉ là
    hàm của `y` — MỌI vệt dùng chung một đối tượng bất kể đáy nốt đang ở đâu. Nhờ vậy
    `vgrad()` cache được theo `(canvas, y0, y1, màu, bộ mốc)`; tạo gradient là thao tác
    đắt, đừng dựng lại cho từng vệt mỗi frame. Đo ở He's a Pirate (bài dày nhất, 15 vệt
    cùng lúc): cả `drawFalling()` **0.118 ms/frame**.
  - **Vẽ vệt TRƯỚC thân nốt** — vệt chạy từ đáy nốt xuống tận vạch chạm nên nó cắt
    ngang thân nốt ĐANG VANG của chính phím đó; vẽ sau là phủ một lớp mờ lên nốt đặc.
  - Vệt trên thân phím thì vẽ NGAY TRONG vòng vẽ phím, trước khi in nhãn — vẽ ở cuối
    hàm như nét đứt cũ thì lớp mờ phủ xuống làm nhạt mất tên nốt.
  - `lastKeySig` phải gồm cả độ sáng gợi ý **làm tròn 8 nấc**, nếu không thì hoặc đứng
    hình hoặc vẽ lại mỗi frame. Đo được: 47/120 frame vẽ lại, 0.06ms/frame.
  - Gradient bóng phím trắng dựng MỘT lần ngoài vòng lặp; trước đây tạo lại cho từng
    phím mỗi lần vẽ, giờ vẽ dày hơn nên phải sửa.
  - **Tên nốt in ở đáy phím** đang sáng (`keyLabel()`): đen đậm trên phím trắng, trắng
    đậm trên phím đen, **màu cố định** không đổi theo độ sáng highlight — vẽ sau khi đã
    trả `globalAlpha` về 1. Nhãn quãng tám `C1…C8` cũng dùng đúng font đen đậm đó và
    không đổi màu khi phím được bấm. Phím C chỉ in `C4`, không in đè thêm chữ `C`.
    Chữ tự co theo `measureText` cho vừa bề ngang phím nhưng **co tới `LABEL_MIN`
    = 6.5px là DỪNG, rồi cho chữ chìa ra ngoài phím — không bao giờ bỏ không vẽ**.
    Bản cũ bỏ hẳn nhãn khi phải co dưới 6.5px, nên đúng trên iPad/điện thoại (phím đen
    chỉ 12.2px ở chế độ 88 phím) nhãn dài như `Sol#` thỉnh thoảng biến mất — mà nhãn
    nhỏ thì vẫn đọc được, nhãn không có thì không. Cùng lý do, mọi ngưỡng `g.w >= 9/10/11`
    trong `drawKeys()` đã gỡ.
    Chữ chìa ra thì phần chìa nằm trên phím BÊN CẠNH và mất nền tương phản, nên
    `keyLabel()` nhận thêm tham số `pad`: phím đen truyền `#1b202b` để lót một viên nền
    tối dưới chữ trắng. Phím trắng không cần (chữ đen trên phím trắng bên cạnh vẫn đọc được).
    In cho cả phím đang kêu lẫn phím sắp bấm, để nhãn không nháy mất đúng lúc chạm phím.
- **Hai chế độ SỐ** (`numText()`, `DEG_TXT`) — nhắm đúng chỗ khó nhất của người tập
  piano: **đọc** bản nhạc, không phải nhớ bài. Mắt đọc một con số rồi tìm thẳng ra phím,
  bỏ được bước dịch qua tên nốt.
  - `abs`: số tuyệt đối 1–88 theo thứ tự phím thật, `m - 20` (A0 = 1, Đô giữa = 40,
    C8 = 88). Mỗi số ứng đúng MỘT phím nên đọc số là ra phím, không cần biết quãng tám.
  - `deg`: số bậc theo C — C=1 D=2 E=3 F=4 G=5 A=6 B=7, phím đen mang dấu `#` của bậc
    ngay dưới nó (`1#`, `2#`, `4#`, `5#`, `6#`). Mọi C đều là 1; quãng tám thì VỊ TRÍ
    cột nốt rơi trên màn tự nói ra, không cần in.
  - Số in lên **cả phím lẫn thân nốt rơi**. In lên thân nốt KHÔNG mâu thuẫn với quyết
    định cũ ("đã thử in tên nốt lên thân nốt rồi bỏ"): tên nốt dài 2–4 chữ và chỉ cho
    biết *nốt gì*, còn số ở đây 1–2 chữ và ứng đúng một phím, tức trả lời được
    *bấm phím nào*.
  - Chế độ số in nhãn lên **MỌI phím**, không chỉ phím đang sáng — cả bàn phím thành
    cái thước để mắt dóng vào. Làm được vì số chỉ 1–2 chữ; nhãn tên nốt (`Sol#`) in hết
    88 phím thì thành rừng chữ, nên chế độ `note` vẫn chỉ in ở phím đang kêu / sắp bấm.
  - **Viên thuốc đậm ở Đô giữa giữ cho cả ba chế độ.** Ở `deg` mọi C đều là "1" nên đó
    là thứ duy nhất còn neo được mắt.
  - Số hai chữ cần chỗ ngang gấp ~1.75 lần số một chữ, nên chọn nấc font phải chia
    `g.w / 1.75`; không chia thì "88" ăn nấc font quá to rồi chìa ra ngoài thân nốt.
  - Ô "Tên nốt" (Đô Rê Mi / C D E) **tự khoá** ở chế độ số — chế độ số không dùng tên
    nốt nào cả, để mở thì người ta đổi mà không thấy gì thay đổi.
  - `hintMode` có mặt trong `panelSummary()` nên handler phải gọi `refreshSum()`,
    không phải `savePrefs()`, nếu không lúc panel đang thu thì tóm tắt còn ghi chế độ cũ.
  - Prefs bản cũ lưu `hint` là **boolean** — phải đổi `true → 'note'`, `false → 'off'`
    chứ không bỏ qua, không thì người đang dùng mất tuỳ chọn của họ.
  - Đổi checkbox thành `<select>` làm mất phím Space trên chính ô đó (guard `keydown`
    chỉ chặn `INPUT`), nên guard phải chặn cả `SELECT`.
- **Dải quãng tám trong vùng nốt rơi** (`buildOct()`, `octBands`) — nền đan xen
  chẵn/lẻ + **số quãng tám in chìm** ở giữa mỗi dải. Sinh ra vì chế độ `deg`: nhãn trên
  nốt cho biết BẬC (mọi C đều là "1"), còn dải này mới cho biết bậc đó ở CAO ĐỘ nào.
  Bật cho cả bốn chế độ gợi ý — nó là mốc định hướng, không phải phụ kiện của chế độ số.
  - Mốc dải lấy theo phím **TRẮNG**: mép phải phím Si chính là mép trái phím Đô kế tiếp,
    nên dải khít nhau và tự bị kẹp đúng ở hai đầu khi đang thu gọn phím. Phím đen chìa
    ra nửa bề ngang qua mốc, lấy theo nó là dải bị lệch.
  - Dựng trong `buildGeom()`, nên MỌI đường rebuild đều có dải mới: `computeRange()`
    (đổi thu gọn phím, nạp bài) và `resize()` (đổi khung, toàn màn hình).
  - Đo độ sáng: nền dải lệch **6.3 lum** (15.9 → 22.2), chữ in chìm cao hơn nền dải của
    nó **~13 lum** ở CẢ hai phía chẵn/lẻ. Mốc để so: vạch quãng tám dọc sẵn có là
    30.6 lum, vạch ô nhịp 59 — tức chữ nặng đúng cỡ một vạch lưới, nhạt hơn hẳn vạch
    ô nhịp, và nốt rơi vẫn là thứ nổi nhất màn.
  - Cỡ chữ co theo cả bề ngang dải LẪN chiều cao vùng rơi, dưới 15px thì bỏ: ở chế độ
    88 phím dải cụt C8 chỉ 15px, in ra chỉ thành vệt bẩn. Dải A0–B0 thì vẫn in "0" —
    đó là số quãng tám đúng theo chuẩn, khớp với nhãn `A0`/`B0` mà chế độ `note` in ra.
  - Giá: **+0.009 ms/frame** (0.140 so với 0.131) cho 9 dải + 8 chữ, đo ở He's a Pirate
    chế độ 88 phím tức trường hợp xấu nhất — nằm trong nhiễu đo, nên KHÔNG cần cache
    ra canvas ngoài rồi blit; vẽ thẳng đơn giản hơn mà không tốn gì.
  - **Bẫy khi đo lại**: canvas nốt rơi trong suốt (`clearRect`), nên `getImageData` trả
    màu **chưa nhân alpha**. Phải đọc kênh alpha rồi tự trộn lên `--bg`; đọc thẳng 3 kênh
    đầu thì một lớp phủ 3% hiện ra thành (223,223,255), sai hoàn toàn.
- **Đoạn lặp** (`loopA`/`loopB`, `setLoop()`, `schedule()`) — kéo hai tay cầm ở hai
  đầu thanh tua để chọn đoạn, hệ thống chơi lặp trong đoạn đó thay vì hết bài là xong.
  - `<input type=range>` chỉ có MỘT nút, nên hai tay cầm là hai `div` riêng đặt
    tuyệt đối trên thanh tua. Vùng bấm 22×23px (ngón tay cần chỗ), phần nhìn thấy
    chỉ là vạch cam 4px, và **vươn LÊN 6px** vào top bar chứ không vươn xuống —
    vươn xuống là đè lên vùng nốt rơi.
  - Vị trí tính bằng PIXEL (`seekX()`, lề `SEEK_PAD = 7.5` = nửa nút tròn native,
    để tay cầm dóng thẳng với nút tua) nên `resize()` phải gọi lại `layoutLoop()`.
    Phải **kẹp vào trong khung**: không kẹp thì tay cầm bên phải chìa ra 4px và làm
    cả trang tràn ngang (đo được `scrollWidth` 847 trên khung 844), tức trên điện
    thoại là vuốt ngang được cả trang.
  - `loopOn()` chỉ cần đoạn HẸP HƠN cả bài, **một đầu thôi cũng được**. Bản đầu đòi
    B phải nhỏ hơn cuối bài nên kéo riêng đầu A ("từ giây 7.5 tới hết, lặp lại")
    không bật được lặp.
  - Quay vòng thì **neo lại tại chỗ** (`anchorAt(loopA)`), KHÔNG gọi `seekTo()`:
    `seekTo` đi qua `play()` nên mỗi vòng lặp lại đếm vào một lần, chen im lặng vào
    giữa câu nhạc.
  - Nhánh lặp phải nằm TRƯỚC nhánh `now >= duration`, không thì đoạn lặp chạm cuối
    bài sẽ bắn overlay "Hết bài" thay vì lặp.
  - Thân scheduler đã tách thành hàm `schedule()` có tên để gọi được mà kiểm — pane
    xem trước luôn `visibilityState: hidden` nên không chạy thật được, phải gọi
    `schedule()` với đồng hồ dựng sẵn. Bốn ca đã kiểm: vượt cuối đoạn → về đầu đoạn
    (không đếm vào), trong đoạn → không nhảy, hết bài mà không lặp → vẫn dừng + hiện
    overlay như cũ, đoạn lặp chạm cuối bài → vẫn lặp.
  - Lưu `la`/`lb` theo đúng luật của `pos`: chỉ khôi phục khi đúng bài đã lưu, và
    `load()` bài mới thì `resetLoop()`.

- **Khoanh ô nhịp** (`barScope()`, `showScope`, mặc định BẬT) — phủ xám mọi phím
  KHÔNG dùng trong ô nhịp đang chơi. Đo ở Happy Birthday: mỗi ô nhịp chỉ 5–6 phím
  trên tổng 40 phím đang hiện, tức mắt bớt phải quét ~85% bàn phím.
  - Phím **đang vang** và phím **trong tầm gợi ý** (1.2s) không bị phủ. Nhờ vậy
    phím của ô nhịp kế tiếp mở ra sớm ~1.2s, đúng lúc cần chuẩn bị ngón — và
    quan trọng hơn là không đá nhau với phím đang sáng.
  - Phím trắng phủ tối đi (`rgba(74,84,102,.62)`), phím đen **nhấc sáng lên**
    (`rgba(150,163,186,.30)`) — cùng dồn về xám nhưng phải giữ trắng sáng hơn đen,
    nếu không thì mất hình dạng bàn phím và không dóng được phím nào ra phím nào.
    Đo pixel: trắng 204 → 139, đen 30 → 74.
  - `lastKeySig` phải gồm cả chỉ số ô nhịp, không thì sang ô nhịp mới mà tập phím
    đổi thì vẫn đứng hình. Đo lại: 28/120 frame vẽ lại, y như khi tắt.
  - Tắt một tay thì phải `barIdx = -2` để tính lại tập phím.

- **Panel chỉnh chia đúng BA hàng theo KIỂU điều khiển**, không phải theo chủ đề:
  bốn thanh kéo · ba ô chọn · tất cả thứ bật/tắt gom thành viên thuốc (5 công tắc +
  vạch ngăn + 2 nút chọn tay). Bản cũ là hai hàng `flex-wrap` trộn lẫn nên mỗi bề
  ngang lại rơi dòng một kiểu. Đo ở 844×390: panel **176px → 138px**, vùng nốt rơi
  **92px → 130px** (+41%); ở 1024×768 panel 138px, vùng rơi 448px.
  - Hàng thanh kéo là **grid** `repeat(auto-fit,minmax(176px,1fr))` để bốn thanh dóng
    thẳng cột. Dưới 700px ép `repeat(2,1fr)`: auto-fit ở đó chỉ nhét được 3 cột nên
    ra khối 3+1 so le, ép 2 cột thì thành 2×2 cân đối mà không cao thêm.
  - **Công tắc vẫn là `<input type=checkbox>` THẬT**, chỉ ẩn phần nhìn
    (`position:absolute; opacity:0`) — giữ nguyên tab, phím Space, aria và mọi handler
    `onchange`. Chấm màu đổi bằng `input:checked + i` (chạy ở mọi trình duyệt); phần
    viền sáng lên thêm dùng `:has()` nên máy không có `:has()` chỉ mất phần trang trí,
    không mất tín hiệu bật/tắt. Phải có `label.chip:focus-within{outline}` vì checkbox
    thật đã bị ẩn, không còn vòng focus mặc định.
  - Viên thuốc dùng CHUNG khai báo CSS với `.hand` để cả hàng nhìn thành một nhóm.

- **Số ngón 1–5 — ĐÃ GỠ (2026-09-08), đừng làm lại.** Từng có `fingering()` suy ra
  số ngón bằng heuristic "thế 5 ngón" và chỉ gán ở chỗ tự cho là chắc (47% số nốt).
  Con số nội bộ đẹp (0 ngón trùng, 0 ngón chéo) nhưng **kết quả thực tế sai**, nên đã
  gỡ sạch: hàm, ô chọn trong panel, `showFing`, khoá prefs `fing`, hai lượt vẽ trên
  thân nốt. Bài học: số ngón đúng phụ thuộc câu nhạc phía trước và phía sau, thế tay
  đang giữ, và cách người soạn chia bè — không suy ra được từ cao độ với thời điểm
  onset. Số ngón sai tệ hơn không có số vì nó dạy sai thế tay và rất khó sửa.
  Muốn có lại thì phải là số ngón **do người soạn khai trong file**, không phải máy đoán.
  `NUM_SIZES`/`numSize()` ở lại vì chế độ số phím dùng chung nấc cỡ chữ đó.

- **Đếm vào + gõ nhịp** (`countIn`, `metro`, mặc định BẬT cả hai) — người mới không có
  mốc nào trong tai để canh lúc bấm. Mốc phách lấy từ `grid` sẵn có, không tính lại.
  - Đếm vào = **neo `startedAt` ra tương lai**, nên `songTime()` ÂM trong lúc đếm: nốt
    vẫn rơi sẵn trên màn, chỉ chưa tới vạch. Vì vậy `pause()` phải dùng
    `if (t > seekOffset) seekOffset = t` — dùng `Math.max(0, songTime())` như trước sẽ
    làm bấm tạm dừng lúc đang đếm là nhảy về đầu bài.
  - Số phách đếm vào tự cắt bớt nếu tempo chậm (`n * beat > 4s` thì giảm) — Endless Love
    có đoạn 25 nhịp/phút, đếm đủ ô nhịp là ngồi chờ 10 giây.
  - `beatAt(t)` tra độ dài phách **theo `grid` tại chỗ đó**, không dùng hằng số: có bài
    đổi tempo 19 lần.
  - `barBeats()` lấy khoảng cách **phổ biến nhất** giữa các vạch ô nhịp, KHÔNG lấy hai
    vạch đầu — Happy Birthday khai 1/4 rồi mới 3/4 (ô lấy đà một phách) nên lấy hai vạch
    đầu ra 1 phách/ô, đếm vào chỉ còn một tiếng.
  - Tiếng gõ đi thẳng vào `outGain`: không qua compressor (ngắn, bị nén thì mất dứt
    khoát) và không qua đường vang (gõ nhịp mà vang thì nhoè mất mốc).
  - `clickIdx` phải reset ở đúng mọi chỗ reset `schedIdx` (play/stop/seek/rate/hand).
- **Hiệu ứng nốt chạm phím** (`showFx`, mặc định BẬT) — kiểu Synthesia: cột sáng vọt lên
  từ phím + loé trắng ở vạch chạm + tia hạt bay lên rồi rơi xuống theo trọng lực.
  Vài điểm phải giữ:
  - Vật lý hạt lấy **delta của rAF** (`frame(ts)`), chặn trần 0.05s cho lúc tab vừa
    bị treo. Đây là ngoại lệ hợp lệ của luật đồng hồ: hạt chỉ để nhìn, không dính
    tới vị trí bài nhạc (vị trí vẫn chỉ lấy từ `audioCtx.currentTime`).
  - Phát hiện "vừa chạm phím" bằng cách so tập midi đang vang với frame trước
    (`prevOn`), và chỉ bắn khi `playing`.
  - **Sau khi tua phải bỏ qua đúng một frame** (`fxSkip`): cả nắm nốt đang vang đều
    tính là "mới", bắn hết thì loé sáng cả màn hình.
  - Gom hạt theo (tay × 4 nấc độ mờ) rồi vẽ mỗi nhóm một lệnh `fill()` — không vẽ
    từng hạt một. Cột sáng dùng 4 khối `fillRect` xếp cao dần thay vì gradient, vì
    tạo gradient cho từng cú chạm mỗi frame thì quá đắt. Vẫn KHÔNG `shadowBlur`.
  - Trần `MAX_PARTS = 420`. Đo ở He's a Pirate (16 nốt/giây, bài dày nhất): đỉnh 87
    hạt, 0.238ms/frame so với 0.113ms khi tắt — tức tốn thêm 0.13ms, 1% ngân sách
    của một frame 60fps.
- **Bật/tắt từng tay (`handState`)** — 3 trạng thái `on` → `silent` → `off`.
  `silent` = không kêu nhưng NỐT VẪN RƠI và phím vẫn sáng: đây là chế độ tập từng tay,
  đừng "tối ưu" bằng cách bỏ luôn khỏi `active`. Khi đổi trạng thái lúc đang chơi phải
  `killVoices()` + `anchorAt(songTime())` + tính lại `schedIdx`, vì nốt đã được lên lịch
  trước ~100ms sẽ vẫn kêu nếu không dọn.
- **Lùi tempo/nhịp về tick 0 khi file khai muộn** — có file (PhotoScore xuất) đặt tempo
  và time signature ở CUỐI track meta: Spring Time khai tempo 80 ở tick 45696, nên 40%
  đầu bài chạy ở 120 mặc định, nhanh hơn 1.5 lần (đo được 234s thay vì 279s). Không có
  mốc nào ở tick 0 thì lùi mốc đầu tiên về 0 — file cố tình chạy 120 thì nó không khai
  tempo, chứ không khai ở giữa bài. Đã kiểm 10 bài còn lại: thời lượng không đổi một giây.
- **Pedal ngân (CC64)** — parser đọc controller 64, `normalize()` dựng mốc đạp/nhả rồi
  tính `n.hold` = lúc tiếng thật sự tắt. **Không được kéo dài `n.end`**: `end` là lúc
  nhấc ngón, thân nốt rơi phải vẽ đúng thế, kéo dài thành ra dạy người ta giữ phím sai.
  Chỉ engine audio đọc `hold`. Trần `HOLD_MAX = 5s` vì mẫu grand chỉ dài 6s và bài đạp
  pedal gần như suốt (Endless Love 96% thời lượng) sẽ giữ nốt tới vô hạn.
  Đo được: Für Elise nốt kêu trung bình 0.24s → 0.86s (847/1051 nốt dài ra),
  He's a Pirate 0.20s → 0.58s, Endless Love 0.53s → 1.39s; 6 bài còn lại không dùng
  pedal nên không đổi gì. Voice đỉnh vọt lên 39 (Für Elise) nên trần voice mới phải 64.
  Envelope synth cũng phải sửa theo: ngân dài mà giữ gain phẳng thì nghe thành organ,
  nên thêm nhánh `exponentialRampToValueAtTime(peak*0.06, rel)` khi `rel` xa hơn 0.5s.
- **Đuôi vang (`makeReverbIR`)**: IR **tự dựng bằng code**, không tải file — nhiễu trắng
  tắt theo hàm mũ + lọc thông thấp mạnh dần cho đuôi tối lại. Đường vang chạy SONG SONG
  và **tách khỏi compressor** (`master → convolver → wetGain → outGain`) để đuôi vang
  không bị nén bóp. Đo được: đuôi nghe rõ 0.6s khi tắt → 1.1s ở mức 35%, mà đỉnh gần như
  không đổi (0.228 → 0.235) — tức dài hơi hơn chứ không to hơn.
- **Chuỗi audio: voice → `master` (cố định 1.0) → compressor (-10 dB, 4:1) → `outGain`
  → limiter (-3 dB, 20:1) → soft-clip (WaveShaper) → loa.** Bốn điểm đã trả giá mới rút ra:
  núm âm lượng phải nằm SAU compressor (để trước thì kéo to bao nhiêu cũng bị nén lại
  gần hết — nghe mãi vẫn nhỏ); compressor để -18/6:1 là nén gần hết tín hiệu, nghe bẹt;
  phải có limiter chốt cuối, không thì hợp âm dày vọt lên đỉnh 1.18 và méo;
  và **limiter một mình KHÔNG đủ** — xem mục dưới.
  Giá trị giữ trong biến `volume` để áp được cả khi `AudioContext` chưa tạo.
- **Trần âm lượng 200%, và tầng soft-clip là bắt buộc.** `DynamicsCompressor` không
  phải brick-wall: attack 1ms nên đúng cái transient đầu của tiếng búa gõ dây lọt qua
  nguyên. Đo bằng `OfflineAudioContext` chạy CHÍNH `initAudio()` + `voice()` của app
  (đánh lừa `window.AudioContext` trong lúc dựng chain): bộ grand 20 nốt cùng lúc vượt
  1.0 ngay từ mức **150%** (đỉnh 1.014), lên 200% là 1.066 — tức clip thật, không phải
  lo hờ. Nên cuối chuỗi có `WaveShaper` uốn mềm: dưới ngưỡng `KNEE = 0.85` đi thẳng
  không đổi gì, trên ngưỡng mới uốn tiệm cận 1.0 nên không bao giờ quá 1.0.
  Sau khi thêm: 24 phép đo (2 bộ tiếng × 1/6/12/20 nốt × 100/150/200%) đỉnh cao nhất
  **0.964**, **0 mẫu vượt 1.0**; kéo 150% → 200% vẫn to thêm thật **+1.3…+2.5 dB**
  (trần lý thuyết +2.5), chứ không phải bị bóp lại.
  **`oversample` phải để `'none'`.** Đã thử `'2x'` cho bớt aliasing: nó trễ hơn 8 mẫu
  và lọc cả tín hiệu — sóng sin biên độ 0.30 (cỡ đỉnh lúc chơi thường) lệch 0.348 kể cả
  sau khi bù trễ. Với `'none'` thì lệch **đúng 0** dưới ngưỡng.
  Lưu ý khi đo lại: IR vang dựng bằng nhiễu ngẫu nhiên nên mỗi `initAudio()` ra một IR
  khác, sai số phép đo RMS **±1.4%** — đừng tin con số lẻ tới 0.1 dB.
- **Nút toàn màn hình tự ẩn** khi trình duyệt không hỗ trợ (`requestFullscreen` — iPhone
  Safari không cho fullscreen phần tử thường). Vào/ra fullscreen thì gọi `resize()`.
- **`play()` phải thoát sớm khi `notes` rỗng** — không có bài mà bấm Chơi thì scheduler
  thấy ngay `now >= duration` (= 0) và bắn overlay "Hết bài" vô nghĩa.
- **Hết bài thì mời chọn bài tiếp** — scheduler thấy `now >= duration` thì `stop()` rồi
  `showDone()` (overlay `#done`: Chơi lại / Chọn bài khác / Đóng). Mọi đường quay lại phát
  (`play`, `stop`, `seekTo`, `load`) đều phải gọi `hideDone()`, nếu không overlay kẹt lại.
- **`?song=` chỉ nhận tên file thuần** (`/^[A-Za-z0-9._-]+\.midi?$/`) rồi fetch `../midi/<tên>`.
  Đừng nhận đường dẫn hay URL đầy đủ — mở đường cho traversal và fetch bậy.

## Giao diện: glassmorphism trên gradient xanh → tím → hồng

**Cả site một hệ duy nhất**: nền gradient chéo bão hoà, mọi mặt phẳng là kính mờ
viền sáng, **chữ trắng**. Bốn trang tĩnh (`/`, `/library/`, `/bai/*/`, `/giay-phep/`)
và `/play/` dùng chung bảng token; `/play/` chỉ khác ở chỗ vùng nốt rơi giữ nền gần đen.

Bốn thứ làm nên style này, thiếu cái nào cũng hỏng:

1. **Nền gradient bão hoà, cố định khi cuộn** (`body::before`, `position:fixed; inset:0;
   z-index:-1`) — cái để nhìn xuyên qua. Kính trôi qua vùng màu khác nhau khi cuộn.
2. **Mặt kính = một lớp trắng rất mỏng** (`--glass` = trắng 14%) + `backdrop-filter`.
3. **VIỀN SÁNG 1px rõ rệt** (`--line` = trắng 42%) — đây mới là thứ vẽ ra hình tấm
   kính. Nền mỏng như trên gần như không thấy nếu bỏ viền đi.
4. **Vệt loé chéo + bóng đổ tối mềm**, để kính nổi khỏi nền.

```
--g1 #17409c  --g2 #33359f  --g3 #4b2ea6  --g4 #6d2478  --g5 #822369
--text #ffffff        --dim rgba(255,255,255,.88)
--rh #ffb648  --lh #4fd0f5  --mint #5ce6a8  --grape #c89cff
--glass rgba(255,255,255,.14)   --glass-hi .18   --glass-lo .09
--line rgba(255,255,255,.42)    --edge inset 0 1px 0 rgba(255,255,255,.45)
--blur saturate(150%) blur(16px)
```

- **Gradient BẮT BUỘC tối (L ≈ .058–.070), không được tươi sáng** như phần lớn mẫu
  glassmorphism trên mạng. Kính là lớp TRẮNG đè lên nền, nên nền càng sáng thì mặt
  kính càng sáng và chữ trắng càng chìm. Đo ở mốc sáng nhất (hồng sen): kính + vệt loé
  cho chữ trắng 5.67:1; nền sáng thêm một nấc là tụt xuống dưới 4.5. Đúng vì lý do này
  mà bản gốc bắt chước từ ảnh mẫu (nền pastel sáng) không dùng được — trên ảnh mẫu đó
  chữ trắng chỉ đạt khoảng 2.5:1.
- **`--dim` gần như trắng (.88) là CỐ Ý.** Trên kính, mực .72 chỉ còn 3.8:1. Style này
  không có chỗ cho chữ xám — phân cấp phải làm bằng CỠ CHỮ và ĐỘ ĐẬM, không bằng màu.
- **Vệt loé (`--sheen`) gán bằng MỘT luật gom ở CUỐI file**, không gộp vào từng luật.
  Kèm theo đó là quy ước: mọi mặt kính dùng `background-color:` chứ **không dùng
  shorthand `background:`** — shorthand reset `background-image` và xoá mất vệt loé,
  nhất là ở các luật `:hover`. Ai thêm mặt kính mới thì phải theo đúng hai điều này.
  Cố ý KHÔNG gom `.btn.primary` / `.btn.pp` / `.cta` / `.demo` / `#fall`: chúng đã có
  gradient riêng làm nền, gán thêm là mất luôn màu của chúng.
- **Link thân bài dùng `:where(.wrap) p a` / `li a`** (xanh nhạt + gạch chân). Trên nền
  tím chữ đã là trắng, không còn màu nào để phân biệt link với chữ thường. Bọc
  `:where()` để luật có độ ưu tiên bằng 0 phần class, nhờ vậy nav/footer/`.crumb`/
  `.toc`/`.near`/`.btn`/`.cta` tự đè lên nó mà không phải viết một rừng ngoại lệ.
- **Nhãn mức độ và thẻ bản quyền là VIÊN THUỐC TÔ ĐẦY, không phải chữ màu.** Trên kính
  tím không màu chữ nào đạt 4.5:1 (đo được 3.2–4.0) — mà nhãn màu chính là thứ cho biết
  bài dễ hay khó. Tô đầy pastel + mực tối thì lên 7.3–9.8:1. Vì thế bảng `BANDS` có
  **bốn cột**: `[mốc, nhãn, màu nền, màu mực]`, và phải khớp giữa
  [library/index.html](library/index.html) và [tools/build-pages.js](tools/build-pages.js).
- **`backdrop-filter` KHÔNG được bọc quanh canvas đang vẽ 60fps.** Hai chỗ cố ý không có
  nó: `#fall` ở `/play/`, và `.demo` ở trang chủ (bên trong là hero canvas). Trình duyệt
  phải lọc lại nền mỗi frame nếu thứ bên trong vẽ liên tục. `header`/`footer` của
  `/play/` thì được: chúng là anh em flex của `#stage` nên không giao nhau về hình học.
  Overlay (`#done`, `#empty`, `#busy`, `#drop`) cũng được vì chỉ hiện lúc đã dừng.
- **`#fall` gần như ĐỤC (.97 → .94 → .90).** Đo lại: đỉnh 13.8 → 11.6 lum, đáy 21.7 →
  21.9 lum so với nền đặc cũ — tức vùng nốt rơi KHÔNG sáng lên, nên mọi con số trong
  "Quyết định kỹ thuật phải giữ" (dải quãng tám lệch 6.3 lum, vạch lưới 30.6, vạch ô
  nhịp 59, phủ khoanh ô nhịp trắng 204→139 / đen 30→74) vẫn đúng nguyên. Hạ alpha cho
  gradient ánh lên nhiều hơn là phải đo lại từng con số đó.
- **Ba nơi phải khớp từng giá trị**: `<style>` trong [index.html](index.html), trong
  [library/index.html](library/index.html), và hằng `CSS` trong
  [tools/build-pages.js](tools/build-pages.js). Lặp lại là cố ý (mỗi trang tự chứa),
  nhưng lệch màu thì người dùng thấy ngay khi bấm qua lại.

### `prefers-reduced-transparency` — nhánh này gặp thường xuyên hơn bạn nghĩ

Windows tắt **Settings → Personalization → Colors → Transparency effects** là Chrome báo
`prefers-reduced-transparency: reduce` ngay, và rất nhiều máy tắt sẵn vì pin/hiệu năng
chứ không phải vì nhu cầu tiếp cận. Máy của chủ repo đang tắt
(`HKCU\...\Themes\Personalize\EnableTransparency = 0`), nên **mở site trên chính máy đó
là thấy nhánh dự phòng, không phải kính**.

Vì vậy nhánh dự phòng phải TRÔNG NHƯ chính thiết kế, không được thành thứ khác:

- Bản đầu cho mặt kính thành khối tím **đặc và TỐI hơn nền** — lật ngược quan hệ
  sáng/tối của cả thiết kế (kính vốn phải sáng hơn nền). Đã sửa.
- Cách đang dùng: vẫn bỏ hẳn nhìn-xuyên-qua và bỏ blur, nhưng thay bằng màu ĐẶC lấy
  đúng bằng màu tấm kính hiện ra khi nằm trên khúc GIỮA gradient (`#5a4aa8`). Mặt kính
  vẫn sáng hơn nền, viền sáng và vệt loé giữ nguyên, chữ trắng lên 7.05:1.
- Muốn xem kính thật trên máy đang tắt: bật lại Transparency effects, hoặc tạm chèn
  `:root{--glass:rgba(255,255,255,.14)!important; --blur:saturate(150%) blur(18px)!important}`.

Nhánh `@supports not (backdrop-filter)` là chuyện khác (trình duyệt không hỗ trợ) và
vẫn dùng màu đặc hơn nữa.

### Đo tương phản (WCAG, ca xấu nhất = ĐÚNG TÂM từng mốc gradient)

| Chỗ | thấp nhất | ngưỡng |
| --- | --- | --- |
| chữ trắng trên kính (kể cả vệt loé) | 5.67 | 4.5 |
| chữ trắng trên kính lúc hover | 5.16 | 4.5 |
| `--dim` .88 trên kính | 4.80 | 4.5 |
| chữ trắng nằm thẳng trên gradient | 8.77 | 4.5 |
| viên thuốc 6 mức độ | 7.26 | 4.5 |
| mực `#3d2200` trên nút cam | 7.08 | 4.5 |
| nhánh giảm-trong-suốt (`#5a4aa8`) | 7.05 | 4.5 |

- **`--rh`/`--lh` chỉ dùng làm khối màu và chấm, KHÔNG làm chữ.** Trên kính tím không
  màu nào ngoài gần-trắng đạt 4.5.
- **Khung mô phỏng ở trang chủ (`.demo`) giữ nền gần đen** — nó là ảnh thu nhỏ của
  `/play/` thật. Để sáng thì trang chủ hứa một đằng, bấm vào một nẻo. Hero canvas cũng
  đọc `--rh`/`--lh` nên hai màu đó phải luôn nổi được trên nền tối.
- **`@media (max-width:560px)` bóp nav lại** (ẩn mục `#tinh-nang`, giảm cỡ chữ và đệm).
  Không có nó thì ở 375px chữ "Tính năng"/"Thư viện" xuống dòng và mục cuối bị đẩy ra
  ngoài mép. `nav a` bắt buộc `white-space:nowrap`. Đo sau khi sửa: mép phải mục cuối
  355px trên khung 375px, nav một hàng, không trang nào tràn ngang.

## Thêm bài vào thư viện

**Luật: mỗi bài BẮT BUỘC có `difficulty` (1–1000) và `rights` trước khi vào thư viện.**
Thư viện xếp danh sách theo `difficulty` (dễ → khó) để người tập đi tuần tự từ trên xuống;
`rights` là `"pd"` (bản nhạc gốc thuộc phạm vi công cộng) hoặc `"cop"` (còn bản quyền), và
trang `/giay-phep/` in thẳng con số đó ra bảng — khai bừa là trang ghi công nói dối.
`tools/build-midi-index.js` fail nếu thiếu bất kỳ cái nào, nên CI sẽ đỏ và không deploy.

```bash
cp "bai-cua-toi.mid" midi/
node tools/analyze-midi.js midi/bai-cua-toi.mid   # lấy số liệu
# chấm difficulty + tra bản quyền bản nhạc gốc, ghi cả hai vào midi/meta.json
node tools/build-midi-index.js                    # kiểm tra tại chỗ
node tools/build-pages.js                         # sinh trang riêng + giấy phép + sitemap
git add midi/ bai/ giay-phep/ sitemap.xml && git commit -m "them bai" && git push
```

```json
{ "bai-cua-toi.mid": {
    "title": "Tên đầy đủ", "composer": "Tác giả",
    "note": "ghi chú ngắn", "difficulty": 420, "rights": "pd" } }
```

### Cách chấm độ khó (thang 1–1000)

Chạy `node tools/analyze-midi.js` để lấy: nốt/giây (p50/p90/max), onset nhanh nhất,
đa âm tối đa, quãng rộng nhất phải với trong một tay, quãng của bài, tỉ lệ phím đen,
số nốt mỗi tay, thời lượng. Số liệu là đầu vào — con số cuối vẫn là **đánh giá của người chấm**,
đối chiếu mốc dưới đây rồi cộng/trừ theo các yếu tố tăng nặng.

| Thang | Trình độ | Mốc so sánh |
| --- | --- | --- |
| 1–80 | Mới bắt đầu, một tay, 5 ngón cố định | Twinkle một tay, Hot Cross Buns |
| 80–180 | Hai tay, tay trái nốt tròn / hợp âm khối, nhịp chậm | Ode to Joy hai tay, Lightly Row |
| 180–300 | Vỡ lòng khá, tay trái có chuyển động | **Für Elise đoạn mở đầu**, Minuet in G (Petzold) |
| 300–450 | Trung cấp | **Für Elise trọn bài = 420**, Sonatina Clementi Op.36, Invention BWV 772 |
| 450–600 | Trung cấp cao | Moonlight chương I, Chopin Waltz Op.69 No.2, Sinfonia của Bach |
| 600–750 | Đầu nâng cao | Nocturne Op.9 No.2, Debussy Arabesque No.1 |
| 750–880 | Nâng cao | Moonlight chương III, Chopin Ballade, Liszt Liebestraum |
| 880–1000 | Điêu luyện | La Campanella, Islamey, Rachmaninoff Concerto 3 |

Yếu tố cộng điểm: onset < 120ms kéo dài (chạy ngón nhanh), p90 nốt/giây cao,
quãng phải với ≥ 10 nửa cung, đa âm ≥ 5, hai tay đánh nhịp lẻ khác nhau,
nhiều dấu hoá, nhảy quãng xa, bài dài (sức bền).
Yếu tố trừ điểm: lặp lại nhiều, tay trái đệm một mẫu duy nhất, nhịp chậm, quãng hẹp.

Ví dụ đã chấm — Für Elise trọn bài (`difficulty: 420`): 155s, 1051 nốt, 6.8 nốt/giây
(p90 = 11), onset nhanh nhất ~109ms, đa âm tối đa 6, quãng 5.6 quãng tám, 13% phím đen.
Đoạn A dễ (cỡ 250) nhưng đoạn F trưởng và đoạn chạy ngón + chromatic cuối kéo cả bài lên
mức trung cấp, tương đương ABRSM grade 5 / Henle 3–4.

`midi/index.json` có commit trong repo cho tiện dev, nhưng bản trên site luôn là bản CI sinh lại.
## Trang riêng từng bài (`bai/`) + sitemap

`tools/build-pages.js` đọc `midi/index.json` rồi sinh `bai/<slug>/index.html` cho mỗi bài,
trang `/giay-phep/` (xem mục "Giấy phép"), cộng `sitemap.xml` và `robots.txt`.
Chạy SAU `build-midi-index.js`:

```bash
node tools/build-midi-index.js && node tools/build-pages.js
```

**Vì sao phải có**: `/play/?song=fur-elise.mid` chỉ là query param trên đúng MỘT trang,
nên Google gộp cả thư viện thành một kết quả duy nhất. Mà traffic của loại site này gần
như toàn bộ là long-tail theo TÊN BÀI ("river flows in you piano nốt"), không ai search
"web tập piano nốt rơi". Mỗi bài phải có URL riêng, `<title>` riêng, mô tả riêng.

Những chỗ đã phải trả giá, đừng phá:

- **File trong `bai/` sinh tự động, sửa tay là mất** — giống `midi/index.json`. Có commit
  vào repo cho tiện dev, nhưng bản trên site luôn là bản CI sinh lại.
- **Slug phải khớp Y HỆT ở hai nơi**: `slugOf()` trong `tools/build-pages.js` và
  `slugOf()` trong `library/index.html`. Lệch một chữ là toàn bộ link ở thư viện 404.
- **Card ở thư viện vẫn trỏ THẲNG vào `/play/?song=…`** — bấm một cái là chơi được, đừng
  chèn thêm một bước trung gian. Đường cho Google bò tới `bai/` là khối "Trang riêng từng
  bài" ở cuối thư viện, cộng với link chéo prev/next giữa các trang bài.
- **Trang bài phải có nội dung khác nhau thật.** Đoạn `ADVICE` chia theo 6 mức độ + câu
  "bài dễ thứ N" + `note` riêng của bài. 20 bản sao của cùng một khuôn là thin content,
  Google bỏ qua sạch.
- **`<link rel="canonical">` là ngoại lệ được CI tha** — nó là `<link href="https://…">`
  nên vướng đúng cái rule chặn CDN. Rule đã lọc `grep -v 'rel="canonical"'`; đừng gỡ.
- **Không có `bai/index.html`** — thư viện đã là trang hub rồi, thêm nữa là trùng nội dung.
- **CSS của trang sinh ra gom vào hằng `CSS` trong tool**, không lặp lại cho từng loại trang.
  File xuất ra vẫn tự chứa đúng ràng buộc; gom là để trang bài và trang giấy phép không lệch nhau.
- **`sitemap.xml` cố tình KHÔNG ghi `<lastmod>`**: CI checkout nông nên mọi file mang đúng
  một ngày, ghi vào chỉ là số liệu bịa. Thiếu lastmod không sao.
- **`robots.txt` ở đây KHÔNG có tác dụng** với GitHub Pages dạng project: crawler chỉ đọc
  `luyentm.github.io/robots.txt` thuộc repo gốc của user, không đọc `/mypiano/robots.txt`.
  Vẫn sinh ra vì (a) đúng ngay nếu sau này gắn tên miền riêng, (b) sitemap thì nộp thẳng
  trong Google Search Console là được, không cần qua robots.txt.
- **Chưa có `og:image`** — repo không có file ảnh nào, mà `og:image` phải là PNG/JPG thật
  (Facebook không nhận SVG). Share lên Facebook hiện ra thẻ không ảnh. Muốn có thì phải
  thêm ảnh thật vào repo, không có cách nào né.

## Chạy & kiểm tra

**Dev server luôn chạy ở cổng 1234** để chủ repo mở <http://localhost:1234> xem thay đổi bất
cứ lúc nào. Sau khi sửa file, khởi động lại nếu server chết; đừng đổi sang cổng khác.

[.claude/launch.json](.claude/launch.json) có **hai** config cùng cổng 1234, chọn theo máy:
`mypiano` chạy `python` (Windows — `python3` ở đó là stub của Microsoft Store),
`mypiano-mac` chạy `python3` (macOS/Linux không có lệnh `python`).

```bash
python3 -m http.server 1234
```

`/library/` và `/play/` dùng `fetch` nên mở bằng `file://` sẽ bị chặn — bắt buộc qua http.
Trang chủ và `bai/<slug>/` là HTML tĩnh hoàn toàn, mở thẳng file vẫn xem được.

Sinh lại danh mục + trang từng bài sau khi đổi `midi/`:

```bash
node tools/build-midi-index.js && node tools/build-pages.js
```

Kiểm tra cú pháp JS inline cả 3 trang — CI chạy đúng vòng lặp này:

```bash
for f in index.html play/index.html library/index.html; do sed -n '/^<script>/,/^<\/script>/p' "$f" | sed '1d;$d' > /tmp/inline.js && node --check /tmp/inline.js && echo "ok $f"; done
```

## Hai bộ tiếng đàn

| | `digital` (mặc định) | `grand` |
| --- | --- | --- |
| Cách tạo tiếng | 2 oscillator (triangle + sine quãng 8) + ADSR | 30 bản thu trong `audio/piano/` |
| Tải về | 0 byte | ~2 MB, chỉ tải khi người dùng chọn |
| RAM sau giải mã | 0 | ~31 MB |

Vì sao "grand" nghe thật hơn hẳn: nó là **thu âm đàn Yamaha C5 thật**, nên có sẵn tiếng búa
gõ dây, inharmonicity (bồi âm của dây cứng lệch cao hơn bội số nguyên), ~20 bồi âm tắt với
tốc độ khác nhau, cộng hưởng thùng đàn — những thứ oscillator không dựng lại được.

Ba chi tiết bắt buộc giữ:

1. **Mẫu cách nhau quãng 3 thứ** (A0, C1, D#1, F#1, A1 … C8 = MIDI `21 + 3*i`), nên mỗi nốt
   chỉ dịch tối đa **1 nửa cung** (`playbackRate` 0.944–1.059). Sample thưa hơn là méo tiếng
   nghe ra ngay. (onlinesequencer.net làm đúng như vậy: 26 mẫu cách quãng 3 thứ, 16s mỗi mẫu.)
2. **`trimMono()` cắt còn 6 giây + trộn mono.** Bản gốc dài tới 25 giây và stereo — để nguyên
   là ~160 MB RAM, máy yếu chết. Có vuốt nhỏ 0.25s cuối để không "cụp".
3. **Trong lúc tải vẫn chơi bằng digital.** `voice()` kiểm tra `tone === 'grand' && piano`,
   `piano` còn `null` thì tự rơi về synth. Đừng chặn phát nhạc để chờ tải.

Lựa chọn tiếng được lưu ở hai nơi, cố ý: `localStorage` (để lần sau mở lại vẫn đúng) và
URL `?tone=grand` (để link chia sẻ mang theo được). Màn chơi ghi vào URL bằng
`history.replaceState`, link sang thư viện mang theo `?tone=grand`, thư viện gắn tiếp vào
link từng bài. Sửa một chỗ thì nhớ sửa cả ba.

Ghi công CC BY 3.0 cho Alexander Holm nằm ở trang `/giay-phep/` (đầy đủ, có cả phần khai
báo đã sửa file), footer trang chủ và `audio/piano/README.md`;
CI kiểm tra file README đó còn nguyên. Đừng xoá.

## Ghi nhớ tuỳ chọn (localStorage)

Khoá `mypiano.v1`, một object phẳng:

```json
{ "v":1, "rate":75, "look":5, "vol":120, "tone":"grand", "fit":true, "hint":"deg",
  "hands":["on","silent"], "panel":false, "song":"fur-elise.mid", "pos":90.25 }
```

**Thứ tự ưu tiên khi khởi động: tham số URL > localStorage > mặc định.** Link chia sẻ
`?song=...&tone=grand` phải thắng, không thì prefs cũ đè lên và người nhận link mở ra sai bài.

Quy tắc khôi phục chỗ đang tập dở (`pos`):

- Chỉ nhảy về `pos` khi **không có `?song=`**, hoặc `?song=` trùng đúng bài đã lưu.
  URL chỉ đích danh một bài khác thì tập lại từ đầu.
- Chỉ nhảy khi `3 < pos < duration - 2` — tránh khôi phục vào đúng 2 giây cuối rồi
  hiện ngay overlay "Hết bài".
- Hết bài thì ghi `pos: 0`, lần sau mở lại là từ đầu.
- `song` chỉ ghi khi bài đến từ thư viện; file mở từ máy không khôi phục được nên để `null`.
- Bài đã lưu mà không còn trong thư viện thì im lặng rơi về bài dễ nhất, không báo lỗi.

Ghi vào lúc: đổi bất kỳ tuỳ chọn nào, nạp bài xong, `pause()`, mỗi 2 giây khi đang chơi,
và `pagehide` / `visibilitychange` (đóng tab, chuyển app trên iPad).
Mọi truy cập `localStorage` đều bọc `try/catch` — chế độ riêng tư của Safari chặn ghi,
app vẫn phải chạy bình thường.

## Đếm lượt truy cập (hits.sh)

Dịch vụ: <https://hits.sh> — badge SVG, không cần tài khoản, không script.

- Badge: `https://hits.sh/<url bỏ giao thức>.svg?style=&label=&color=&labelColor=&view=&extraCount=&logo=`
- Xem thống kê: đổi đuôi `.svg` thành `/` trong đúng URL đó.
- **Mỗi lần ảnh `.svg` được tải là +1. Không có chế độ chỉ-xem-không-tăng.**

Sơ đồ khoá đếm của repo này:

| Khoá | Nhúng ở đâu | Đếm cái gì |
| --- | --- | --- |
| `luyentm.github.io/mypiano` | mọi trang (`/` hiện rõ ở footer; `/play/`, `/library/`, `bai/<slug>/` là ảnh 1px ẩn) | tổng traffic toàn site |
| `luyentm.github.io/mypiano/play/<file>.mid` | chỉ `/play/`, do `countSong()` chèn sau khi nạp bài thành công | số lượt tập từng bài |

**Tuyệt đối không nhúng badge theo bài vào trang thư viện.** Mỗi lần render danh sách là
mỗi lần badge được tải, mở thư viện sẽ bị tính thành lượt tập và số liệu vô nghĩa.
Cũng vì lý do đó, thư viện không hiển thị được số lượt của từng bài — muốn xem thì mở
trang thống kê của hits.sh.

File mở từ máy (`Mở MIDI`, kéo thả) không được đếm: nó không có trong thư viện.

**Badge KHÔNG bao giờ được nạp khi chạy localhost.** URL badge hardcode
`luyentm.github.io/mypiano`, nên mở `http://localhost:1234` lúc dev cũng +1 vào đúng bộ đếm
của site thật — đo được 518 lượt trong 2 ngày đầu gắn badge, gần như toàn bộ là chính mình,
số liệu thành vô nghĩa. Cách xử: ảnh viết `data-hit="…"` chứ không phải `src="…"`, rồi JS
chỉ gắn `src` khi `location.hostname === 'luyentm.github.io'`, không thì gỡ hẳn thẻ ra
(`el.closest('a') || el` — ở trang chủ badge nằm trong `<a>`, gỡ mỗi `<img>` là còn lại
cái link rỗng). `countSong()` cũng thoát sớm theo cờ `HITS_LIVE` đó.
Rule CI về ảnh ngoài đã kiểm cả `src` lẫn `data-hit`, đừng gỡ.

## Giấy phép

[PolyForm Noncommercial License 1.0.0](LICENSE) — copyright © 2026 **luyentm**.

- Cho phép dùng/sửa/phân phối **phi thương mại**; thương mại phải xin giấy phép riêng.
- Mọi bản sao phải kèm giấy phép và **giữ nguyên dòng `Required Notice:`** — đây chính là
  cơ chế bắt buộc giữ tên tác giả gốc khi clone. Dòng đó nằm trong `LICENSE` và lặp lại
  ở đầu cả 3 file HTML lẫn mọi trang sinh tự động; đừng xoá khi sửa file.
- Vì có điều khoản phi thương mại nên đây là **source-available**, không phải open source
  theo định nghĩa OSI (OSI cấm hạn chế lĩnh vực sử dụng). Cần chuẩn OSI thật thì phải đổi
  sang MIT/Apache-2.0 và bỏ điều kiện phi thương mại.
- File `.mid` trong `midi/` **không** thuộc phạm vi giấy phép này: bản nhạc có thể thuộc
  phạm vi công cộng nhưng bản soạn MIDI cụ thể có thể có bản quyền riêng. Chỉ thêm file
  mà bạn có quyền phân phối.

### Trang `/giay-phep/`

Sinh tự động bởi `tools/build-pages.js` (7 mục: mã nguồn · mẫu tiếng đàn · tiếng synth ·
thư viện lập trình · bảng bản quyền từng file MIDI · dịch vụ ngoài · dữ liệu người dùng).

- **Bảng MIDI sinh từ `midi/index.json`, không viết tay.** Viết tay thì thêm một bài là
  bảng nói dối ngay, mà đây là trang không được phép sai. Cột trạng thái lấy từ trường
  `rights` bắt buộc trong `meta.json`.
- **Cột đó nói về BẢN NHẠC GỐC, không phải bản soạn MIDI.** Hai thứ tách rời: bản soạn có
  bản quyền riêng của người soạn kể cả khi bản nhạc đã hết hạn. Trang có nói rõ chuyện này
  cùng địa chỉ yêu cầu gỡ file (issue trên GitHub) — đừng bỏ đoạn đó đi.
- **Phải nói rõ mẫu tiếng đàn ĐÃ BỊ SỬA.** CC BY 3.0 buộc phải chỉ ra nếu có sửa đổi, mà
  `trimMono()` cắt còn 6 giây và trộn stereo xuống mono là sửa đổi thật. Footer cũ chỉ ghi
  tên tác giả nên còn thiếu điều kiện này.
- **CI kiểm tra trang này như một nghĩa vụ giấy phép**, không phải trang trang trí: phải có
  đủ chuỗi `Alexander Holm`, `CC BY 3.0`, `PolyForm`, `Required Notice`, và **mọi file
  `.mid` trong `midi/` phải xuất hiện trong bảng**. Thiếu là CI đỏ.
- **Link vào trang nằm ở nav/header của mọi trang**: nav trang chủ (`Tính năng · Thư viện ·
  Chơi · Giấy phép`), nav thư viện, nav mọi trang `bai/`, cộng footer trang chủ (2 link,
  một trỏ thẳng `#audio`) và footer thư viện. Ở chính `/giay-phep/` thì mục đó in thành
  `<span class="cur">` chứ không tự link về mình.
- **Trên `/play/` link nằm ở NHÓM TRÁI của top bar, không phải nhóm phải.** Nhóm phải có
  `#songname` co giãn: nhét thêm 57px vào đó thì tên bài bị cắt từ 172px xuống 107px.
  Nhóm trái (`♪` · đồng hồ · chú thích tay · badge lượt tập) mới là chỗ còn chỗ thật.
  Là chữ thường (`a.lic`) chứ không phải `.btn` — top bar là chỗ chật nhất màn hình.
- **`@media (max-width:820px)` ẩn link đó đi**, đúng kiểu `h1`/`.sub`/`.leg` đã làm.
  Đo với badge lượt tập giả lập 95px (ở localhost `#hits` rỗng, không giả lập là đo
  thiếu 95px): 1024px còn khe 111px tới nút Chơi, 844px còn 28px, 812px 12px, 800px 6px,
  780px thì âm. Để 820 chứ không sát mép vì bề ngang chữ đổi theo phông hệ thống.
  **Bản đầu đặt ở nhóm phải và không có ngưỡng nào: ở 568px nhóm phải tràn ngược 15px
  và ĐÈ LÊN nút Chơi.** Nút Chơi vẫn đúng tâm ở mọi bề ngang đã đo (grid `1fr auto 1fr`).
- Bảng cuộn ngang trong khung riêng (`.tw{overflow-x:auto}`, bảng `min-width:520px`) — đo ở
  375px: khung cuộn 333→520, còn cả trang **không** tràn ngang.

## Deploy

Push lên `main` → workflow [deploy.yml](.github/workflows/deploy.yml):
job `check` (đủ 3 trang, `node --check`, chặn CDN/npm, validate `meta.json`, sinh thử `bai/`)
→ job `deploy` (sinh `midi/index.json`, rồi `bai/` + `sitemap.xml` + `robots.txt`, rồi đẩy
nguyên gốc repo lên Pages, không Jekyll — có `.nojekyll`).

Pages của repo đã bật sẵn ở chế độ **Source = GitHub Actions** (`build_type=workflow`).
Nếu clone sang repo mới thì bật lại: Settings → Pages → Source = GitHub Actions, hoặc
`gh api -X POST repos/<owner>/<repo>/pages -f build_type=workflow`.
Chạy tay bằng nút **Run workflow** ở tab Actions.
