# GameReview — Full Source Audit & Implementation Roadmap

- **Ngày audit:** 2026-10-19
- **Phạm vi:** toàn bộ source hiện có (backend Django/DRF + frontend React/Vite), docs, migrations, cấu hình.
- **Nguyên tắc:** chỉ đọc và kiểm tra. **Không sửa source, không tạo migration, không đổi database.**
- **Cách xác minh:** đọc trực tiếp model/serializer/view/url/permission, đọc React pages/components/contexts/api client, chạy các lệnh kiểm tra khả dụng trong môi trường hiện tại.

> Trạng thái dùng trong báo cáo: **PASS / PARTIAL / MISSING / FAIL / UNVERIFIED**.
> Một chức năng chỉ được coi là PASS khi đã đọc code và (khi có thể) chạy kiểm tra xác nhận.

---

## Phần 1 — Executive Summary

### Trạng thái tổng thể

Dự án là một MVP fullstack hoàn chỉnh về **chức năng nghiệp vụ cốt lõi**: authentication JWT, game/category, review, comment, favorite, admin UI, cùng nền tảng hạ tầng chung (envelope, exception handler, pagination, filtering, permissions). Kiến trúc backend rõ ràng, nhất quán và phù hợp quy mô đồ án (View → Serializer → ORM, không over-engineer). Frontend React tổ chức tốt, tách api/context/component/page hợp lý.

**Tuy nhiên, có hai vấn đề lớn làm thay đổi bản chất đánh giá:**

1. **Toàn bộ test đã biến mất khỏi repository.** Không có bất kỳ file test backend hay frontend nào được track trong git; `pytest/docs/test scaffolding` và `vitest/testing-library` thậm chí không nằm trong dependency. Trong khi đó README và `docs/PROJECT_PLAN.md` khẳng định "242 backend tests" và "154 frontend tests" đã pass ở các phase trước. Đây là sai lệch nghiêm trọng giữa tài liệu và source thực tế, đồng thời khiến cho mọi tuyên bố "PASS" về chất lượng trở nên không thể kiểm chứng.
2. **Kiểm duyệt nội dung (comment moderation) hoàn toàn chưa có.** Không có bộ lọc từ nhạy cảm, không có trạng thái ẩn/đánh dấu, không có hàng đợi kiểm duyệt, không giới hạn độ dài. Đây là yêu cầu trọng tâm của Hạng mục D và hiện là MISSING.

### Những điểm đã làm tốt

- **Authorization backend chắc và đúng hướng:** `IsAdmin`/`IsAdminOrReadOnly` dùng `is_staff`, `IsAdminOrOwner` dùng object-level owner `obj.user`, favorite luôn scope theo `request.user`, identity lấy từ token chứ không từ payload. Không tìm thấy lỗ hổng IDOR trực tiếp trong các endpoint hiện có (chi tiết ở Phần 4).
- **Enforcement phía server cho admin writes:** mọi write game/category đều `IsAdminOrReadOnly`; UI admin chỉ là UX-gating.
- **Envelope + exception handling thống nhất**, không lộ stack trace/SQL, logging tách biệt.
- **Ràng buộc DB thực sự biểu đạt business rule:** `UNIQUE(user, game)` cho review/favorite, `CHECK` rating 1–5, `CHECK` comment không blank, `PROTECT` ở các FK (`game`, `category`, `user`).
- **Slug an toàn:** auto-generate + chống trùng + chặn slug thuần số để tránh nhập nhằng với route `{id}`.
- **Frontend không lưu access token vào storage** (chỉ trong memory), refresh trong `sessionStorage`; không có `dangerouslySetInnerHTML`/`innerHTML`/`eval` → giảm rủi ro XSS.

### Rủi ro nghiêm trọng (xem chi tiết ở Phần 4/6/9)

- **P0-1 — Không có test nào trong repo** nhưng tài liệu báo đã có (242 + 154). Không có lưới an toàn regression, Phase 11 "Testing and Hardening" không thể hoàn thành dựa trên hiện trạng.
- **P0-2 — Không có throttling/rate limiting** cho `login`/`register` (đã ghi nhận là "future production concern" trong docs, nhưng đây là lỗ hổng brute-force/abuse thực tế). `settings.py` không có `DEFAULT_THROTTLE_*`.
- **P1-1 — Comment moderation MISSING:** text không giới hạn độ dài, không lọc từ nhạy cảm, không cơ chế ẩn/kiểm duyệt, không chống spam/lặp.
- **P1-2 — Thiếu quản lý tài khoản:** không có endpoint cập nhật profile; không có API khóa/mở khóa user; `Profile` frontend là placeholder.
- **P2 — Tài liệu lệch source:** README/PROJECT_PLAN/API.md mô tả test và trạng thái phase không khớp thực tế.

### Vấn đề cần giải quyết trước khi mở rộng tính năng

1. Xác lập lại **cơ sở test tối thiểu** (auth/permission/ownership/validation) trước khi thêm phase mới — nếu không, mọi phase sau đều không thể xác minh.
2. Bổ sung **rate limiting** cho auth.
3. Bổ sung **moderation comment cơ bản** (validate độ dài + từ khóa cấu hình + trạng thái ẩn).
4. Đồng bộ **tài liệu** với source thực tế.

---

## Phần 2 — Architecture Inventory

### 2.1 Cấu trúc backend

