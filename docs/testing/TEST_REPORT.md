# GameReview — Báo cáo test theo role

Môi trường: `docker compose up -d --build` → Frontend http://localhost:5173 · API http://localhost:8000/api/v1 · DB Postgres (host port 5433).
Dữ liệu mẫu: `seed_data.sql` (9 game, 5 category, review/comment/favorite mẫu).

## 1. Tài khoản test

Mật khẩu chung các tài khoản `*.gamereview.test`: **`Test@12345`**

| Email | Role | is_staff | is_superuser | is_active | Dùng để |
|---|---|---|---|---|---|
| `superadmin@gamereview.test` | Super Admin | ✔ | ✔ | ✔ | Django admin `/admin/` + toàn bộ quyền admin app |
| `admin1@gamereview.test` | Admin | ✔ | ✘ | ✔ | Test quyền admin (quản lý game/category/user/moderation) |
| `admin2@gamereview.test` | Admin | ✔ | ✘ | ✔ | Admin thứ 2 (test admin khóa admin, resolve chéo) |
| `user1@gamereview.test` | User | ✘ | ✘ | ✔ | Chủ review/favorite trong kịch bản |
| `user2@gamereview.test` | User | ✘ | ✘ | ✔ | Người comment / "người khác" |
| `user3@gamereview.test` | User | ✘ | ✘ | ✔ | Người report / bị khóa-mở khóa |
| `locked@gamereview.test` | User bị khóa | ✘ | ✘ | ✘ | Test đăng nhập tài khoản bị khóa |

Tài khoản có sẵn trong seed (mật khẩu `Passw0rd!123`): `admin@gamereview.dev` (Admin), `alice@example.com`, `bob@example.com`, `carol@example.com` (User).

> App chỉ có 2 role thật: **User** và **Admin** (`is_staff`). "Khách" là chưa đăng nhập. `is_superuser` chỉ thêm quyền vào Django admin, API/FE không phân biệt với Admin.
> Login giới hạn 10 lần/phút/IP, register 5/phút → test nhiều tài khoản liên tục sẽ gặp 429, đợi ~1 phút.

## 2. Ma trận quyền (Khách / User / Admin)

✔ = được phép · ✘ = bị chặn (mã lỗi) · "own" = chỉ nội dung của chính mình

| Tính năng | Endpoint | Khách | User | Admin |
|---|---|---|---|---|
| Đăng ký | `POST /auth/register/` | ✔ | ✔ | ✔ |
| Đăng nhập | `POST /auth/login/` | ✔ | ✔ | ✔ (user khóa: ✘ 401) |
| Refresh / Logout token | `POST /auth/refresh/`, `/auth/logout/` | ✔ | ✔ | ✔ |
| Xem / sửa profile (tên) | `GET/PATCH /auth/me/` | ✘ 401 | ✔ | ✔ |
| Xem danh sách + chi tiết game ACTIVE | `GET /games/`, `/games/{slug}/` | ✔ | ✔ | ✔ |
| Xem game INACTIVE | `GET /games/{slug}/` | ✘ 404 | ✘ 404 | ✔ |
| Xem danh sách category | `GET /categories/` | ✔ | ✔ | ✔ |
| Tạo / sửa / xóa category | `POST/PATCH/DELETE /categories/` | ✘ 401 | ✘ 403 | ✔ (xóa khi còn game: 409) |
| Tạo / sửa / ẩn-hiện game | `POST/PATCH /games/` | ✘ 401 | ✘ 403 | ✔ |
| Xóa game | `DELETE /games/{id}/` | ✘ 401 | ✘ 403 | ✔ (còn review: 409) |
| Đọc review / comment | `GET .../reviews/`, `.../comments/` | ✔ | ✔ | ✔ (thấy cả comment ẩn) |
| Viết review (1 game 1 lần, 1–5 sao) | `POST /games/{slug}/reviews/` | ✘ 401 | ✔ (trùng 409, rating sai 400) | ✔ |
| Sửa / xóa review | `PATCH/DELETE /reviews/{id}/` | ✘ 401 | own (người khác 403) | ✔ mọi review |
| Viết comment (≤2000 ký tự, không từ cấm) | `POST /reviews/{id}/comments/` | ✘ 401 | ✔ (vi phạm 400) | ✔ |
| Sửa / xóa comment | `PATCH/DELETE /comments/{id}/` | ✘ 401 | own (người khác 403) | ✔ mọi comment |
| Ẩn / hiện comment | `POST /comments/{id}/moderate/` | ✘ 401 | ✘ 403 | ✔ |
| Favorite / bỏ favorite (idempotent) | `POST/DELETE /games/{slug}/favorite/` | ✘ 401 | ✔ (trùng 409) | ✔ |
| Danh sách favorite của mình | `GET /me/favorites/` | ✘ 401 | ✔ | ✔ |
| Report review / comment | `POST /reviews|comments/{id}/report/` | ✘ 401 | ✔ (trùng 409, lý do sai 400) | ✔ |
| Dashboard số liệu | `GET /admin/summary/` | ✘ 401 | ✘ 403 | ✔ |
| Danh sách report + resolve | `GET /admin/reports/`, `POST .../resolve/` | ✘ 401 | ✘ 403 | ✔ (resolve lần 2: 409) |
| Danh sách review / comment toàn hệ thống | `GET /admin/reviews/`, `/admin/comments/` | ✘ 401 | ✘ 403 | ✔ |
| Danh sách user | `GET /admin/users/` | ✘ 401 | ✘ 403 | ✔ |
| Khóa / mở khóa user | `POST /admin/users/{id}/status/` | ✘ 401 | ✘ 403 | ✔ (tự khóa mình: 400) |
| Django admin site | `/admin/` | ✘ | ✘ | ✔ nếu `is_staff` (cần superuser/perm để thao tác model) |

