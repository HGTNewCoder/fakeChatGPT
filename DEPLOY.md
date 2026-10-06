# Kế hoạch deploy (phi thương mại)

Mục tiêu: có một link công khai (ví dụ `https://chadgpt-xxx.vercel.app`) để người khác vào dùng.
Chi phí hạ tầng là **0 đồng**. Bạn chỉ trả tiền dùng DeepSeek và fal.ai theo lượt gọi.

## TL;DR: phương án được chọn

| Thành phần | Dùng gì | Vì sao |
|---|---|---|
| Hosting Next.js | **Vercel Hobby (free)** | Gói Hobby cho phép dự án cá nhân, phi thương mại. Next.js chạy được ngay, mỗi lần `git push` là tự deploy |
| Database | **MongoDB Atlas M0 (free vĩnh viễn)** | App đang dùng Mongoose nên **không phải sửa code**. Chỉ cần đổi `MONGODB_URI` |
| Domain (tuỳ chọn) | **GitHub Student Pack** (Namecheap `.me` / Name.com / `.tech` free 1 năm) | Có link đẹp thay vì `*.vercel.app` |
| Google Cloud $300 | **Để dành** | Credit dùng thử hết hạn sau 90 ngày, không hợp với link cần sống lâu. Xem phương án C |
| Supabase | **Không dùng lúc này** | Supabase là Postgres, phải viết lại tầng DB. Bản free còn tự tạm dừng sau 7 ngày không có truy cập. Xem phương án B |

```
Trình duyệt ──► Vercel (Next.js, region sin1 Singapore)
                  ├─► MongoDB Atlas M0 (AWS Singapore): users, GPTs (+ ảnh đại diện, knowledge files)
                  ├─► DeepSeek API (endpoint /anthropic): chat, đọc ảnh, web search, GPT Builder,
                  │                                       gọi tool generate_image
                  └─► fal.ai: FLUX.2 [klein] 4B, tạo và sửa ảnh, ảnh đại diện GPT
```

> Muốn deploy ngay từ máy của bạn mà chưa cần GitHub? Xem **mục 8: Deploy thẳng từ máy local**.

---

## 0. Chuẩn bị (≈15 phút)

- [ ] **Đổi API key mới** cho DeepSeek và fal.ai. Key cũ đã từng bị in ra terminal lúc debug. Sau đó cập nhật `.env.local`.
- [ ] Kiểm tra `.env.local` **không** bị commit: `git check-ignore .env.local` phải in ra tên file.
- [ ] Chạy thử build production ở máy:
  ```bash
  npm run build && npm start      # http://localhost:3000
  ```
- [ ] Commit và push lên GitHub. Repo private cũng được, Vercel vẫn đọc được.
- [ ] **Đặt giới hạn chi tiêu** trước khi mở link công khai (quan trọng):
  - DeepSeek: chỉ nạp một khoản nhỏ (ví dụ $5). Hết tiền thì API dừng, không bị trừ thêm.
  - fal.ai: đặt usage limit hoặc chỉ nạp ít credit.
  - Lý do: ai có link cũng tự đăng ký được và dùng bằng tiền của bạn. Xem thêm mục 6.

## 1. MongoDB Atlas M0 (≈10 phút)

1. Đăng ký tại https://www.mongodb.com/cloud/atlas. Có thể đăng nhập bằng GitHub.
2. **Create cluster → M0 Free**, provider **AWS**, region **Singapore (ap-southeast-1)**. Chọn Singapore để gần Vercel `sin1` và gần Việt Nam.
3. **Database Access → Add user**: tạo **một** database user cho web (ví dụ `chadgpt-app`), quyền `readWriteAnyDatabase`. Đặt mật khẩu dài, không có ký tự đặc biệt để khỏi phải URL-encode.
   > Đây là tài khoản để **server ChadGPT kết nối vào MongoDB**, chỉ tạo 1 lần. **Không phải** tài khoản học sinh:
   > học sinh tự đăng ký trên trang `/register` của web, và tài khoản của họ nằm trong collection `users`.
4. **Network Access → Add IP → `0.0.0.0/0`**. Vercel không có IP cố định nên phải mở toàn bộ. Database vẫn được bảo vệ bằng user/password.
5. **Connect → Drivers** để lấy connection string, rồi thêm tên DB `fakechat` vào:
   ```
   mongodb+srv://<user>:<password>@<cluster>.xxxxx.mongodb.net/fakechat?retryWrites=true&w=majority
   ```