```
backend/
├── config/                     # settings, urls, wsgi/asgi
├── apps/
│   ├── common/                 # hạ tầng dùng chung
│   │   ├── responses.py        # success/error envelope
│   │   ├── exceptions.py       # AppException + api_exception_handler
│   │   ├── pagination.py       # DefaultPagination (envelope)
│   │   ├── filters.py          # ListQueryMixin (search/ordering/allowlist filter)
│   │   ├── permissions.py      # IsAdmin, IsAdminOrReadOnly, IsOwner, IsAdminOrOwner
│   │   └── serializers.py      # SafeUserSerializer {id, first_name, last_name}
│   ├── accounts/               # User (email-based), auth endpoints
│   ├── games/                  # Category, Game
│   ├── reviews/                # Review
│   ├── comments/               # Comment
│   └── favorites/              # Favorite
├── requirements.txt / requirements-dev.txt
└── pyproject.toml (ruff)
```

- Không có `services.py`/`repositories.py` — phù hợp quyết định pragmatic trong `docs/ARCHITECTURE.md` (chỉ thêm layer khi có logic thực sự).
- Không có `tests/` và không có `conftest.py` (xem Phần 7).

### 2.2 Cấu trúc frontend

```
frontend/src/
├── api/            client.js, auth.js, games.js, reviews.js, comments.js, favorites.js
├── components/
│   ├── common/     Button, Input, Pagination, Loading, ErrorMessage, EmptyState, PageContainer
│   ├── admin/      GameForm, CategoryForm
│   ├── comments/   ReviewComments, CommentForm, CommentItem
│   ├── favorites/  FavoriteToggle
│   ├── games/      GameCard
│   ├── layouts/    AppLayout
│   ├── reviews/    GameReviews, ReviewCard, ReviewForm
│   └── routes/     ProtectedRoute, AdminRoute
├── contexts/       AuthContext, FavoritesContext
├── pages/          Home, Games, GameDetail, Login, Register, Profile, Favorites, NotFound, admin/*
├── routes/         AppRoutes
├── types/          JSDoc typedefs
├── utils/          format.js
└── test/           (chỉ còn setup/helpers/fixtures — không có file *.test.*)
```

### 2.3 Luồng request React → Django

`Component/Page → api/*.js (wrapper) → client.js (Axios: Bearer, envelope unwrap, refresh single-flight) → /api/v1/... → DRF View → Serializer → ORM → PostgreSQL`.

- Client unwrap envelope `{success, message, data|errors}` thành `data` hoặc ném `ApiError{status, message, errors}` (`client.js:96-120`).
- 401 → single-flight refresh, retry tối đa 1 lần, auth endpoints không kích hoạt refresh (`client.js:139-208`).

### 2.4 Authentication & Authorization

- **JWT** (SimpleJWT): access 30 phút, refresh 7 ngày, rotate + blacklist (`settings.py:130-137`).
- Default permission toàn cục: `IsAuthenticatedOrReadOnly` (`settings.py:120-122`).
- SimpleJWT kiểm tra `CHECK_USER_IS_ACTIVE` (mặc định True) → tài khoản `is_active=False` bị từ chối ngay cả khi token còn hạn (đã xác minh trong `rest_framework_simplejwt/authentication.py:138`, `:183`).
- Vai trò thực tế: Guest / User (`is_active`, không staff) / Admin (`is_staff`). `is_superuser` **không** được dùng riêng trong permission (chỉ `is_staff`), trừ Django admin site.

### 2.5 Envelope / Exception / Pagination / Filtering

- Envelope thống nhất (`common/responses.py`).
- Handler toàn cục map AppException, DRF APIException, Http404/PermissionDenied, còn lại → 500 generic (`common/exceptions.py:44-73`).
- Pagination page-number, `data.items` + `data.pagination`, 404 khi vượt trang (`common/pagination.py`).
- `ListQueryMixin` allowlist filter/search/ordering (`common/filters.py`).

### 2.6 Model relations

```
Category 1─N Game 1─N Review 1─N Comment
User 1─N Review / Comment / Favorite
Favorite: UNIQUE(user, game)
```
Tất cả FK quan trọng dùng `PROTECT` (không silent cascade).

### 2.7 Đánh giá kiến trúc

Kiến trúc **phù hợp** quy mô đồ án. Không nên viết lại. Điểm cần cải thiện là kỷ luật khai báo permission tường minh (một số view dựa vào default toàn cục) và bổ sung layer test — không phải đổi kiến trúc.

---

## Phần 3 — Feature Matrix

