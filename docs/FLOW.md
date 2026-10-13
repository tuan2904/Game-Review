# GameReview — Flow dự án (tổng quan cho người mới)

Tài liệu này giải thích dự án là gì, gồm những chức năng gì, và mỗi loại người dùng đi như thế nào qua ứng dụng.

## Dự án này là gì?

GameReview là web **đánh giá game** kiểu "IMDb cho game":

- Người dùng đăng ký tài khoản, duyệt danh mục game, đọc/ghi nhận xét (review) kèm điểm số 1–5, bình luận, và "yêu thích" game.
- **Admin** quản lý danh mục và game (thêm/sửa/ẩn/xóa).
- Kiến trúc 2 lớp:
  - **Backend** `backend/` — Django 6 + Django REST Framework, JWT auth, PostgreSQL.
  - **Frontend** `frontend/` — React 19 + Vite, gọi API qua Axios.
- Mọi API nằm dưới `http://localhost:8000/api/v1/`, trả về envelope chuẩn:

```json
{ "success": true, "message": "...", "data": {} }
```

Lỗi tương ứng: `"success": false` + `"errors": {...}`.

## Các thực thể chính và quan hệ

```
Category (thể loại) 1 ──── N Game (game)
Game                1 ──── N Review (nhận xét)   ← mỗi user chỉ được 1 review/game, điểm 1–5
Review              1 ──── N Comment (bình luận)
User                1 ──── N Favorite (yêu thích) ← mỗi user chỉ favorite 1 lần/game
```

- **User** định danh bằng **email** (không có username).
- **Game** có `status`: `ACTIVE` (ai cũng thấy) hoặc `INACTIVE` (chỉ admin thấy).
- Xóa Category đang có Game, hoặc xóa Game đang có Review → bị chặn (trả 409).

## 3 loại người dùng

| Vai trò | Xác định bằng | Được làm gì |
|---|---|---|
| **Khách (chưa đăng nhập)** | — | Xem danh sách game, chi tiết game, đọc review/comment. Không ghi gì được. |
| **User thường** | đăng nhập | Toàn quyền khách + viết review, comment, favorite, sửa/xóa nội dung của chính mình. |
| **Admin** | `is_staff=true` | Quản lý game + category, thấy game INACTIVE, sửa/xóa review/comment của bất kỳ ai (kiểm duyệt). |

## Flow từng trang (Frontend)

Đường dẫn app chạy ở `http://localhost:5173`.

### 1. Khách chưa đăng nhập

```
/ (Trang chủ)
 └─→ /games (Danh sách game)
       │   • Tìm kiếm theo tên/mô tả/ns/phát hành
       │   • Lọc theo thể loại, sắp xếp, phân trang (12/trang)
       │
       ├─→ /games/:slug (Chi tiết game)
       │     • Thông tin game + danh sách review (mới nhất trước)
       │     • Mỗi review có bình luận bên dưới
       │     • Bấm ❤ Favorite hoặc "Viết review" → bị đá về /login
       │
       ├─→ /login    (đăng nhập)
       └─→ /register (đăng ký → xong tự đăng nhập luôn)
```

- Trang `/favorites`, `/profile` → bắt buộc đăng nhập, sẽ giữ trang hiện tại để quay lại sau khi login.
- Trang `/admin/*` → bắt buộc là admin.

### 2. User đã đăng nhập

Ngoài các flow trên, user được:

```
/games/:slug
  ├─ "Viết review"     → chọn điểm 1–5 + nội dung → POST review
  │                       (một game chỉ review được 1 lần)
  │                       → review của mình có nút Sửa / Xóa
  ├─ Gõ bình luận      → POST comment dưới bất kỳ review nào
  │                       → comment của mình có nút Sửa / Xóa
  └─ Bấm ❤              → toggle favorite (thêm/bỏ yêu thích)

/favorites  → lưới các game đã yêu thích, bỏ favorite tại chỗ
/profile    → xem thông tin tài khoản (trang đơn giản)
Logout      → gửi refresh token vào blacklist, xóa session local
```