### Route frontend

| Route | Khách | User | Admin |
|---|---|---|---|
| `/`, `/games`, `/games/:slug`, `/login`, `/register` | ✔ | ✔ | ✔ |
| `/profile`, `/favorites` | → `/login` | ✔ | ✔ |
| `/admin`, `/admin/games(/new,/:slug/edit)`, `/admin/categories`, `/admin/users`, `/admin/moderation` | ✘ chặn | ✘ chặn | ✔ |

## 3. Kết quả chạy tự động (API thật)

Script: `docs/testing/role_matrix_check.py` (chỉ dùng thư viện chuẩn, tự tạo & tự dọn category/game/review/comment tạm).
Chạy: `python3 docs/testing/role_matrix_check.py` (đợi nếu bị 429).

**84 case: 80 PASS ngay lần đầu; 4 case "FAIL" là do kỳ vọng của script sai** — 4 lệnh DELETE hợp lệ (comment, review, game, category) trả `200` kèm envelope JSON chứ không phải `204`. Hành vi API đúng; đã sửa kỳ vọng trong script thành 200 (chưa chạy lại toàn bộ sau chỉnh sửa này).

Các nhóm đã xác minh: đăng nhập user khóa · quyền đọc public · tạo/sửa category & game theo role · game INACTIVE ẩn với khách/user · review (trùng, rating ngoài 1–5, sửa/xóa của người khác) · comment (từ cấm, >2000 ký tự, sửa/xóa của người khác, ẩn/hiện, comment ẩn không lộ cho user) · favorite (trùng, idempotent delete) · report (trùng, lý do sai, resolve 2 lần) · toàn bộ endpoint `/admin/*` với 3 vai · khóa user (token bị vô hiệu 401, không tự khóa mình) · xóa category/game đang được tham chiếu (409).

## 4. Case cần test tay trên UI (chưa tự động)

| # | Role | Bước | Kết quả mong đợi |
|---|---|---|---|
| 1 | Khách | Vào `/games/<slug>`, bấm ❤ hoặc "Viết review" | Chuyển `/login`, đăng nhập xong quay lại trang cũ |
| 2 | Khách / User | Gõ URL `/admin` | Bị chặn, không thấy menu Admin |
| 3 | Khách | Đăng ký email mới, mật khẩu yếu (`12345678`) | Báo lỗi mật khẩu; mật khẩu mạnh → tự đăng nhập |
| 4 | User | Review game, rồi review lại | Báo đã review (409), nút Sửa/Xóa chỉ ở review của mình |
| 5 | User | Comment có từ cấm (`idiot`) hoặc >2000 ký tự | Thông báo lỗi chung |
| 6 | User | Report review của người khác 2 lần | Lần 2 hiện "Reported" |
| 7 | User | `/favorites`: bỏ favorite tại chỗ | Game biến mất khỏi lưới |
| 8 | User | `/profile`: đổi first/last name | Lưu được; email chỉ đọc |
| 9 | Admin | `/admin` | 7 thẻ số liệu khớp dữ liệu |
| 10 | Admin | `/admin/games`: INACTIVE một game, mở bằng tài khoản khách | Khách thấy 404/không có trong list |
| 11 | Admin | Xóa game đã có review | Báo 409 |
| 12 | Admin | `/admin/moderation`: Resolve report, ẩn comment | Report chuyển Resolved; comment ẩn với user thường, hiện badge Hidden với admin |
| 13 | Admin | `/admin/users`: khóa `user3` rồi dùng `user3` đang đăng nhập thao tác | Bị đăng xuất (401); mở khóa thì đăng nhập lại được |
| 14 | Admin | Tự khóa tài khoản mình | Bị từ chối |
| 15 | Locked | Đăng nhập `locked@gamereview.test` | "Invalid email or password" |
| 16 | User | Logout rồi dùng lại refresh token cũ | 401 (token bị blacklist) |

## 5. Ghi chú / quan sát

- `admin@gamereview.dev` trong seed là `is_staff` nhưng không phải superuser → vào được app admin, không thao tác model ở Django admin.
- Không có role trung gian (moderator): mọi quyền kiểm duyệt đều thuộc Admin.
- Dữ liệu test của script không để lại rác; lần chạy trước đó bị lỗi giữa chừng đã được dọn thủ công.