| Module | Chức năng | Trạng thái | Bằng chứng | Vấn đề | Hành động tiếp theo |
|---|---|---|---|---|---|
| Accounts | Register | PASS | `accounts/views.py:20-29`, `serializers.py:22-43` | Chỉ field an toàn; không nhận `is_staff` | — |
| Accounts | Login | PASS | `views.py:32-41`, `LoginSerializer` | Thông báo lỗi generic, chống enumeration | Thêm throttling |
| Accounts | Refresh (rotate+blacklist) | PASS | `views.py:44-48`, `settings.py:130-137` | — | — |
| Accounts | Logout (blacklist) | PASS | `views.py:51-59`, `LogoutSerializer` | Endpoint public (by design) | — |
| Accounts | Me | PASS | `views.py:62-68` | — | — |
| Accounts | Update profile / đổi mật khẩu | MISSING | Không có endpoint; `pages/Profile.jsx` placeholder | Người dùng không sửa được gì | Phase profile |
| Accounts | Quản lý user (list/lock/unlock) | MISSING | Không có endpoint/UI | Không có admin user management | Phase admin |
| Games | List + search + filter + pagination | PASS | `games/views.py:13-26`, `filters.py` | `status` chỉ hữu ích cho staff | — |
| Games | Detail theo slug | PASS | `games/views.py:35-48` | Ẩn INACTIVE với non-staff | — |
| Games | Create (admin) | PASS | `games/views.py:28-32` | Validate đầy đủ, slug tự sinh | Bổ sung test |
| Games | Update/PATCH (admin) | PASS | `games/views.py:51-68` | — | — |
| Games | Delete (admin, chặn khi có review) | PASS | `games/views.py:70-75` | 409 an toàn | — |
| Games | Status ACTIVE/INACTIVE | PASS | `models.py:25-50`, `GameManager.visible_to` | — | — |
| Games | Cover image upload | MISSING | Chỉ `URLField` (`models.py:36`) | Chỉ nhập URL, không upload file | P3 |
| Category | CRUD | PASS | `games/views.py:78-118`, `serializers.py:23-37` | Delete chặn khi có game (409) | Bổ sung test |
| Reviews | List theo game (public, paginated) | PASS | `reviews/views.py:12-24` | Cố định `-created_at` | Có thể thêm sort/filter |
| Reviews | Create (auth, 1/game) | PASS | `views.py:26-33`, `serializers.py:34-38` | 409 khi trùng (DB constraint) | Bổ sung test |
| Reviews | Update/Delete (owner/admin) | PASS | `views.py:36-57` | `IsAdminOrOwner` | Bổ sung test |
| Reviews | Rating trung bình / tổng review | MISSING | Không có cột/endpoint (deferred có chủ đích) | Chưa có consumer | P2/P3 |
| Comments | List (public, paginated) | PASS | `comments/views.py:13-27` | Kế thừa visibility game | Bổ sung test |
| Comments | Create/Update/Delete (owner/admin) | PASS | `views.py:29-60` | Drf trim + DB check | Bổ sung test |
| Comments | Moderation / từ nhạy cảm / ẩn | MISSING | Không có field `is_hidden`, không filter | Yêu cầu Hạng mục D | **Phase moderation** |
| Comments | Giới hạn độ dài / chống spam | MISSING | `content = TextField()` không `max_length` | Spam/abuse | Phase moderation |
| Favorites | Add/Remove/List | PASS | `favorites/views.py:11-56` | Scope theo user, DELETE idempotent | Bổ sung test |
| Favorites | Status per-game | MISSING | Không có field/endpoint (by design) | Frontend suy ra từ set | P3 |
| Admin UI | Dashboard/lists/forms | PASS (nav-only) | `pages/admin/*`, `AdminRoute.jsx` | Không có metrics (backend không có endpoint) | P3 |
| Admin UI | Review/comment moderation queue | MISSING | Không có endpoint global | Cần backend trước | Phase moderation |
| Infra | Envelope/exception/pagination/filter | PASS | `apps/common/*` | — | Bổ sung test |
| Infra | Rate limiting | MISSING | Không cấu hình throttle | Brute-force auth | **P0** |
| Test | Backend + frontend | MISSING | Không file test; thiếu dependency | Rủi ro regression | **P0** |
| Docs | Đồng bộ với source | PARTIAL | README/PROJECT_PLAN/API.md | Báo "242 + 154" test không tồn tại | Cập nhật docs |

---

## Phần 4 — Authorization Audit

### 4.1 Ma trận vai trò

| Vai trò | Xác định bằng | Ghi chú |
|---|---|---|
| Guest | Chưa đăng nhập | Chỉ đọc (SAFE_METHODS) |
| User | `is_authenticated`, `is_active=True`, `is_staff=False` | Đọc + ghi dữ liệu của mình |
| Admin/Staff | `is_staff=True` | Toàn quyền write game/category + sửa/xóa mọi review/comment |

`is_superuser` không cấp thêm quyền API nào ngoài `is_staff` (Django admin site dùng `is_staff` để vào).

### 4.2 Bảng endpoint & quyền

