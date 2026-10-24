"""Tạo (hoặc reset) các tài khoản test theo role.

Chạy:
    docker compose exec backend python manage.py seed_test_accounts
hoặc (local):
    cd backend && python manage.py seed_test_accounts

Lệnh idempotent: chạy lại bao nhiêu lần cũng được, tài khoản đã có sẽ được
đặt lại đúng role + mật khẩu bên dưới.
"""

from django.core.management.base import BaseCommand

from apps.accounts.models import User

# (email, mật khẩu THẬT, first_name, last_name, is_staff, is_superuser, is_active, ghi chú)
ACCOUNTS = [
    # --- ADMIN ---
    ("superadmin@gamereview.test", "Test@12345", "Super", "Admin", True, True, True,
     "Superuser: vào được cả Django admin /admin/ và mọi trang admin của app"),
    ("admin1@gamereview.test", "Test@12345", "Admin", "One", True, False, True,
     "Admin (is_staff): quản lý game/category/user/moderation"),
    ("admin2@gamereview.test", "Test@12345", "Admin", "Two", True, False, True,
     "Admin thứ 2: test admin thao tác chéo"),
    # --- USER THƯỜNG ---
    ("user1@gamereview.test", "Test@12345", "User", "One", False, False, True,
     "User thường: chủ review/favorite trong kịch bản test"),
    ("user2@gamereview.test", "Test@12345", "User", "Two", False, False, True,
     "User thường: đóng vai 'người khác' (comment, sửa bài người khác -> 403)"),
    ("user3@gamereview.test", "Test@12345", "User", "Three", False, False, True,
     "User thường: người report / bị admin khóa-mở khóa"),
    # --- USER BỊ KHÓA ---
    ("locked@gamereview.test", "Test@12345", "Locked", "User", False, False, False,
     "User bị khóa (is_active=False): login phải bị từ chối 401"),
    # --- Tài khoản trong seed_data.sql (password gốc là Passw0rd!123) ---
    ("admin@gamereview.dev", "Passw0rd!123", "Admin", "GameReview", True, False, True,
     "Admin từ seed_data.sql"),
    ("alice@example.com", "Passw0rd!123", "Alice", "Nguyen", False, False, True,
     "User từ seed_data.sql"),
    ("bob@example.com", "Passw0rd!123", "Bob", "Tran", False, False, True,
     "User từ seed_data.sql"),
    ("carol@example.com", "Passw0rd!123", "Carol", "Le", False, False, True,
     "User từ seed_data.sql"),
]


class Command(BaseCommand):
    help = "Create/reset test accounts for every role (plain-text passwords listed in this file)."

    def handle(self, *args, **options):
        for email, pw, first, last, staff, superuser, active, note in ACCOUNTS:
            user, created = User.objects.get_or_create(email=email)
            user.first_name, user.last_name = first, last
            user.is_staff, user.is_superuser, user.is_active = staff, superuser, active
            user.set_password(pw)
            user.save()
            role = "SUPERADMIN" if superuser else "ADMIN" if staff else "USER"
            state = "" if active else " (LOCKED)"
            self.stdout.write(
                f"{'created' if created else 'reset  '} {role:10} {email:30} / {pw}{state}"
            )
        self.stdout.write(self.style.SUCCESS(f"Done: {len(ACCOUNTS)} accounts"))