6. (Tuỳ chọn) Chuyển tài khoản đang có ở máy lên cloud:
   ```bash
   docker compose exec mongo mongodump -u root -p example --authenticationDatabase admin --db fakechat --archive > fakechat.archive
   mongorestore --uri "<connection string ở bước 5>" --archive=fakechat.archive
   ```
   Lệnh `mongorestore` cần cài [MongoDB Database Tools](https://www.mongodb.com/try/download/database-tools). Muốn bắt đầu với DB trống thì bỏ qua bước này.

**Database lưu những gì và có đủ cho khoảng 20 tài khoản không?** Đủ, dư rất nhiều.

| Dữ liệu | Lưu ở đâu | Dung lượng ước tính |
|---|---|---|
| Tài khoản (username, mật khẩu đã băm bcrypt, danh sách GPT được chia sẻ) | Atlas, collection `users` | khoảng 0,3 KB / người |
| Custom GPT (cấu hình, ảnh đại diện dạng data URL, trạng thái chia sẻ) | Atlas, collection `gpts` | khoảng 10–70 KB / GPT |
| Knowledge files của GPT (chỉ lưu chữ đã trích, không lưu file gốc) | trong cùng document GPT | tối đa khoảng 1–3 MB / GPT (10 file × 100k ký tự) |
| Lịch sử chat | **không lưu** (chỉ ở bộ nhớ trình duyệt) | 0 |

20 người × 5 GPT, mỗi GPT có Knowledge đầy, tổng khoảng 100–300 MB, vẫn dưới mức 512 MB của M0. Thực tế phần lớn
GPT không có Knowledge thì chỉ vài MB. Lưu ý M0 **không có backup tự động**, nên thỉnh thoảng sao lưu bằng:
```powershell
mongodump --uri "<connection string>" --archive=chadgpt-backup.archive
```
Muốn lưu cả lịch sử chat như ChatGPT thì phải làm thêm (collection `conversations`), vì hiện chưa có.

Giới hạn M0: dung lượng 512 MB, tối đa 500 kết nối, khoảng 100 thao tác/giây, không có backup. Cluster bị tạm dừng nếu **30 ngày không có kết nối nào**. Với app này (chỉ lưu user và GPT) thì 512 MB là rất dư.

## 2. Vercel (≈10 phút)

1. Đăng nhập https://vercel.com bằng GitHub, chọn gói **Hobby**.
2. **Add New → Project → Import** repo vừa push. Framework được nhận diện tự động là Next.js, không cần sửa lệnh build.
3. **Environment Variables**: thêm cho cả 3 môi trường Production, Preview và Development:

   | Key | Giá trị |
   |---|---|
   | `MONGODB_URI` | connection string của Atlas (bước 1.5) |
   | `JWT_SECRET` | **chuỗi mới**, khác bản local: `openssl rand -base64 32` |
   | `DEEPSEEK_API_KEY` | key mới |
   | `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` |
   | `DEEPSEEK_MODEL` | `deepseek-chat` |
   | `FAL_KEY` | key mới |

4. **Settings → Functions → Function Region → Singapore (`sin1`)**. Mặc định là Mỹ; để Mỹ thì mỗi lần gọi Atlas ở Singapore sẽ chậm thêm vài trăm ms.
5. **Deploy**. Xong sẽ có link `https://<project>.vercel.app`.
6. Có thể đổi tên link: **Settings → Domains**, sửa thành `<tên-bạn-chọn>.vercel.app` nếu tên đó còn trống.

Không cần thêm `vercel.ts` hay `vercel.json`, vì mặc định đã chạy được. Route `/api/chat` tự khai báo `maxDuration = 120`, nằm trong giới hạn 300 s của gói Hobby.

## 3. Kiểm tra sau deploy

- [ ] Mở link ở cửa sổ ẩn danh, đăng ký một username mới và đăng nhập.
- [ ] Chat thường: câu trả lời được stream dần.
- [ ] Nhắn "vẽ cho mình một con mèo": model tự tạo ảnh, có **Show prompt**.
- [ ] Nhắn tiếp "đội cho nó cái mũ": ảnh được sửa từ ảnh cũ.
- [ ] Đính kèm một PDF nhỏ hơn 4 MB và một ảnh rồi hỏi về nội dung.
- [ ] Hỏi "giá vàng hôm nay": có dòng "Searching the web…" và nút **Sources** dưới câu trả lời.
- [ ] Sidebar → **Create a GPT**: chat với GPT Builder ở tab Create, chỉnh ở tab Configure, tải lên một
      file Knowledge, bấm **Generate** ảnh đại diện, thử ở khung Preview, rồi bấm **Create**.
- [ ] Bấm **Share → Anyone with the link → Copy link**, mở link ở cửa sổ ẩn danh bằng một tài khoản khác:
      chưa đăng nhập thì bị chuyển sang trang đăng nhập rồi quay lại GPT; GPT hiện ở sidebar với "By <tác giả>".
- [ ] Mở lại GPT (biểu tượng bút chì), sửa, bấm **Update**, rồi xoá.
- [ ] Chuyển Light/Dark mode.
- [ ] Nếu có lỗi: xem **Vercel → Project → Logs** (lọc theo `/api/chat`).

## 4. Domain riêng từ GitHub Student Pack (tuỳ chọn)

1. https://education.github.com/pack → nhận domain free (Namecheap `.me`, Name.com hoặc `.tech`).
2. Vercel → **Settings → Domains → Add** `chadgpt.yourname.me`.
3. Ở trang quản lý DNS, thêm bản ghi mà Vercel hướng dẫn (thường là CNAME tới `cname.vercel-dns.com`). HTTPS được cấp tự động.
4. Lưu ý: domain chỉ free năm đầu. Nhớ ghi lại ngày hết hạn.

## 5. Giới hạn cần biết

| Giới hạn | Ảnh hưởng | Code đã xử lý |
|---|---|---|
| Vercel: request body tối đa **4,5 MB** | Upload file / gửi ảnh lớn | File tối đa **4 MB**. Ảnh lớn hơn 300 KB được nén xuống tối đa 1568 px (WebP). Mỗi request chỉ gửi lại 4 ảnh gần nhất |
| Vercel Hobby: chỉ dùng phi thương mại | Không được bán, không chạy quảng cáo | Không áp dụng |
| Atlas M0: 512 MB, tạm dừng sau 30 ngày không có kết nối | Lâu không ai vào thì phải bấm Resume trong Atlas | Không áp dụng |
| Link ảnh fal.ai có thể hết hạn | Ảnh cũ trong chat có thể không hiện | Chat vốn chỉ lưu trong bộ nhớ trình duyệt, reload là mất |
| DeepSeek / fal tính tiền theo lượt | Link công khai có thể bị dùng tốn tiền | Xem mục 6 |

## 6. Bảo vệ chi phí (nên làm trước khi chia sẻ link rộng)

Hiện tại **ai có link cũng đăng ký được**, và người dùng GPT bạn chia sẻ cũng tiêu credit của bạn. Có các cách sau, xếp theo mức độ dễ làm:

1. **Giới hạn số dư** ở DeepSeek và fal (đã nêu ở mục 0). Không cần sửa code.
2. **Mã mời khi đăng ký**: thêm biến môi trường `SIGNUP_CODE`; form đăng ký yêu cầu nhập đúng mã. Khoảng 20 dòng code. *Chưa làm, cứ bảo là mình làm.*
3. **Giới hạn tần suất (rate limit)** theo user, ví dụ 30 tin nhắn/giờ và 10 ảnh/giờ. Có thể lưu bộ đếm trong MongoDB. *Chưa làm.*
4. **Vercel Firewall**: thêm rule rate limit cho `/api/chat` ở dashboard. Không cần sửa code.

## 7. Vận hành hằng ngày

- Sửa code → `git push` → Vercel tự build và deploy. Mỗi pull request có một preview URL riêng.
- Muốn quay lại bản cũ: Vercel → **Deployments** → chọn bản trước → **Promote to Production**.
- Đổi key: sửa trong **Settings → Environment Variables**, rồi **Redeploy**.
- Theo dõi chi tiêu: dashboard của DeepSeek (platform.deepseek.com) và fal (fal.ai/dashboard).

## 8. Deploy thẳng từ máy local

Có 3 mức, từ nhanh nhất đến bền nhất. Mọi lệnh chạy trong PowerShell ở thư mục dự án.

### 8a. Chạy bản production ở máy (chỉ mình bạn dùng)
```powershell
docker compose up -d          # MongoDB local
npm install
npm run build                 # build production (tốn ~1–2 GB RAM, nên tắt bớt app khác)
npm start                     # http://localhost:3000
```
Người khác cùng Wi-Fi vào được qua `http://<IP-máy-bạn>:3000`. Xem IP bằng `ipconfig`, rồi cho phép
Node.js qua Windows Firewall khi được hỏi.

### 8b. Chia sẻ máy local ra Internet tạm thời (Cloudflare Quick Tunnel, free, không cần tài khoản)
Hợp để demo nhanh. Link chỉ sống khi máy bạn đang bật và lệnh đang chạy.
```powershell
winget install --id Cloudflare.cloudflared      # cài một lần
npm run build; npm start                        # cửa sổ 1
cloudflared tunnel --url http://localhost:3000  # cửa sổ 2 → in ra https://<random>.trycloudflare.com
```
- Gửi link `trycloudflare.com` cho người khác là họ vào được. Mỗi lần chạy lại thì link đổi.
- Database vẫn là MongoDB trong Docker trên máy bạn. Tắt máy thì web cũng tắt.
- Cookie đăng nhập dùng `secure` khi chạy production. Tunnel là HTTPS nên vẫn đăng nhập bình thường.

### 8c. Đẩy code từ máy lên Vercel bằng CLI (link cố định, không cần GitHub)
Làm **mục 1 (MongoDB Atlas)** trước để có `MONGODB_URI` trên cloud, vì Vercel không truy cập được Docker trên máy bạn.
```powershell
npm i -g vercel               # cài Vercel CLI một lần
vercel login                  # đăng nhập trên trình duyệt
vercel link                   # tạo/gắn project (chọn scope cá nhân, tên "chadgpt")

# Thêm biến môi trường cho Production (mỗi lệnh sẽ hỏi giá trị; dán vào rồi Enter)
vercel env add MONGODB_URI production
vercel env add JWT_SECRET production
vercel env add DEEPSEEK_API_KEY production
vercel env add DEEPSEEK_BASE_URL production     # https://api.deepseek.com
vercel env add DEEPSEEK_MODEL production        # deepseek-chat
vercel env add FAL_KEY production

vercel --prod                 # build trên server Vercel và deploy → in ra https://chadgpt-xxx.vercel.app
```
- Lần sau sửa code chỉ cần chạy lại `vercel --prod`.
- Đặt region Singapore như mục 2.4 (Settings → Functions) để gần Atlas.
- Sau này muốn tự deploy khi `git push` thì kết nối repo GitHub trong **Settings → Git**.

---

## Phương án B: Supabase thay cho MongoDB Atlas

Dùng khi muốn gom mọi thứ về Supabase (ví dụ sau này cần Auth hoặc Storage của Supabase).

- Phải viết lại `lib/db.ts`, `models/User.ts`, `models/Gpt.ts` và các route `api/auth/*`, `api/gpts/*` theo Postgres (dùng `postgres` hoặc `@supabase/supabase-js`). Ước tính 2–3 giờ.
- Bản free: database 500 MB, tối đa 2 project. **Tự tạm dừng sau 7 ngày không có truy cập DB.** Link demo dễ "chết" nếu ít người dùng.
- Kết luận: chỉ đáng làm khi thật sự cần tính năng riêng của Supabase.

## Phương án C: Google Cloud Run (dùng $300 credit)

Dùng khi cần thứ mà Vercel Hobby không cho phép, ví dụ request body lớn hơn 4,5 MB hoặc chạy dạng container.

1. Thêm `output: "standalone"` vào `next.config.ts` và viết `Dockerfile` (multi-stage, `node:24-slim`).
2. Chạy `gcloud run deploy chadgpt --source . --region asia-southeast1 --allow-unauthenticated`, rồi truyền các biến môi trường như mục 2 (nên lưu secret bằng Secret Manager).
3. Database vẫn dùng Atlas M0, hoặc MongoDB trên một VM e2-micro (VM free tier ở region Mỹ).
4. Nhược điểm: $300 chỉ dùng được 90 ngày. Sau đó Cloud Run vẫn có free tier hằng tháng nhưng phải gắn thẻ thanh toán và tự theo dõi chi phí. Cấu hình phức tạp hơn Vercel.

## Tài liệu tham khảo

- Giới hạn Atlas M0: https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/
- Giá và gói free của Supabase: https://supabase.com/pricing
- Giới hạn Vercel Functions (body 4,5 MB): https://vercel.com/docs/functions/limitations
- GitHub Student Developer Pack: https://education.github.com/pack