| Method | URL | Permission hiện tại | Guest | User | Admin | Trạng thái |
|---|---|---|---|---|---|---|
| GET | `/health/` | `[]` (không auth) | ✓ | ✓ | ✓ | PASS |
| POST | `/auth/register/` | `AllowAny` | ✓ | ✓ | ✓ | PASS |
| POST | `/auth/login/` | `AllowAny` (default) | ✓ | ✓ | ✓ | PASS (thiếu throttle) |
| POST | `/auth/refresh/` | `AllowAny` (default) | ✓ | ✓ | ✓ | PASS |
| POST | `/auth/logout/` | `AllowAny` | ✓ | ✓ | ✓ | PASS |
| GET | `/auth/me/` | `IsAuthenticated` | 401 | ✓ | ✓ | PASS |
| GET | `/games/` | `IsAdminOrReadOnly` (read) | ✓ | ✓ | ✓ | PASS |
| POST | `/games/` | `IsAdminOrReadOnly` (write) | 401 | 403 | ✓ | PASS |
| GET | `/games/{slug}/` | `IsAdminOrReadOnly` (read) | ✓ | ✓ | ✓ | PASS |
| PATCH/DELETE | `/games/{id}/` | `IsAdminOrReadOnly` | 401 | 403 | ✓ | PASS |
| GET | `/categories/` | `IsAdminOrReadOnly` (read) | ✓ | ✓ | ✓ | PASS |
| POST | `/categories/` | `IsAdminOrReadOnly` | 401 | 403 | ✓ | PASS |
| PATCH/DELETE | `/categories/{id}/` | `IsAdminOrReadOnly` | 401 | 403 | ✓ | PASS |
| GET | `/games/{slug}/reviews/` | default `IsAuthenticatedOrReadOnly` | ✓ | ✓ | ✓ | PASS |
| POST | `/games/{slug}/reviews/` | default `IsAuthenticatedOrReadOnly` | 401 | ✓ | ✓ | PASS |
| PATCH/DELETE | `/reviews/{id}/` | `IsAdminOrOwner` | 401 | owner ✓ / other 403 | ✓ | PASS |
| GET | `/reviews/{id}/comments/` | default `IsAuthenticatedOrReadOnly` | ✓ | ✓ | ✓ | PASS |
| POST | `/reviews/{id}/comments/` | default `IsAuthenticatedOrReadOnly` | 401 | ✓ | ✓ | PASS |
| PATCH/DELETE | `/comments/{id}/` | `IsAdminOrOwner` | 401 | owner ✓ / other 403 | ✓ | PASS |
| POST | `/games/{slug}/favorite/` | default `IsAuthenticatedOrReadOnly` (non-safe → auth) | 401 | ✓ | ✓ | PASS |
| DELETE | `/games/{slug}/favorite/` | default `IsAuthenticatedOrReadOnly` | 401 | ✓ | ✓ | PASS |
| GET | `/me/favorites/` | `IsAuthenticated` | 401 | ✓ (chỉ của mình) | ✓ | PASS |

### 4.3 Kiểm tra các rủi ro theo yêu cầu

| Rủi ro | Kết quả | Bằng chứng |
|---|---|---|
| Ẩn nút frontend nhưng API vẫn cho phép | **Không** — server tự enforce write | `games/views.py:16,38,54,81,96`; `AdminRoute.jsx:33` là UX-only |
| User sửa/xóa dữ liệu người khác | **Không** — `IsAdminOrOwner` object-level | `common/permissions.py:46-59`; `reviews/views.py:39`; `comments/views.py:42` |
| User gửi `is_staff`/`is_superuser` | **Không** — field không nằm trong serializer | `accounts/serializers.py:28-31`, `:15-19` (is_staff read-only) |
| Đổi ID để truy cập dữ liệu người khác | **Không** — favorite scope `request.user`; review/comment dùng owner check | `favorites/views.py:41,52-55` |
| Admin API không kiểm tra quyền backend | **Không** — luôn `IsAdminOrReadOnly` | `games/views.py` |
| Tài khoản bị vô hiệu hóa vẫn thao tác | **Không** — SimpleJWT từ chối `is_active=False` | `authentication.py:138,183`; login cũng từ chối generic 401 |
| Refresh/logout/blacklist không nhất quán | **Không** — rotate + blacklist nhất quán | `settings.py:133-134`; `accounts/serializers.py:57-64` |
| Quyền frontend lệch backend | **Không** (đã đối chiếu) | `AdminRoute`, `ProtectedRoute`, điều kiện owner trong `ReviewCard`/`CommentItem` |

### 4.4 Điểm cần lưu ý / chưa xác minh

- **Một số view không khai báo `permission_classes` tường minh** mà dựa vào default toàn cục (`GameReviewListCreateView`, `CommentListCreateView`, `GameFavoriteView`). Hiện đúng, nhưng dễ vỡ nếu default toàn cục bị đổi. Đề xuất khai báo tường minh (không phải lỗi bảo mật hiện tại).
- **Không có throttling** ở login/register (`settings.py` không có `DEFAULT_THROTTLE_CLASSES`). Đây là lỗ hổng brute-force thực tế → P0.
- **Không có test permission** để khóa hành vi (xem Phần 6/7).
- Toàn bộ hành vi runtime theo HTTP cần DB để xác minh thực nghiệm; trong audit này xác minh bằng source (DB không chạy — xem Phần 7).

### 4.5 Ma trận quyền đề xuất (giữ nghiệp vụ hiện có, làm rõ)

| Nhóm | Guest | User | Admin |
|---|---|---|---|
| Đọc game/category/review/comment | Có (ACTIVE) | Có | Có (mọi status) |
| Ghi game/category | Không (401) | Không (403) | Có |
| Review: create | Không | Có (1/game) | Có |
| Review: update/delete | Không | Chỉ của mình | Mọi review |
| Comment: create | Không | Có (nếu game visible) | Có |
| Comment: update/delete | Không | Chỉ của mình | Mọi comment |
| Favorite | Không | Chỉ của mình | Chỉ của mình |
| Moderation (ẩn comment) | Không | Không | Có (đề xuất bổ sung) |
| Quản lý user (lock/unlock) | Không | Không | Có (đề xuất bổ sung) |

---

## Phần 5 — Game Management Audit

### 5.1 API hiện tại

