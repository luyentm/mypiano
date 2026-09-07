# mypiano — piano falling notes

Site tĩnh 3 trang cho người tập piano: nốt rơi từ trên xuống chạm bàn phím 88 phím
đúng lúc nốt kêu. Tự parse file MIDI, tự tổng hợp tiếng. Không backend, không build step.

Live: <https://luyentm.github.io/mypiano/>

| Đường dẫn | File | Việc |
| --- | --- | --- |
| `/` | [index.html](index.html) | Trang giới thiệu app + hero canvas mô phỏng màn chơi (không có tiếng) |
| `/play/` | [play/index.html](play/index.html) | App thật: nốt rơi, bàn phím, transport. Nhận `?song=<file>.mid` để nạp bài từ thư viện |
| `/library/` | [library/index.html](library/index.html) | Thư viện: đọc `midi/index.json`, bấm một bài là sang `/play/?song=…` |
| — | `midi/` | File `.mid` + `meta.json` (tên/tác giả tuỳ chọn) + `index.json` (sinh tự động) |
| — | `audio/piano/` | 30 mẫu Salamander Grand Piano (CC BY 3.0) cho bộ tiếng "grand" |
| — | `tools/` | Script bảo trì chạy bằng node, không phải phần của site |

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
| 1 | ~231 | `parseMidi()` — SMF format 0/1: VLQ, running status, note on/off, tempo (0x51), time signature (0x58), tên track (0x03), tempo map tick→giây |
| 2 | ~342 | State toàn cục: `notes`, `grid`, `duration`, `maxDur`, `geom`, canvas context |
| 3 | ~369 | Audio: `initAudio()`, `voice()` (2 oscillator + ADSR), `killVoices()` |
| 4 | ~530 | Đồng hồ: `songTime()`, `songToAudio()`, `anchorAt()` |
| 5 | ~540 | `normalize()` (bỏ track nhân bản + gán tay), `load()`, `computeRange()` |
| 6 | ~627 | `buildGeom()`, `resize()` — bảng geometry 88 phím + DPI |
| 7 | ~653 | `drawFalling()`, `drawKeys()` — vòng vẽ |
| 8 | ~788 | Scheduler 25ms + `frame()` (rAF) |
| 9 | ~833 | Transport: `play/pause/stop/seekTo/setRate` |
| 10 | ~881 | UI binding, `setHand()`, `setPanel()`, toàn màn hình, `countSong()`, `loadFromLibrary()`, overlay hết bài / trống, drag-drop, phím tắt, khởi động |

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
- **Gợi ý phím sắp bấm** (`showHint`, mặc định BẬT). Từng thử in TÊN NỐT lên thân nốt
  rơi rồi bỏ: người tập không cần đọc tên nốt, họ cần biết *bấm phím nào, ngay bây giờ*.
  Cách đang dùng — phím trên bàn phím sáng dần lên khi nốt tới gần, kèm đường nét đứt
  nối đáy nốt với tâm phím:
  - `HINT_LEAD = 1.2s`, `p = 1 - (start - now)/HINT_LEAD` (0 = còn xa, 1 = sắp bấm).
  - Tô **kín cả phím**, chỉ đậm dần `0.10 + 0.42p²`. Bình phương để lúc còn xa chỉ nhen
    nhẹ, tới sát mới bừng. Đã thử kiểu vệt màu dâng dần từ trên xuống như đếm ngược —
    **rối hơn hẳn, đừng làm lại**: một tín hiệu (độ đậm) là đủ.
  - Trần độ đậm cố ý thấp hơn phím đang kêu, để không lẫn "sắp bấm" với "đang kêu".
  - `lastKeySig` phải gồm cả độ sáng gợi ý **làm tròn 8 nấc**, nếu không thì hoặc đứng
    hình hoặc vẽ lại mỗi frame. Đo được: 47/120 frame vẽ lại, 0.06ms/frame.
  - Gradient bóng phím trắng dựng MỘT lần ngoài vòng lặp; trước đây tạo lại cho từng
    phím mỗi lần vẽ, giờ vẽ dày hơn nên phải sửa.
  - **Tên nốt in ở đáy phím** đang sáng (`keyLabel()`): đen đậm trên phím trắng, trắng
    đậm trên phím đen, **màu cố định** không đổi theo độ sáng highlight — vẽ sau khi đã
    trả `globalAlpha` về 1. Nhãn quãng tám `C1…C8` cũng dùng đúng font đen đậm đó và
    không đổi màu khi phím được bấm. Phím C chỉ in `C4`, không in đè thêm chữ `C`.
    Chữ tự co theo `measureText` cho vừa bề ngang phím, dưới 6.5px thì bỏ không vẽ.
    In cho cả phím đang kêu lẫn phím sắp bấm, để nhãn không nháy mất đúng lúc chạm phím.
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

