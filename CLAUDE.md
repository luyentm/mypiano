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
| — | `tools/` | Script bảo trì chạy bằng node, không phải phần của site |

## Ràng buộc cứng — không được phá

Đây là dự án **HTML + JS thuần**, không phải Nuxt/Vue và sẽ không chuyển sang framework.

- **Mỗi trang là một file HTML tự chứa**: HTML + CSS + JS inline trong đúng file đó.
  Không tách file `.css`/`.js` riêng, không có "component" dùng chung — CSS lặp lại giữa
  3 trang là cố ý, đổi lại là mở file nào cũng chạy được file đó.
- **Vanilla JS**. Không TypeScript, không Nuxt/Vue/React, không npm, không bundler,
  không `package.json`, không `node_modules`.
- **Không tài nguyên ngoài**: không CDN, không script/style/font/ảnh tải qua mạng, không `import()` từ URL.
- **Không thư viện nhạc**: parser Standard MIDI File tự viết, tiếng đàn tổng hợp bằng
  `OscillatorNode` + ADSR. Không `@tonejs/midi`, không `smplr`, không Tone.js, không soundfont/sample.
- **Render bằng Canvas 2D**. Không SVG, không three.js, không tạo DOM element cho từng nốt.
- **Không `localStorage` / `sessionStorage`**.

CI chặn phần lớn các vi phạm này — xem job `check` trong [.github/workflows/deploy.yml](.github/workflows/deploy.yml).

## Bản đồ `play/index.html`

| Mục | Dòng | Nội dung |
| --- | --- | --- |
| 1 | ~112 | `parseMidi()` — SMF format 0/1: VLQ, running status, note on/off, tempo (0x51), time signature (0x58), tên track (0x03), tempo map tick→giây |
| 2 | ~223 | `DEMOS` + `buildDemo()` — bài demo hardcode (Für Elise, Canon in D), chạy được cả khi offline/không có `midi/` |
| 3 | ~287 | State toàn cục: `notes`, `grid`, `duration`, `maxDur`, `geom`, canvas context |
| 4 | ~308 | Audio: `initAudio()`, `voice()` (2 oscillator + ADSR), `killVoices()` |
| 5 | ~366 | Đồng hồ: `songTime()`, `songToAudio()`, `anchorAt()` |
| 6 | ~376 | `normalize()` (bỏ track nhân bản + gán tay), `load()`, `computeRange()` |
| 7 | ~462 | `buildGeom()`, `resize()` — bảng geometry 88 phím + DPI |
| 8 | ~488 | `drawFalling()`, `drawKeys()` — vòng vẽ |
| 9 | ~621 | Scheduler 25ms + `frame()` (rAF) |
| 10 | ~650 | Transport: `play/pause/stop/seekTo/setRate` |
| 11 | ~700 | UI binding, `loadFromLibrary()`, overlay hết bài, drag-drop, phím tắt, khởi động |

## Quyết định kỹ thuật phải giữ

- **Đồng hồ**: song position lấy DUY NHẤT từ `audioCtx.currentTime`.
  Cấm `performance.now()`, cấm cộng dồn delta của rAF — sẽ drift lệch audio.
  (Hero ở trang chủ dùng `performance.now()` được, vì nó không phát tiếng.)
- **Hai đồng hồ**: rAF chỉ để vẽ; một `setInterval(25ms)` riêng lo lên lịch nốt,
  schedule trước ~100ms bằng `osc.start(preciseTime)`.
- **Culling**: `notes` sort theo `start`, mỗi frame binary search (`lowerBound`).
  Phải lùi window lại `maxDur` nếu không nốt bass/pedal dài sẽ biến mất khỏi màn hình.
- **Geometry**: precompute `{x, w, black}` cho từng phím một lần, tách khỏi danh sách nốt.
  Resize chỉ tính lại bảng phím. Phím đen: `[1,3,6,8,10].includes(midi % 12)`.
- **Vẽ**: nốt phím trắng trước, phím đen sau (đè lên trên).
  KHÔNG `ctx.shadowBlur` — giết perf; muốn glow thì vẽ thêm lớp rect mờ phía sau.
  `drawKeys()` chỉ vẽ lại khi tập phím đang sáng đổi (so `lastKeySig`).
- **DPI**: `canvas.width = clientWidth * devicePixelRatio` rồi `ctx.scale(dpr, dpr)`, hook `ResizeObserver`.
- **Mobile**: bắt buộc có chế độ "thu gọn" (quét min/max MIDI của bài, chỉ render khoảng đó).
  Mặc định BẬT khi viewport < 600px.
- **Audio**: tối đa ~16 voice đồng thời, peak gain ~0.15/voice để không clip khi hợp âm dày.
  `actx.resume()` phải nằm trong user gesture đầu tiên — nếu không iOS Safari sẽ im lặng.
- **Chuẩn hoá file thật (`normalize()`)** — file MIDI ngoài đời hay có **2 bộ track y hệt nhau**
  (bắn ra 2 channel/2 thiết bị; Für Elise hiện tại là ví dụ: 611+440 nốt lặp lại ở channel 12/13).
  Nạp cả hai thì nốt kêu đôi, ăn voice và hình bị chồng mờ. Cách xử: so "dấu vân tay" từng track
  (`midi:round(start*8)`), trùng > 80% thì bỏ track sau. Đừng gỡ bước này.
- **Màu theo TAY, không theo thứ tự track** (`n.hand`): ưu tiên tên track (`Piano RH` / `LH` /
  `right` / `left` / `treble` / `bass`), không có tên mới đoán theo cao độ mốc C4.
  Gán theo thứ tự track là sai với file có nhiều hơn 2 track nhạc.
  Tay phải `--rh`, tay trái `--lh`.
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
`tools/make-demo-midi.js` sinh file `.mid` mẫu từ mảng `DEMOS` trong `play/index.html` —
chỉ cần khi muốn dựng lại bài mẫu.

## Chạy & kiểm tra

`/play/` và `/library/` dùng `fetch`, nên `file://` sẽ chặn — phải chạy qua http:

```bash
python3 -m http.server 8000
```

Rồi mở <http://localhost:8000/>. (Trang chủ và phần demo hardcode của `/play/` thì mở
thẳng file cũng chạy.)

Kiểm tra cú pháp JS inline cả 3 trang — CI chạy đúng vòng lặp này:

```bash
for f in index.html play/index.html library/index.html; do sed -n '/^<script>/,/^<\/script>/p' "$f" | sed '1d;$d' > /tmp/inline.js && node --check /tmp/inline.js && echo "ok $f"; done
```

## Deploy

Push lên `main` → workflow [deploy.yml](.github/workflows/deploy.yml):
job `check` (đủ 3 trang, `node --check`, chặn CDN/npm, validate `meta.json`)
→ job `deploy` (sinh `midi/index.json` rồi đẩy nguyên gốc repo lên Pages, không Jekyll — có `.nojekyll`).

Pages của repo đã bật sẵn ở chế độ **Source = GitHub Actions** (`build_type=workflow`).
Nếu clone sang repo mới thì bật lại: Settings → Pages → Source = GitHub Actions, hoặc
`gh api -X POST repos/<owner>/<repo>/pages -f build_type=workflow`.
Chạy tay bằng nút **Run workflow** ở tab Actions.