- `GET /games/` — search (`name/description/developer/publisher`), filter `category` (slug) + `status`, ordering allowlist, pagination (`games/views.py:13-26`).
- `GET /games/{slug}/` — detail, ẩn INACTIVE với non-staff (`:35-48`).
- `POST /games/` — admin, 201, slug tự sinh (`:28-32`, `serializers.py:74-78`).
- `PATCH /games/{id}/` — admin (`:56-68`).
- `DELETE /games/{id}/` — admin, chặn khi có review → 409 (`:70-75`).
- `GET/POST /categories/`, `PATCH/DELETE /categories/{id}/` (`:78-118`).

### 5.2 UI hiện tại

- `AdminGames.jsx` — list/search/filter status/pagination, toggle `PATCH {status}`, delete 2 bước.
- `AdminGameForm.jsx` + `GameForm.jsx` — create/edit, prefill khi edit, gửi đúng payload (name, slug optional, description, developer, publisher, release_date, cover_image, status, category_id).
- `AdminCategories.jsx` + `CategoryForm.jsx` — CRUD category.

### 5.3 Xác minh các tiêu chí đặc biệt

| Tiêu chí | Kết quả | Bằng chứng |
|---|---|---|
| Admin thêm được game | PASS | API create + form create đầy đủ |
| API create tồn tại | PASS | `games/views.py:28-32` |
| API create được bảo vệ backend | PASS | `IsAdminOrReadOnly` → anon 401, non-admin 403 |
| Slug tự sinh + duy nhất | PASS | `generate_unique_slug` (`serializers.py:8-20`), `UniqueValidator` |
| Chặn slug thuần số | PASS | `serializers.py:67-72` |
| Category không tồn tại bị từ chối | PASS | `PrimaryKeyRelatedField(queryset=Category.objects.all())` → 400 (`serializers.py:42-44`) |
| Trạng thái ACTIVE/INACTIVE đúng | PASS | model choices + DB CHECK + `visible_to` |
| Review/favorite ảnh hưởng khi game INACTIVE | PASS (ẩn với non-staff) | `Game.objects.visible_to` dùng ở review/comment/favorite |
| Xóa game có review bị chặn | PASS | `PROTECT` + 409 (`views.py:70-75`) |
| Form xử lý loading/lỗi/submit trùng | PASS | `GameForm.jsx:92-128` (guard `submitting`, render field errors) |

### 5.4 CRUD còn thiếu & validation

- **Thiếu:** upload ảnh game (chỉ URL), xem lịch sử thay đổi, thùng rác/khôi phục — đều ngoài phạm vi MVP (P3).
- **Validation:** đầy đủ ở serializer + client mirror. Không có `max_length` cho `description` (TextField) — chấp nhận được.

### 5.5 Test cần bổ sung

- CRUD game: create/update/delete + 401/403.
- Slug collision & numeric slug rejection.
- Category không tồn tại → 400.
- Delete game có review → 409; delete category có game → 409.
- INACTIVE ẩn với non-staff nhưng staff thấy.
- Pagination/search/filter.

---

## Phần 6 — Comment Moderation Audit

### 6.1 Validation hiện tại

- `content` là `TextField` (`comments/models.py:12`), **không `max_length`**.
- Chặn blank/whitespace: DRF `CharField` `trim_whitespace=True` + `allow_blank=False` → `"   "` thành `""` → 400; đồng thời DB `CheckConstraint comment_content_not_blank` (`^\s*$`) làm backstop (`models.py:17-22`).
- Ownership/identity: `author`/`review` read-only, `user=request.user`, `review=URL` (`views.py:26-30`).
- Không chặn nội dung trùng lặp / spam.

### 6.2 Tình trạng lọc từ nhạy cảm

**MISSING hoàn toàn.** Không có danh sách từ khóa, không có chuẩn hóa tiếng Việt, không có error thân thiện cho nội dung vi phạm.

### 6.3 Xử lý comment bị ẩn

**MISSING.** Không có field trạng thái (`is_hidden`/`status`), không có endpoint admin để ẩn, không có filter loại trừ comment bị ẩn trong list. Do đó 3 trạng thái được yêu cầu (từ chối khi gửi / đánh dấu chờ duyệt / đã ẩn) đều chưa tồn tại.

### 6.4 Rủi ro XSS/spam

- **XSS:** Frontend render `{comment.content}` dưới dạng text, không `dangerouslySetInnerHTML`/`innerHTML` (đã grep — không có) → React auto-escape. Nếu sau này có nơi render HTML thì cần sanitize. Hiện **không có lỗ hổng XSS quan sát được**.
- **Spam:** không giới hạn độ dài, không throttle, không chống lặp → có thể spam.

### 6.5 Giải pháp đề xuất (phù hợp quy mô đồ án)

1. **Validation độ dài:** thêm `max_length` (ví dụ 1000) cho `Comment.content` (serializer + DB `CheckConstraint` `char_length(content) <= N`).
2. **Bộ lọc từ nhạy cảm cấu hình được:** danh sách từ khóa trong settings/constant (ví dụ `SENSITIVE_WORDS`), chuẩn hóa chữ thường + bỏ dấu tiếng Việt + tách từ, chỉ chặn khi khớp **từ nguyên vẹn** để hạn chế false positive.
3. **Phân biệt 3 trạng thái:**
   - Từ chối ngay khi gửi (từ khóa rõ ràng vi phạm) → 400 friendly message.
   - Đánh dấu chờ duyệt (`status=PENDING`/`is_flagged`) khi nghi ngờ.
   - Admin ẩn (`is_hidden=True`) → list loại trừ cho non-staff.