- **Số ngón 1–5** (`fingering()`, `showFing`, mặc định BẬT) — chỉ gán ở chỗ CHẮC,
  chỗ không chắc để TRỐNG. Số ngón sai tệ hơn không có số: nó dạy sai thế tay và
  rất khó sửa. Mô hình là "thế 5 ngón" của sách vỡ lòng, ba luật:
  1. Cả đoạn nằm trong một khung 5 bậc phím trắng, không có hai nốt tranh cùng bậc
     (F với F#) → gán theo bậc. **Neo phía NGÓN CÁI**: tay phải ngón 1 ở nốt thấp
     nhất khung, tay trái ngón 1 ở nốt CAO nhất. Neo từ nốt thấp cho cả hai tay là
     SAI — hợp âm trái C4+E4 sẽ ra 5+3 thay vì 3+1, vì ngón cái luôn về phía giữa đàn.
  2. Hợp âm rộng đúng một quãng tám **và lúc đó tay đang rảnh** → hai nốt ngoài là
     1 và 5 (đúng với mọi bản nhạc), nốt giữa để trống. Không kiểm "rảnh tay" thì
     A Comme Amour sinh 63 ngón trùng.
  3. Nốt trầm với ra ngoài khung hợp âm liền kề → ngón 5 (mẫu đệm bass + hợp âm).
  Cố tình KHÔNG gán ở: **nốt đơn đứng một mình** (không hề cho biết đang bấm ngón
  nào — nếu gán, tay trái C3 rồi C4+E4 sẽ ra 5 rồi 5+3, bất khả thi), **biên khung
  mà là chạy ngón liên tục** (cách nhau <0.15s và dịch ≤2 bậc → đó là luồn ngón cái,
  không phải đặt lại tay; nhờ luật này mà đoạn chạy ngón Für Elise và Rondo để trống
  đúng chỗ cần để trống), và hợp âm rộng hơn quãng tám.
  **Lượt dọn cuối là bắt buộc**: hai nốt cùng tay cùng vang mà trùng ngón hoặc ngón
  chéo ngược chiều cao độ thì bỏ số cả hai. Đo trên 20 bài / 22.412 nốt: 47% số nốt
  có số, **0 ngón trùng, 0 ngón chéo**. Đối chiếu chỗ biết đáp án: Happy Birthday tay
  phải ra đúng thế 5 ngón trên G (`G:1 G:1 A:2 G:1 C:4 B:3`), River Flows in You tay
  phải ra đúng thế D–A, He's a Pirate tay trái ra 5+1 cho mọi quãng tám.
  Vẽ: **cỡ chữ phải co theo cả bề ngang phím LẪN chiều cao thân nốt** (nấc 15/12/10/8).
  Bản đầu cố định 15px theo bề ngang nên nốt phải dài 0.26s mới nhét được chữ — đo
  trên điện thoại ngang: Für Elise 0/9 nốt, He's a Pirate 0/52. Chia nấc thì lên
  46%, và chỉ set font tối đa 4 lần cho mỗi loại phím thay vì set cho từng nốt
  (chênh lệch 0.007ms/frame ở bài dày nhất, dưới ngưỡng đo được).
  Tay **'chỉ hiện' vẫn phải in số** — đó chính là lúc người tập tự đánh tay đó — nhưng
  phải đổi sang MỰC SÁNG: mực đen trên thân nốt đã mờ gần như không đọc được
  (đo pixel ô chữ: mực đen trên thân mờ 240 tối/480 sáng, đổi mực rồi mới đọc được).

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
  → limiter (-1.5 dB, 20:1) → loa.** Ba điểm đã trả giá mới rút ra:
  núm âm lượng phải nằm SAU compressor (để trước thì kéo to bao nhiêu cũng bị nén lại
  gần hết — nghe mãi vẫn nhỏ); compressor để -18/6:1 là nén gần hết tín hiệu, nghe bẹt;
  và vì slider lên tới 150% nên phải có limiter chốt cuối, không thì hợp âm dày vọt lên
  đỉnh 1.18 và méo. Giá trị giữ trong biến `volume` để áp được cả khi `AudioContext` chưa tạo.
- **Nút toàn màn hình tự ẩn** khi trình duyệt không hỗ trợ (`requestFullscreen` — iPhone
  Safari không cho fullscreen phần tử thường). Vào/ra fullscreen thì gọi `resize()`.
- **`play()` phải thoát sớm khi `notes` rỗng** — không có bài mà bấm Chơi thì scheduler
  thấy ngay `now >= duration` (= 0) và bắn overlay "Hết bài" vô nghĩa.
- **Hết bài thì mời chọn bài tiếp** — scheduler thấy `now >= duration` thì `stop()` rồi
  `showDone()` (overlay `#done`: Chơi lại / Chọn bài khác / Đóng). Mọi đường quay lại phát
  (`play`, `stop`, `seekTo`, `load`) đều phải gọi `hideDone()`, nếu không overlay kẹt lại.
- **`?song=` chỉ nhận tên file thuần** (`/^[A-Za-z0-9._-]+\.midi?$/`) rồi fetch `../midi/<tên>`.
  Đừng nhận đường dẫn hay URL đầy đủ — mở đường cho traversal và fetch bậy.

## Thêm bài vào thư viện

**Luật: mỗi bài BẮT BUỘC được chấm `difficulty` từ 1 tới 1000 trước khi vào thư viện.**
Thư viện xếp danh sách theo đúng con số này (dễ → khó) để người tập đi tuần tự từ trên xuống.
`tools/build-midi-index.js` fail nếu thiếu, nên CI sẽ đỏ và không deploy.

```bash
cp "bai-cua-toi.mid" midi/
node tools/analyze-midi.js midi/bai-cua-toi.mid   # lấy số liệu
# chấm difficulty theo bảng dưới, ghi vào midi/meta.json
node tools/build-midi-index.js                    # kiểm tra tại chỗ
git add midi/ && git commit -m "them bai" && git push
```

```json
{ "bai-cua-toi.mid": {
    "title": "Tên đầy đủ", "composer": "Tác giả",
    "note": "ghi chú ngắn", "difficulty": 420 } }
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
## Chạy & kiểm tra

**Dev server luôn chạy ở cổng 1234** để chủ repo mở <http://localhost:1234> xem thay đổi
bất cứ lúc nào — cấu hình sẵn trong [.claude/launch.json](.claude/launch.json).
Sau khi sửa file, khởi động lại nếu server chết; đừng đổi sang cổng khác.

```bash
python3 -m http.server 1234
```

`/play/` và `/library/` dùng `fetch` nên mở bằng `file://` sẽ bị chặn — bắt buộc qua http.
(Trang chủ và phần demo hardcode của `/play/` thì mở thẳng file vẫn chạy.)

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

Ghi công CC BY 3.0 cho Alexander Holm đang nằm ở footer trang chủ + `audio/piano/README.md`;
CI kiểm tra file README đó còn nguyên. Đừng xoá.

## Ghi nhớ tuỳ chọn (localStorage)

Khoá `mypiano.v1`, một object phẳng:

```json
{ "v":1, "rate":75, "look":5, "vol":120, "tone":"grand", "fit":true,
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
| `luyentm.github.io/mypiano` | cả 3 trang (`/` hiện rõ ở footer, `/play/` và `/library/` là ảnh 1px ẩn) | tổng traffic toàn site |
| `luyentm.github.io/mypiano/play/<file>.mid` | chỉ `/play/`, do `countSong()` chèn sau khi nạp bài thành công | số lượt tập từng bài |

**Tuyệt đối không nhúng badge theo bài vào trang thư viện.** Mỗi lần render danh sách là
mỗi lần badge được tải, mở thư viện sẽ bị tính thành lượt tập và số liệu vô nghĩa.
Cũng vì lý do đó, thư viện không hiển thị được số lượt của từng bài — muốn xem thì mở
trang thống kê của hits.sh.

File mở từ máy (`Mở MIDI`, kéo thả) không được đếm: nó không có trong thư viện.

## Giấy phép

[PolyForm Noncommercial License 1.0.0](LICENSE) — copyright © 2026 **luyentm**.

- Cho phép dùng/sửa/phân phối **phi thương mại**; thương mại phải xin giấy phép riêng.
- Mọi bản sao phải kèm giấy phép và **giữ nguyên dòng `Required Notice:`** — đây chính là
  cơ chế bắt buộc giữ tên tác giả gốc khi clone. Dòng đó nằm trong `LICENSE` và lặp lại
  ở đầu cả 3 file HTML; đừng xoá khi sửa file.
- Vì có điều khoản phi thương mại nên đây là **source-available**, không phải open source
  theo định nghĩa OSI (OSI cấm hạn chế lĩnh vực sử dụng). Cần chuẩn OSI thật thì phải đổi
  sang MIT/Apache-2.0 và bỏ điều kiện phi thương mại.
- File `.mid` trong `midi/` **không** thuộc phạm vi giấy phép này: bản nhạc có thể thuộc
  phạm vi công cộng nhưng bản soạn MIDI cụ thể có thể có bản quyền riêng. Chỉ thêm file
  mà bạn có quyền phân phối.

## Deploy

Push lên `main` → workflow [deploy.yml](.github/workflows/deploy.yml):
job `check` (đủ 3 trang, `node --check`, chặn CDN/npm, validate `meta.json`)
→ job `deploy` (sinh `midi/index.json` rồi đẩy nguyên gốc repo lên Pages, không Jekyll — có `.nojekyll`).

Pages của repo đã bật sẵn ở chế độ **Source = GitHub Actions** (`build_type=workflow`).
Nếu clone sang repo mới thì bật lại: Settings → Pages → Source = GitHub Actions, hoặc
`gh api -X POST repos/<owner>/<repo>/pages -f build_type=workflow`.
Chạy tay bằng nút **Run workflow** ở tab Actions.
