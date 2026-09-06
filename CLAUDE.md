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
| 1 | ~112 | `parseMidi()` — SMF format 0/1: VLQ, running status, note on/off, tempo (0x51), time signature (0x58), tempo map tick→giây |
| 2 | ~218 | `DEMOS` + `buildDemo()` — bài demo hardcode (Für Elise, Canon in D), chạy được cả khi offline/không có `midi/` |
| 3 | ~282 | State toàn cục: `notes`, `grid`, `duration`, `maxDur`, `geom`, canvas context |
| 4 | ~304 | Audio: `initAudio()`, `voice()` (2 oscillator + ADSR), `killVoices()` |
| 5 | ~362 | Đồng hồ: `songTime()`, `songToAudio()`, `anchorAt()` |
| 6 | ~372 | `load()`, `computeRange()` — nạp bài, tách tay, tính khoảng cao độ |
| 7 | ~405 | `buildGeom()`, `resize()` — bảng geometry 88 phím + DPI |
| 8 | ~431 | `drawFalling()`, `drawKeys()` — vòng vẽ |
| 9 | ~564 | Scheduler 25ms + `frame()` (rAF) |
| 10 | ~593 | Transport: `play/pause/stop/seekTo/setRate` |
| 11 | ~629 | UI binding, `loadFromLibrary()`, drag-drop, phím tắt, khởi động |

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
- **Màu**: tay phải `--rh`, tay trái `--lh`. Tách tay theo track; file 1 track thì cắt theo cao độ ở C4.
- **`?song=` chỉ nhận tên file thuần** (`/^[A-Za-z0-9._-]+\.midi?$/`) rồi fetch `../midi/<tên>`.
  Đừng nhận đường dẫn hay URL đầy đủ — mở đường cho traversal và fetch bậy.

## Thêm bài vào thư viện

```bash
cp bai-cua-toi.mid midi/
git add midi/bai-cua-toi.mid && git commit -m "them bai moi" && git push
```

CI chạy `node tools/build-midi-index.js` trước khi deploy nên **không cần sửa tay danh sách**.
Tên bài mặc định suy từ tên file (`fur-elise.mid` → "Fur Elise"); muốn tên đẹp thì khai trong
[midi/meta.json](midi/meta.json):

```json
{ "bai-cua-toi.mid": { "title": "Tên đầy đủ", "composer": "Tác giả", "note": "ghi chú ngắn" } }
```

Test ở máy thì chạy generator một lần: `node tools/build-midi-index.js`.
`midi/index.json` có commit trong repo cho tiện dev, nhưng bản trên site luôn là bản CI sinh lại.

`tools/make-demo-midi.js` sinh lại 2 file `.mid` mẫu từ mảng `DEMOS` trong `play/index.html` —
chỉ cần chạy khi muốn đổi/sinh thêm bài mẫu.

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