4. **Thông báo lỗi thân thiện**, không lộ danh sách từ khóa.
5. **Test cả trường hợp hợp lệ và vi phạm** (kể cả biến thể không dấu/khoảng trắng).
6. **Không** tích hợp AI moderation hoặc dịch vụ trả phí (chưa cần).

---

## Phần 7 — Testing and Quality

### 7.1 Kết quả các lệnh đã chạy

| Lệnh | Kết quả | Ghi chú |
|---|---|---|
| `python manage.py check` | ✅ PASS — "System check identified no issues (0 silenced)" | — |
| `python manage.py makemigrations --check --dry-run` | ✅ PASS — "No changes detected" | Model và migration đồng bộ |
| `python manage.py migrate --check` | ⚠️ UNVERIFIED | DB không chạy: `connection to server at 127.0.0.1:5433 failed: Connection refused` (không khởi động DB để tránh thay đổi môi trường) |
| `ruff check .` (backend) | ✅ PASS — "All checks passed!" | 54 file |
| `ruff format --check .` | ✅ PASS — "54 files already formatted" | — |
| `npm run lint` (oxlint) | ✅ PASS — 0 warning | — |
| `npm run format:check` (prettier) | ✅ PASS | — |
| `npm run build` (vite) | ✅ PASS — 121 modules, built in 100ms | — |
| `npm test` (frontend) | ❌ **Không tồn tại** | `npm error Missing script: "test"` |
| `pytest` (backend) | ❌ **Không thể chạy** | `pytest` không có trong dependency, không có test/conftest |

### 7.2 Test đã chạy

- **Không có test nào để chạy.** Không có file `test_*.py`, `*_test.py`, `conftest.py` trong backend; không có `*.test.jsx/*.test.js` được track trong frontend (đã kiểm tra `git ls-files`).

### 7.3 Test chưa thể chạy và nguyên nhân

- **Backend:** không có test trong repo; `requirements-dev.txt` chỉ có `ruff`. `pytest`, `pytest-django` không có → không thể chạy.
- **Frontend:** `package.json` không có script `test`, không có `vitest`/`@testing-library/*` → không thể chạy.
- **DB:** `migrate --check` bị chặn do PostgreSQL không chạy.

### 7.4 Khoảng trống test theo mức ưu tiên

1. Authentication & authorization (register/login/refresh/logout/me; 401/403).
2. CRUD game + category (bao gồm 409 khi reference).
3. Review ownership + duplicate 409 + rating range.
4. Comment validation + (sau này) moderation.
5. Favorites ownership + idempotent delete + duplicate 409.
6. Pagination/filtering/ordering.

### 7.5 Vấn đề chất lượng code đáng chú ý

- **Sai lệch tài liệu:** README/PROJECT_PLAN/API.md/FRONTEND.md mô tả test (242 backend, 154 frontend) và trạng thái phase không khớp source. Cần cập nhật để tránh đánh giá sai.
- **Frontend còn nhiều placeholder** (`Home`, `Profile`, có badge "Placeholder") — phù hợp tuyên bố, nhưng cần ghi rõ trong tài liệu.
- `seed_data.sql` chứa hash mật khẩu của các tài khoản dev (kèm mật khẩu trong comment) — chấp nhận cho seed dev, nhưng không nên dùng cho môi trường thật.
- `Account` không có endpoint update → `Profile` không thể hoạt động đầy đủ.
- Không có `DEFAULT_THROTTLE` trong settings.

---

## Phần 8 — Implementation Roadmap

> Roadmap dưới đây phản ánh hiện trạng source: authorization backend đã đúng hướng, nên ưu tiên **test + hardening + moderation + quản lý tài khoản**, không ưu tiên "sửa lỗ hổng phân quyền" (không tìm thấy lỗ hổng IDOR trực tiếp).

### Phase A — P0 Security & Test Baseline

> **Trạng thái: ✅ Hoàn thành.** Throttling đã thêm cho `login`/`register`
> (scope riêng, cấu hình qua `AUTH_LOGIN_THROTTLE_RATE`/`AUTH_REGISTER_THROTTLE_RATE`,
> mặc định `10/min` và `5/min`). Baseline test thực tế đã khôi phục:
> **78 pytest** (backend) và **22 vitest** (frontend) — tất cả xanh, kèm
> `ruff`/`oxlint`/`prettier`/`vite build` sạch. Chi tiết trong
> `docs/PROJECT_PLAN.md` (Phase 11 → Phase A).

- **Mục tiêu:** xác lập lưới an toàn + vá lỗ hổng abuse.
- **Backend:**
  - Thêm throttling (`DEFAULT_THROTTLE_CLASSES`/rates), siết chặt cho `login/register`.
  - Khôi phục bộ test backend tối thiểu (auth/permission/ownership/validation) bằng `pytest` + `pytest-django`.