### 3. Admin (`is_staff`)

Menu trên cùng có thêm mục **Admin**:

```
/admin                → bảng điều khiển (chưa có số liệu thống kê)
/admin/categories     → CRUD thể loại (inline form)
/admin/games          → danh sách TẤT CẢ game (kể cả INACTIVE)
                        • tìm kiếm, lọc theo status
                        • bật/tắt ACTIVE/INACTIVE (ẩn/hiện game)
                        • xóa (bị 409 nếu còn review trỏ tới)
/admin/games/new      → tạo game mới
/admin/games/:slug/edit → sửa game
```

Ngoài ra admin còn **kiểm duyệt** ngay trên trang chi tiết game: sửa/xóa review hoặc comment của bất kỳ user nào.

## Flow API tóm tắt (Backend)

Tất cả endpoint dưới `/api/v1/`:

| Nhóm | Endpoint chính | Ghi chú |
|---|---|---|
| Auth | `POST /auth/register/`, `POST /auth/login/`, `POST /auth/refresh/`, `POST /auth/logout/`, `GET /auth/me/` | JWT: access 30 phút, refresh 7 ngày (xoay vòng + blacklist) |
| Game | `GET/POST /games/`, `GET /games/{slug}/`, `PATCH/DELETE /games/{id}/` | GET công khai; POST/PATCH/DELETE **admin-only** |
| Category | `GET/POST /categories/`, `PATCH/DELETE /categories/{id}/` | như trên |
| Review | `GET/POST /games/{slug}/reviews/`, `PATCH/DELETE /reviews/{id}/` | POST cần đăng nhập; sửa/xóa chỉ chủ bài hoặc admin |
| Comment | `GET/POST /reviews/{id}/comments/`, `PATCH/DELETE /comments/{id}/` | như review |
| Favorite | `POST/DELETE /games/{slug}/favorite/`, `GET /me/favorites/` | xóa là idempotent (xóa again vẫn 200) |
| Health | `GET /health/` | kiểm tra app + DB sống |

**Quy tắc nghiệp vụ quan trọng nhất:**

- 1 user chỉ có **1 review** cho 1 game (trùng → 409).
- Điểm review phải trong khoảng **1–5**.
- 1 user chỉ **1 favorite** cho 1 game (trùng → 409).
- Không thể xóa game/category đang được tham chiếu (409).
- Game `INACTIVE` ẩn với mọi người ngoài admin.

## Cách chạy dự án (dev)

```bash
# 1. DB (PostgreSQL 17 trong Docker, port 5433)
docker compose up -d db

# 2. Backend (port 8000) — cần sửa backend/.env trỏ DB_HOST=127.0.0.1, DB_PORT=5433
cd backend
.venv/bin/python manage.py migrate
.venv/bin/python manage.py runserver

# 3. Frontend (port 5173)
cd frontend
npm install
npm run dev
```

Mở `http://localhost:5173` (dùng `localhost` chứ không phải `127.0.0.1` để tránh lỗi CORS nếu chưa whitelist).

## Vòng đời xác thực (JWT) —发生的 ở đâu

1. **Login** → server trả `{access, refresh, user}`.
2. Frontend giữ **access token trong bộ nhớ** (module variable), **refresh token trong `sessionStorage`** (key `gamereview.refresh`).
3. Mỗi request API đính kèm `Authorization: Bearer <access>`.
4. Access hết hạn (30 phút) → client tự gọi `/auth/refresh/` (một lần duy nhất cho song song), nhận token mới, retry request cũ.
5. Refresh hết hạn hoặc bị blacklist → session bị xóa, user về trạng thái đăng nhập.
6. **Logout** → gửi refresh token lên `/auth/logout/` để blacklist, rồi xóa local.

## Tóm lại một vòng đời điển hình

```
Khách → duyệt game → đăng ký → đăng nhập
     → vào game → viết review (1–5*) → comment qua lại → favorite game
Admin → thêm game mới (ACTIVE) → ẩn game (INACTIVE) khi cần
      → kiểm duyệt review/comment sai → xóa game cũ khi không còn review
```
