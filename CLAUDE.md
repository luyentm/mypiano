# mypiano — piano falling notes

Web app tĩnh một file: nốt rơi từ trên xuống chạm bàn phím 88 phím đúng lúc nốt kêu.
Tự parse file MIDI, tự tổng hợp tiếng đàn. Không có backend, không có build step.

Deploy: <https://luyentm.github.io/mypiano/>

## Ràng buộc cứng — không được phá

Đây là dự án **HTML + JS thuần**, không phải Nuxt/Vue và sẽ không chuyển sang framework.

- **Đúng 1 file `index.html`**: HTML + CSS + JS inline. Mở thẳng file bằng browser là chạy,
  không cần server, không cần cài gì.
- **Vanilla JS**. Không TypeScript, không Nuxt/Vue/React, không npm, không bundler,
  không `package.json`, không `node_modules`.
- **Không tài nguyên ngoài**: không CDN, không script/style/font/ảnh tải qua mạng, không `import()` từ URL.
- **Không thư viện nhạc**: parser Standard MIDI File tự viết, tiếng đàn tổng hợp bằng
  `OscillatorNode` + ADSR. Không `@tonejs/midi`, không `smplr`, không Tone.js, không soundfont/sample.
- **Render bằng Canvas 2D**. Không SVG, không three.js, không tạo DOM element cho từng nốt.
- **Không `localStorage` / `sessionStorage`**.

CI chặn phần lớn các vi phạm này — xem job `check` trong [.github/workflows/deploy.yml](.github/workflows/deploy.yml).
Khi thêm tính năng: sửa trực tiếp `index.html`, đừng tách file.

## Bản đồ `index.html`

| Mục | Dòng | Nội dung |
| --- | --- | --- |
| 1 | ~103 | `parseMidi()` — SMF format 0/1: VLQ, running status, note on/off, tempo (0x51), time signature (0x58), tempo map tick→giây |
| 2 | ~209 | `DEMOS` + `buildDemo()` — bài demo hardcode (Für Elise, Canon in D), chạy được ngay khi chưa upload gì |
| 3 | ~273 | State toàn cục: `notes`, `grid`, `duration`, `maxDur`, `geom`, canvas context |
| 4 | ~295 | Audio: `initAudio()`, `voice()` (2 oscillator + ADSR), `killVoices()` |
| 5 | ~353 | Đồng hồ: `songTime()`, `songToAudio()`, `anchorAt()` |
| 6 | ~363 | `load()`, `computeRange()` — nạp bài, tách tay, tính khoảng cao độ |
| 7 | ~396 | `buildGeom()`, `resize()` — bảng geometry 88 phím + DPI |
| 8 | ~422 | `drawFalling()`, `drawKeys()` — vòng vẽ |
| 9 | ~555 | Scheduler 25ms + `frame()` (rAF) |
| 10 | ~584 | Transport: `play/pause/stop/seekTo/setRate` |
| 11 | ~620 | UI binding, drag-drop, phím tắt, khởi động |

## Quyết định kỹ thuật phải giữ

- **Đồng hồ**: song position lấy DUY NHẤT từ `audioCtx.currentTime`.
  Cấm `performance.now()`, cấm cộng dồn delta của rAF — sẽ drift lệch audio.
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
- **Màu**: tay phải `--rh`, tay trái `--lh`. Tách tay theo track; file 1 track thì cắt theo cao độ ở C4.

## Chạy & kiểm tra

```bash
open index.html
```

Cần http (test drag-drop, hoặc mobile qua LAN):

```bash
python3 -m http.server 8000
```

Kiểm tra cú pháp JS inline — chạy trước khi commit, CI cũng chạy đúng lệnh này:

```bash
sed -n '/^<script>/,/^<\/script>/p' index.html | sed '1d;$d' > /tmp/inline.js && node --check /tmp/inline.js
```

## Deploy

Push lên `main` → workflow [deploy.yml](.github/workflows/deploy.yml) chạy `check` rồi đẩy
nguyên gốc repo lên GitHub Pages (không build, không Jekyll — có `.nojekyll`).

Lần đầu phải bật thủ công trên GitHub: **Settings → Pages → Source = GitHub Actions**.
Có thể chạy tay bằng nút **Run workflow** ở tab Actions.
