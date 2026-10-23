# Cờ Tỷ Phú MLN122: Cạnh tranh và độc quyền trong nền kinh tế thị trường

Game cờ tỷ phú nhiều người chơi, chạy trên trình duyệt, minh họa Chương 4 môn Kinh tế chính trị Mác - Lênin (MLN122).
Host chiếu bàn cờ lên màn hình. Người chơi vào phòng bằng **điện thoại** (quét QR) hoặc **máy tính** (nhập mã phòng 4 ký tự).

### Vào phòng
| Thiết bị | Cách vào |
|---|---|
| 📱 Điện thoại | Quét mã QR trên màn hình host (QR trỏ tới link ngắn `…/j/MÃ`) |
| 💻 Máy tính | Mở trang chủ, nhập mã phòng + tên, bấm "Vào phòng" |
| 🔗 Liên kết | Mở `http://<địa chỉ>/j/MÃ` (nút "Mời" có sẵn nút sao chép / chia sẻ) |

Nút **Mời người chơi** (host) và **Mời bạn bè** (người chơi) mở hộp QR + mã phòng + link, để mời thêm người kể cả khi ván đã bắt đầu (người vào muộn được xếp vào đội ít người nhất).

### Giao diện người chơi
- **Máy tính** (màn hình ≥ 980px): bàn cờ đầy đủ bên trái, bảng lượt chơi + các đội + nhật ký bên phải, chơi được cả khi không nhìn màn hình chiếu. Phím tắt: `Space` tung xúc xắc, `A–D`/`1–4` trả lời, `1–3` chọn quyết định, `Y`/`N` cho Cartel. Tab trình duyệt hiện 🔔 khi đến lượt.
- **Điện thoại**: 3 tab dưới cùng "Lượt chơi / Bàn cờ / Các đội"; tự chuyển về "Lượt chơi" và rung khi đến lượt bạn. Chạm một ô trên bàn cờ để xem chi tiết.
- Mất mạng / tải lại trang thì tự nối lại đúng người chơi cũ.

## 1. Chạy thử trên máy

```bash
npm install
npm start
```
Mở http://localhost:3000 → "Tạo phòng" (máy host). Điện thoại/máy tính khác cùng mạng Wi-Fi quét QR hoặc mở `http://<IP máy host>:3000` rồi nhập mã.

- Khi host mở bằng `localhost`, server tự dò IP Wi-Fi của máy để QR trỏ đúng địa chỉ (ưu tiên Wi-Fi/Ethernet, bỏ qua card ảo VMware/VPN). Nếu máy có nhiều mạng, chọn mạng đúng trong hộp "Mời người chơi".
- Windows có thể hỏi cho phép Node.js qua tường lửa: chọn **Allow** cho mạng Private, nếu không điện thoại sẽ không vào được.
Chạy nhanh để thử: `GAME_SPEED=10 npm start` (rút ngắn thời gian mỗi bước).

## 2. Triển khai

### Cách đơn giản nhất: chỉ Render (khuyến nghị)
1. Đưa thư mục này lên GitHub.
2. Render → New → Web Service → chọn repo. Runtime Node, Build `npm install`, Start `npm start`, gói Free (hoặc dùng sẵn `render.yaml`).
3. Xong. Mở `https://<tên-app>.onrender.com` làm host; QR tự trỏ đúng địa chỉ này.

### Thêm Vercel (tùy chọn, giao diện tĩnh)
Không bắt buộc: chỉ Render là đủ. Nếu muốn giao diện nằm trên Vercel thì:
1. Triển khai Render như trên trước (máy chủ game luôn phải chạy trên Render, Vercel không giữ được WebSocket).
2. Sửa `public/config.js`: `const RENDER_URL = 'https://<tên-app>.onrender.com';` rồi đẩy lên GitHub.
3. Import repo vào Vercel, Output Directory = `public`, không cần build (đã có `vercel.json`, gồm chuyển hướng link ngắn `/j/MÃ`).
4. Mở `https://<tên>.vercel.app` để tạo phòng. QR sẽ trỏ về tên miền Vercel; người vào bằng link Vercel hay Render đều vào cùng phòng.

`config.js` chỉ nối sang Render khi trang được mở từ tên miền `*.vercel.app` (dùng tên miền riêng thì thêm vào `VERCEL_HOST`). Trang mở từ Render hoặc chạy `npm start` trên laptop vẫn dùng máy chủ của chính nó, nên phương án dự phòng chạy trên laptop không bị ảnh hưởng.

### Lưu ý quan trọng
- Render gói Free **ngủ sau ~15 phút không dùng**, khởi động lại mất 30–60 giây. Hãy mở trang (hoặc `/healthz`) trước giờ thuyết trình 5 phút.
- Phòng chơi lưu trong bộ nhớ: nếu server khởi động lại, phòng mất. Điện thoại mất mạng thì tự nối lại.

## 3. Cách tổ chức một ván (lớp 15 người)
1. Host tạo phòng: chọn 3 đội, 8/10/12 vòng (khoảng 25–45 phút tùy tốc độ).
2. Chiếu màn hình host; cả lớp quét QR (hoặc nhập mã trên máy tính), nhập tên. Người mới vào được xếp tạm vào đội ít người nhất, sau đó **tự chọn đội** trên máy của mình cho tới khi game bắt đầu. Host vẫn có thể xáo trộn đội, bấm tên để chuyển đội, bấm × để mời ra khỏi phòng. Biểu tượng 📱/💻 cho biết ai đang dùng thiết bị gì.
3. **Chỉ host bắt đầu được game**: bấm nút "▶ Bắt đầu game" lớn ở giữa bàn cờ (hoặc nút "Bắt đầu game" góc trên phải). Nút bị khóa và ghi rõ lý do khi chưa có ai hoặc chưa có ít nhất 2 đội có người; đội không có ai sẽ bị loại khi bắt đầu. Mỗi lượt: một người tung xúc xắc → **cả lớp trả lời câu hỏi** → đội đang chơi đạt ≥50% đúng được giảm 30% chi phí → đội quyết định mua/thôn tính/đầu tư.
4. Host có nút tạm dừng, bỏ qua, kết thúc. Nút "Sổ tay lý thuyết" mở bảng đối chiếu cơ chế với lý thuyết để giảng giải.
5. Điểm cuối = tài sản ròng + 10 × số câu trả lời đúng của đội.

## 4. Cơ chế ↔ lý thuyết
Xem `docs/DOI_CHIEU_LY_THUYET.md`.

## 5. Sử dụng AI
Xem `docs/GIAI_TRINH_SU_DUNG_AI.md` (mẫu giải trình theo Quyết định 766/QĐ-DHFPT; hãy chỉnh theo thực tế nhóm).

## 6. Chỉnh nội dung
- Câu hỏi: `server/data.js`, mảng `QUESTIONS` (`sec`, `q`, `opts`, `ans` = vị trí đáp án đúng ban đầu là 0, `why`).
- Nội dung bám giáo trình Kinh tế chính trị Mác – Lênin, Chương 4. Trường `sec` là chủ đề hiện trên màn hình, nên viết tên chủ đề dễ hiểu (không dùng mã mục). Nhóm nên đọc lại toàn bộ câu hỏi trước khi dùng.
- Thẻ Thời cuộc/Khủng hoảng: `CARDS`. Hằng số cân bằng (vốn, lương, hệ số thuê): đầu file `data.js`.

## 7. Kiểm thử
`npm run test:sim` (host + 15 bot qua WebSocket, chạy cả ván) và `npm run test:balance`.
