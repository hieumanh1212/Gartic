# 🎨 Vẽ Đoán

Game vẽ và đoán chữ nhiều người chơi trên trình duyệt: một người vẽ, cả nhóm đoán. Không cần đăng ký. Tạo phòng xong gửi link cho bạn bè là chơi được.

- **Frontend:** React + Vite + TypeScript, host miễn phí trên **GitHub Pages**
- **Server realtime:** Cloudflare Workers + Durable Objects (WebSocket), dùng **gói Free**
- **Chi phí: 0đ**

## Tính năng

- Tạo phòng riêng, mời bạn bằng mã phòng hoặc link
- Bút, tẩy, tô màu (bucket fill), 18 màu + bảng chọn màu tự do, 5 cỡ nét, hoàn tác (Ctrl+Z), xóa hết
- Hơn 500 từ tiếng Việt dễ vẽ, chia thành 13 chủ đề (Động vật, Đồ ăn, Phương tiện, Lễ hội & Việt Nam...). Chủ phòng chọn một hoặc nhiều chủ đề, hoặc để "Tất cả". Người đoán thấy chủ đề của từ đang vẽ
- Chủ phòng có thể thêm từ riêng (ví dụ tên bạn bè, chuyện trong nhóm)
- Đoán không cần dấu, không phân biệt hoa thường ("con meo" = "con mèo"). Đoán gần đúng thì được báo riêng
- Điểm tính theo tốc độ đoán, người vẽ được điểm theo số người đoán đúng
- Gợi ý tự mở dần chữ cái
- Người đã đoán đúng chat với nhau thì người chưa đoán không thấy (tránh lộ đáp án)
- Rớt mạng hoặc tải lại trang trong vòng 20 giây vẫn giữ nguyên điểm
- Chủ phòng chỉnh cài đặt và mời người chơi ra; chủ phòng rời đi thì quyền tự chuyển cho người khác
- Lưu tranh thành PNG, có âm thanh, chơi được trên điện thoại

## Cấu trúc

```
ve-doan/
├── client/          React app (giao diện)
│   └── src/
│       ├── components/   Home, Lobby, Canvas, Chat, PlayerList, Overlays...
│       └── lib/          kết nối WebSocket, bảng vẽ, state game, âm thanh
├── server/          Cloudflare Worker
│   └── src/
│       ├── index.ts      Worker + Durable Object "Room" (mỗi phòng 1 instance)
│       ├── game.ts       toàn bộ luật chơi (thuần TypeScript, có test)
│       └── words.ts      bộ từ mặc định ← sửa ở đây để thêm từ
├── shared/          protocol + xử lý chữ tiếng Việt, dùng chung 2 bên
├── tests/           unit test (Vitest)
└── scripts/smoke.mjs   test đầu-cuối với server thật
```

## Chạy trên máy

Cần **Node.js 20+**.

```bash
npm install
npm run dev
```

- Giao diện: http://localhost:5173
- Server: http://localhost:8787

Để thử nhiều người chơi trên cùng một máy, mở thêm tab (mỗi tab là một người chơi).

**Chơi qua mạng LAN:** các máy dùng chung Wi-Fi có thể vào `http://<IP-máy-bạn>:5173`. Xem IP bằng lệnh `ipconfig`.

Kiểm thử:

```bash
npm test                 # unit test
npm run typecheck        # kiểm tra kiểu TypeScript
npm run smoke            # test đầu-cuối (cần đang chạy npm run dev)
```

## Đưa lên mạng (miễn phí)

### Bước 1: Deploy server lên Cloudflare

1. Tạo tài khoản miễn phí tại https://dash.cloudflare.com/sign-up (không cần thẻ).
2. Trong thư mục dự án, chạy:
   ```bash
   cd server
   npx wrangler login      # mở trình duyệt để đăng nhập
   npx wrangler deploy
   ```
3. Lần đầu deploy, Cloudflare sẽ hỏi tên subdomain `workers.dev`. Deploy xong, terminal in ra địa chỉ dạng:
   ```
   https://ve-doan-server.<ten-ban>.workers.dev
   ```
   Mở địa chỉ này trên trình duyệt, nếu thấy dòng *"Vẽ Đoán server đang chạy ✔"* là được.

### Bước 2: Đưa code lên GitHub

1. Tạo repo mới trên GitHub, ví dụ `ve-doan`. Repo phải **Public** thì mới dùng GitHub Pages miễn phí.
2. Đẩy code lên:
   ```bash
   git remote add origin https://github.com/<ten-ban>/ve-doan.git
   git push -u origin main
   ```

### Bước 3: Bật GitHub Pages

1. Vào repo → **Settings → Pages**. Ở mục **Source**, chọn **GitHub Actions**.
2. Vào **Settings → Secrets and variables → Actions → tab Variables → New repository variable**:
   - Name: `VITE_SERVER_URL`
   - Value: `wss://ve-doan-server.<ten-ban>.workers.dev` (lấy địa chỉ ở bước 1, đổi `https` thành `wss`)
3. Vào tab **Actions**, chọn workflow *"Deploy client lên GitHub Pages"* rồi bấm **Run workflow**.
4. Chờ khoảng 1 phút, game sẽ chạy tại `https://<ten-ban>.github.io/ve-doan/` 🎉

Từ đó về sau, mỗi lần `git push`, giao diện sẽ tự deploy lại.

### (Tùy chọn) Tự động deploy server

Nếu muốn server cũng tự deploy khi push code:

1. Tạo API token tại Cloudflare: **My Profile → API Tokens → Create Token**, chọn mẫu **"Edit Cloudflare Workers"**.
2. Thêm token vào GitHub repo: **Settings → Secrets → Actions → New repository secret**, đặt tên `CLOUDFLARE_API_TOKEN`.

### (Tùy chọn) Chỉ cho phép trang của bạn kết nối

Trong [server/wrangler.jsonc](server/wrangler.jsonc), đặt:

```jsonc
"ALLOWED_ORIGINS": "https://<ten-ban>.github.io"
```

Sau đó chạy lại `npx wrangler deploy`.

## Giới hạn gói miễn phí

Gói Free của Cloudflare Workers có hạn mức theo số request và thời gian chạy Durable Object mỗi ngày (xem chi tiết tại [trang giá của Cloudflare](https://developers.cloudflare.com/durable-objects/platform/pricing/)). Với một nhóm bạn chơi vài tiếng mỗi ngày thì còn dư nhiều. Để tiết kiệm hạn mức, server tự đóng phòng sau 30 phút không có ai thao tác.

## Tùy biến nhanh

| Muốn đổi | Sửa ở đâu |
|---|---|
| Bộ từ theo chủ đề | `server/src/words.ts` |
| Thêm / đổi tên chủ đề | `shared/topics.ts` (thêm id mới) + `server/src/words.ts` (thêm danh sách từ) |
| Thời gian chọn từ, thời gian chờ kết nối lại... | `LIMITS` trong `shared/protocol.ts` |
| Cách tính điểm | hàm `guess()` và `endTurn()` trong `server/src/game.ts` |
| Màu sắc giao diện | biến CSS trong `:root` của `client/src/styles.css` |
| Bảng màu vẽ | `COLORS` trong `client/src/components/Canvas.tsx` |