- **Frontend:** thêm script `test` + `vitest` + `@testing-library/react`; test client/api/hooks cơ bản.
- **DB changes:** không.
- **Dependencies:** thêm `pytest`, `pytest-django` (dev); `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom` (dev).
- **Files dự kiến:** `config/settings.py`, `backend/requirements-dev.txt`, `backend/conftest.py`, `backend/apps/*/tests/*`, `frontend/package.json`, `frontend/src/test/*`, `frontend/src/api/*.test.js`.
- **Acceptance:** `pytest` chạy ≥ 1 bộ test auth/permission; `npm test` chạy; throttle trả 429 khi vượt ngưỡng.
- **Test bắt buộc:** login brute-force bị chặn; 401/403 cho mọi write admin; owner-only review/comment; favorite scope.
- **Rủi ro:** throttle có thể ảnh hưởng dev; cần cấu hình theo env.
- **Điều kiện hoàn thành:** test xanh + lint/build xanh + throttle hoạt động.

### Phase B — Comment Moderation

> **Trạng thái: ✅ Hoàn thành.** `Comment.content` giới hạn 2000 ký tự
> (serializer + DB `CheckConstraint`), bộ lọc từ cấm cấu hình được
> (`COMMENT_BANNED_WORDS`, khớp từ nguyên vẹn, không dấu), cột `is_hidden` +
> migration `comments.0002`, admin hide/unhide (`POST /comments/{id}/moderate/`),
> list ẩn comment với non-staff, UI badge + lọc All/Visible/Hidden.
> Kiểm tra: `pytest` 78 + `vitest` 22 xanh, lint/format/build sạch.

- **Mục tiêu:** validate + kiểm duyệt nội dung comment.
- **Backend:** `max_length`, bộ lọc từ nhạy cảm cấu hình, trạng thái `is_hidden`/`status`, admin hide/unhide, filter list.
- **Frontend:** hiển thị trạng thái/badge, admin hide action, thông báo lỗi thân thiện.
- **DB changes:** thêm cột trạng thái + constraint độ dài (migration mới — chỉ sau audit này).
- **Dependencies:** Phase A (test).
- **Files:** `apps/comments/models.py|serializers.py|views.py|urls.py`, `apps/common/` (constants/filter), `frontend/src/components/comments/*`, `frontend/src/pages/admin/*`.
- **Acceptance:** blank/quá dài/vi phạm bị xử lý đúng; comment bị ẩn không lộ qua API cho non-staff.
- **Test bắt buộc:** nội dung hợp lệ/vi phạm; biến thể không dấu; admin ẩn; non-staff không thấy.
- **Rủi ro:** false positive từ khóa — cần cơ chế khớp từ và cấu hình.
- **Điều kiện hoàn thành:** test moderation xanh; API comment ẩn đúng.

### Phase C — Account Management

> **Trạng thái: ✅ Hoàn thành.** `PATCH /auth/me/` chỉ cho phép `first_name`/
> `last_name` (không tự nâng quyền được), staff `GET /admin/users/` (field an toàn)
> + `POST /admin/users/{id}/status/` khóa/mở khóa (`is_active`, không tự khóa
> mình), UI `Profile` + `/admin/users`. **Xác minh runtime API trên test DB
> ephemeral: 41/41 kiểm tra bảo mật PASS** (token của user bị khóa → 401,
> login trả 401 generic, refresh → 401; chi tiết `docs/PROJECT_PLAN.md` Phase C).

- **Mục tiêu:** người dùng quản lý hồ sơ; admin khóa/mở khóa.
- **Backend:** `PATCH /auth/me/` (first_name/last_name), admin list users + lock/unlock (`is_active`).
- **Frontend:** hoàn thiện `Profile.jsx`, thêm màn admin users.
- **DB changes:** không (dùng `is_active`/`is_staff` sẵn có) — có thể cân nhắc.
- **Dependencies:** Phase A.
- **Files:** `apps/accounts/*`, `frontend/src/pages/Profile.jsx`, `frontend/src/pages/admin/*`.
- **Acceptance:** user đổi tên; admin khóa → user bị từ chối mọi request.
- **Test bắt buộc:** update profile; lock → 401; không tự nâng quyền.
- **Rủi ro:** lộ dữ liệu user — serializer phải chỉ trả field an toàn.
- **Điều kiện hoàn thành:** test xanh; UI profile hoạt động.

### Phase D — Review Aggregation & Discovery

> **Trạng thái: ✅ Hoàn thành.** `average_rating` + `review_count` annotate
> trực tiếp trên queryset đọc (một `annotate()` duy nhất → không N+1, không
> cột tổng hợp); review list sort được theo `rating`/`created_at` (allowlist +
> tie-break `id`); UI hiển thị ★ điểm TB · số review + bộ chọn Sort.
> **Xác minh runtime trên test DB ephemeral: 21/21 PASS** (aggregate đúng ở
> 0/1/N review, query count ổn định 2 lệnh bất kể page size, chi tiết
> `docs/PROJECT_PLAN.md` Phase D).

- **Mục tiêu:** rating trung bình, tổng review, sort/filter review.
- **Backend:** annotate `Avg`/`Count` trên game (hoặc endpoint riêng), sort review theo `rating`/`created_at`.
- **Frontend:** hiển thị điểm trung bình + số review; điều khiển sort.
- **DB changes:** không (annotate) hoặc denormalize nếu có nhu cầu đo được.
- **Dependencies:** Phase A.
- **Files:** `apps/games/serializers.py|views.py`, `apps/reviews/views.py`, `frontend/src/pages/GameDetail.jsx`, `frontend/src/components/reviews/*`.
- **Acceptance:** điểm trung bình tính đúng; N+1 không tăng.
- **Test bắt buộc:** aggregate đúng khi 0/1/N review.
- **Rủi ro:** N+1 nếu không annotate.
- **Điều kiện hoàn thành:** test xanh; query count ổn định.

### Phase E — Moderation Queue & Reporting (tùy chọn)

> **Trạng thái: ✅ Hoàn thành (triển khai theo yêu cầu).** App mới
> `apps/reports/`: model `Report` (DB CHECK đúng 1 target, unique
> reporter+target → `IntegrityError` map sang 409, `reporter` PROTECT /
> target CASCADE), endpoint báo cáo review/comment (target lấy từ URL theo
> `visible_to`, body chỉ `reason`+`details`; game INACTIVE / comment ẩn →
> 404 với user thường), hàng đợi `GET /admin/reports/` + `resolve` (409 khi
> lặp), global list `GET /admin/reviews/` & `/admin/comments/` (dùng chung
> helper `?is_hidden=` với Phase B), `GET /admin/summary/` (7 count query).
> UI: nút Report inline trên từng review/comment (`ReportControl`),
> `/admin/moderation` (3 tab), dashboard 7 thẻ số liệu. **Xác minh runtime
> trên test DB ephemeral: 78/78 PASS** (401/403 toàn bộ admin endpoint, 400
> validate, 409 trùng/lặp, cascade khi xóa nội dung; chi tiết
> `docs/PROJECT_PLAN.md` Phase E).

- **Mục tiêu:** báo cáo review/comment + hàng đợi kiểm duyệt + dashboard thống kê.
- **Backend:** model `Report`, endpoint báo cáo, endpoint global list review/comment cho staff, summary endpoint.
- **Frontend:** trang admin moderation + dashboard metrics.
- **DB changes:** bảng `Report` (migration).
- **Dependencies:** Phase B.
- **Acceptance:** staff xử lý báo cáo; dashboard có số liệu thật.
- **Rủi ro:** tăng độ phức tạp — chỉ làm nếu cần cho đồ án.
- **Điều kiện hoàn thành:** test + UI hoạt động.

---

## Phần 9 — Prioritization

### P0 — Bảo mật & lỗi nghiệp vụ nghiêm trọng

- **P0-1:** Không có test nào trong repo (rủi ro regression toàn hệ thống; tài liệu sai lệch).
- **P0-2:** Không có rate limiting cho login/register (brute-force).

### P1 — Chức năng cần thiết để hoàn thiện đồ án

- **P1-1:** Comment moderation (validate độ dài + từ nhạy cảm + trạng thái ẩn).
- **P1-2:** Quản lý tài khoản (update profile; admin lock/unlock).
- **P1-3:** Đồng bộ tài liệu (README/PROJECT_PLAN/API/FRONTEND) với source.

### P2 — Cải tiến hữu ích

- Rating trung bình + tổng review; sort/filter review.
- Bổ sung test sâu hơn cho pagination/filtering.
- Khai báo `permission_classes` tường minh thay vì dựa default.

### P3 — Tính năng tùy chọn, chưa cần triển khai

- Upload ảnh game (thay URL).
- Report + moderation queue nâng cao + dashboard thống kê.
- Favorite status per-game endpoint.
- Game tương tự/recommendation.

---

## Phần 10 — Recommended Next Steps

Thứ tự để tránh phụ thuộc chồng chéo:

1. **Phase A (P0)** — throttle + test baseline (backend + frontend). Đây là nền tảng bắt buộc; không làm phase khác trước khi có test.
2. **Phase B (P1)** — Comment moderation (phụ thuộc Phase A để có test bảo vệ).
3. **Phase C (P1)** — Account management (độc lập backend, phụ thuộc Phase A).
4. **Phase D (P2)** — Review aggregation/discovery (phụ thuộc Phase A).
5. **Phase E (P3)** — Moderation queue & reporting (phụ thuộc Phase B).

Không chạy song song nhiều phase có chung file (`accounts`, `comments`). Đồng bộ tài liệu (P1-3) làm ngay trong Phase A.

---

## Phụ lục — Bằng chứng then chốt

- Default permission: `backend/config/settings.py:120-122`.
- Định nghĩa quyền: `backend/apps/common/permissions.py:4-59`.
- Game views/permission: `backend/apps/games/views.py:13-118`; slug: `backend/apps/games/serializers.py:8-78`.
- Review views/permission: `backend/apps/reviews/views.py:12-57`; constraint: `backend/apps/reviews/models.py:17-26`.
- Comment views/model: `backend/apps/comments/views.py:13-60`, `models.py:16-22`.
- Favorite views: `backend/apps/favorites/views.py:11-56`.
- Auth: `backend/apps/accounts/views.py:20-68`, `serializers.py:15-65`.
- Frontend client: `frontend/src/api/client.js:96-208`.
- Frontend gating: `frontend/src/components/routes/AdminRoute.jsx:21-47`, `ProtectedRoute.jsx:13-25`.
- Không có test: kết quả `git ls-files | grep -iE "test|conftest|pytest"` → rỗng; `npm test` → Missing script.

---

*Báo cáo này chỉ phục vụ audit và lập kế hoạch. Không có source code, migration hay cấu hình nào bị thay đổi trong quá trình thực hiện.*
